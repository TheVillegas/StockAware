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

La base no acepta conexiones desde internet (`ipAllowList` vacío). El plan gratis no acepta un comando de pre-deploy, así que `dockerCommand` apunta a `database/render-start.sh`, que carga la réplica y después arranca NestJS. El dump `02_datos.sql.gz` viaja en la imagen. Si el esquema ya existe y la marca `replica_carga` no, el arranque vacía las tablas y vuelve a cargar datos, vistas y secuencias. Compose local no usa ese comando. `JWT_SECRET` no va en el archivo: el Dashboard lo pide al aplicar el Blueprint.

El frontend de Render llama a `https://<api>/api`. En local, Compose sigue usando `http://localhost:3000/api`.

## Aplicar

1. Sube esta rama al remoto.
2. Abre `https://dashboard.render.com/blueprint/new?repo=https://github.com/TheVillegas/StockAware`.
3. Elige la rama `develop` cuando el archivo ya esté en esa rama, o la rama que lo contenga.
4. Completa `JWT_SECRET` sin pegarlo en el repositorio.
5. Pulsa Apply.

El despliegue automático espera a que pasen los checks de GitHub (`autoDeployTrigger: checksPass`).
