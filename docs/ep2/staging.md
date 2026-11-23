# Staging EP2 en Render

Render aloja el staging con un Blueprint, el archivo `render.yaml` de la raíz. Ese es el modelo de infraestructura de Render. El root Terraform de la EP1 no cambia y sigue en `defined-not-deployed`.

Los planes son los gratuitos publicados en la documentación de Render: `free` para los dos web services y para Postgres. El sitio estático no tiene plan de cómputo. Los tres recursos de cómputo y la base quedan en `oregon`, que es la región por defecto, para que NestJS llegue a FastAPI y a Postgres por la red privada.

## Límites del plan gratis

- Un web service gratis se apaga tras 15 minutos sin tráfico y tarda cerca de un minuto en volver.
- Postgres gratis caduca a los 30 días de crearla. Hay que volver a crearla antes de la defensa si esa fecha ya pasó.
- Solo puede haber una Postgres gratis por workspace.

## Qué crea el Blueprint

| Recurso | Tipo | Plan |
| --- | --- | --- |
| `stockaware-web` | sitio estático | sin plan |
| `stockaware-api` | web service Docker | `free` |
| `stockaware-intelligence` | web service Docker | `free` |
| `stockaware-db` | Postgres | `free` |

La base no acepta conexiones desde internet (`ipAllowList` vacío). El plan gratis no acepta un comando de pre-deploy, así que `dockerCommand` apunta a `database/render-start.sh`, que carga la réplica y después arranca NestJS. El dump `02_datos.sql.gz` viaja en la imagen y se lee por partes: la instancia gratis tiene 512 MB y el archivo descomprimido pesa unos 62 MB. Si el esquema ya existe y la marca `replica_carga` no, el arranque vacía las tablas y vuelve a cargar datos, vistas y secuencias. Compose local no usa ese comando. `JWT_SECRET` no va en el archivo: el Dashboard lo pide al aplicar el Blueprint.

El frontend de Render toma `BACKEND_HOST` del hostname público del servicio API y llama a `https://<api>/api`. Sin configuración, los builds locales y Compose conservan `http://localhost:3000/api` (localhost del navegador, no del contenedor). `ng serve` y los builds directos `ng build` también conservan ese valor.

Para un build de staging o Android, define `API_URL` como URL HTTPS pública completa, incluida la ruta API, por ejemplo `API_URL=https://api.example.com/api npm run build` desde `apps/frontend`. La configuración se incorpora al bundle en tiempo de build y no es secreta: no incluyas credenciales ni parámetros. Se rechazan URLs no HTTPS, con credenciales, query o fragmento, y hosts sin dominio público; `API_URL` tiene prioridad sobre `BACKEND_HOST`. Se elimina una barra final. Para Compose, `API_URL=https://api.example.com/api docker compose build frontend` pasa el mismo argumento de build; sin él mantiene el valor local. El cliente nativo necesita una API accesible desde el dispositivo: su `localhost` no es el de la máquina de desarrollo. La configuración no cambia CORS ni despliega servicios.

## Aplicar

1. Sube esta rama al remoto.
2. Abre `https://dashboard.render.com/blueprint/new?repo=https://github.com/TheVillegas/StockAware`.
3. Elige la rama `develop` cuando el archivo ya esté en esa rama, o la rama que lo contenga.
4. Completa `JWT_SECRET` sin pegarlo en el repositorio.
5. Pulsa Apply.

El despliegue lo hace GitHub Actions cuando un push a `develop` pasa el CI (`staging-deploy` en `repository-checks.yml`). Render no despliega solo: `autoDeployTrigger` queda en `off`, así que hay que sincronizar el Blueprint después de mergear ese cambio.

Los secretos del repositorio, una sola vez y sin pegarlos en el código, son `RENDER_API_KEY`, `RENDER_SERVICE_ID_API`, `RENDER_SERVICE_ID_INTELLIGENCE` y `RENDER_SERVICE_ID_WEB`. El job despliega ese commit y después comprueba:

- `https://stockaware-api.onrender.com/api/health` con `postgres: ok` y `version` igual al SHA
- `https://stockaware-intelligence.onrender.com/health`
- `https://stockaware-web.onrender.com/`

Después corre el paso **Smoke test staging after deploy** (`.github/scripts/smoke-staging.py`, BE-10). Con un usuario de prueba hace lo siguiente:

1. Inicia sesión.
2. Consulta el stock de una bodega.
3. Consulta los precios de un material conocido.
4. Pide las recomendaciones en modo `adaptativo`, que deben llegar sin degradar.
5. Comprueba que una ruta sin permiso responde 403.

Si un paso falla, el job falla y el despliegue no se da por bueno. El script no imprime el token, la clave ni los cuerpos de las respuestas.

El smoke necesita esta configuración en GitHub:

| Nombre | Dónde se guarda | Qué contiene |
| --- | --- | --- |
| `STAGING_SMOKE_USER` y `STAGING_SMOKE_PASSWORD` | Secrets | Un usuario de prueba con `MATERIAL_X_BODEGA` y `RECOMENDACIONES` |
| `STAGING_SMOKE_BODEGA` | Variables | El `id_bodega` numérico de la bodega |
| `STAGING_SMOKE_MATERIAL` | Variables | Un `cod_material` cotizable de esa bodega que ya tenga precios guardados, para que el smoke no dependa de las fuentes externas |
| `STAGING_SMOKE_FORBIDDEN_PATH` | Variables | Una ruta de la API, relativa a `/api`, para la que el usuario no tiene permiso |

### Token entre servicios (BE-03)

FastAPI rechaza con `401 {"error":"unauthorized"}` cualquier ruta salvo `/health` si no recibe el header `X-Service-Token` correcto. La comparación es de tiempo constante. Si el secreto falta, el servicio queda cerrado: no se abre por error. `/docs` y `/openapi.json` de FastAPI también exigen el token, porque muestran la superficie interna. El contrato público está en el Swagger de NestJS. El script `npm run metrica:precios` lee `INTELLIGENCE_SERVICE_TOKEN` del entorno.

En Render, el Blueprint genera `INTELLIGENCE_SERVICE_TOKEN` en `stockaware-intelligence` y `stockaware-api` lo toma de ahí con `fromService`, así que nadie copia el secreto a mano. **Hay que sincronizar el Blueprint antes de mergear BE-03.** Si no, FastAPI arranca sin token, rechaza todo, el smoke falla y el job revierte el despliegue.

En local, definí `INTELLIGENCE_SERVICE_TOKEN` en el `.env` antes de `docker compose up`. Podés generarlo con `python -c "import secrets; print(secrets.token_urlsafe(32))"`.

### Rollback

Antes de desplegar, el job guarda el SHA que está en vivo. Si después falla el deploy, el health check o el smoke, el paso **Roll back to the last healthy SHA** vuelve a desplegar ese SHA y comprueba la salud contra él. El job termina en rojo igual, para que quede claro que el despliegue nuevo no se aceptó.

Para volver a mano a una versión anterior:

1. Ir a **Actions → Rollback staging → Run workflow**.
2. Indicar un tag o un SHA de `develop`.
3. Esperar a que el job termine en verde. Eso significa que los health checks reportan ese SHA.

El rollback no revierte migraciones. El procedimiento para ellas y la política *expand/contract* están en el [ADR 0004](../architecture/adr/0004-rollback-de-staging.md).

Postgres no se abre a internet. La conexión la prueba Nest con `SELECT 1`. Cada petición escribe una línea JSON con `correlation_id` y `duration_ms`. Un fallo de fuente externa escribe `evento: fuente_externa` con el host, sin la URL ni credenciales.

## Verificar el cierre de #51

Un CI verde de un pull request no demuestra el despliegue: `staging-deploy` solo se ejecuta después de un push a `develop` con el gate aprobado. Antes de cerrar el issue, adjuntar:

- El enlace al run con `Staging deploy` aprobado, la URL de staging y el SHA desplegado.
- El resultado de los health checks de NestJS y FastAPI con ese mismo SHA, incluido `postgres: ok` en NestJS.
- Una muestra sanitizada de los registros de petición y de error de fuente externa, con `correlation_id` y `duration_ms`, sin credenciales.

### Evidencia verificada (2026-10-25)

El [run 40223109497](https://github.com/TheVillegas/StockAware/actions/runs/40223109497), **intento 2**, terminó correctamente para el commit `238669b69006624fb17f82e5b258dc344ab70d2f` de `develop`. El job **Staging deploy** (`121302802508`) aprobó el paso **Deploy this commit and check health**. El script exige que los tres despliegues estén `live`, que NestJS responda `estado: ok`, `postgres: ok` y la versión exacta del commit, que FastAPI responda saludable con esa misma versión y que el sitio web devuelva HTTP 200.

| Servicio | URL verificada por el job |
| --- | --- |
| NestJS | <https://stockaware-api.onrender.com/api/health> |
| FastAPI | <https://stockaware-intelligence.onrender.com/health> |
| Frontend | <https://stockaware-web.onrender.com/> |

Esto acredita el despliegue y los health checks de **ese corte**; no garantiza disponibilidad futura ni que cambios posteriores estén desplegados. La captura de Render con los tres servicios `Deployed` es evidencia complementaria, no reemplaza la comprobación del SHA. La [muestra local sanitizada](demo-local.md) ya está enlazada en [#51](https://github.com/TheVillegas/StockAware/issues/51#issuecomment-6407313416); no se presenta como logs de producción. Para la EP2 completa, revisar el [checklist de entrega](entrega.md#checklist-de-cierre-documental-y-académico).

### Corte publicado y staging equivalente

El [run 40243507519](https://github.com/TheVillegas/StockAware/actions/runs/40243507519) terminó correctamente para `develop` `4a7b16186738ab21fbcdb300d06e8a1bc7828087`. El job `121320670304` confirmó los tres servicios `live` y la comprobación final de NestJS, FastAPI, PostgreSQL y web para ese SHA.

Después de la aprobación de Matías Romero, [#90](https://github.com/TheVillegas/StockAware/pull/90) se fusionó mediante squash a `main` `cc02c2398bac3d2e604bb0613be964d6a9f3fbe8`. El [CI de main](https://github.com/TheVillegas/StockAware/actions/runs/40245633645) terminó `success`; su job de staging se omitió según la configuración. El [tag/release v0.2.0-ep2](https://github.com/TheVillegas/StockAware/releases/tag/v0.2.0-ep2) apunta a ese commit final.

Los dos commits tienen el árbol `8bffd49c49ef49dda6cadbac356536445d09f94b`: mismo contenido, distintas identidades por el squash. No se cambió la rama de Render, ningún secreto ni el tag anterior. La disponibilidad futura debe comprobarse antes de la demo; este registro es evidencia del run, no una nueva consulta al entorno.

La [demo local posterior](demo-local.md) añade interfaz, persistencia y una muestra sanitizada correlacionada de petición/falla de fuente provocada en la réplica. No es una nueva falla ni una nueva medición de Render. El paquete y su checksum están adjuntos a la [release](https://github.com/TheVillegas/StockAware/releases/tag/v0.2.0-ep2) y enlazados en [#51](https://github.com/TheVillegas/StockAware/issues/51#issuecomment-6407313416); no se cerró automáticamente el issue ni se movió el tag. Ver [matriz de evidencias](evidencias.md) y [alcance de infraestructura/equivalencia](infraestructura.md).

## Validar el contrato de seguridad de CI

El check `Validate Trivy severity contracts` analiza el YAML y comprueba las severidades y el código de salida de cada paso de Trivy. Las listas dentro de mapas YAML en línea deben llevar comillas (`severity: 'HIGH,CRITICAL'`); sin ellas, la coma separa entradas del mapa y se pierde `CRITICAL`. La comprobación local es:

```bash
ruby tests/ci/test-workflow-security.rb .github/workflows/repository-checks.yml
bash tests/ci/test-ci-contracts.sh
```
