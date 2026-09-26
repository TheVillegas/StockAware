# Demo EP1: reproducibilidad y evidencia

Esta guía acompaña desde el arranque local hasta la evidencia de los siete criterios. Las respuestas indicadas como **esperadas por código** se derivan de la configuración y handlers actuales; no implican que se hayan ejecutado servicios ni GitHub Actions en esta sesión. Registrá por separado los resultados efectivamente observados.

## Requisitos y secretos locales

Necesitás Docker con Docker Compose v2. Los comandos `curl` y `python3` se usan en pruebas HTTP; PostgreSQL se consulta dentro de su contenedor, así que no hace falta instalar su cliente en el host. La primera inicialización importa la semilla y puede tardar.

`.env.example` documenta valores locales no secretos como `PG_USER=erp`, `PG_DATABASE=erp_replica`, puertos `5432`, `3000`, `4200` y `8000`, `CORS_ORIGIN=http://localhost:4200` y `JWT_EXPIRA=3600s`. También contiene variables de versiones Node/Python para CI. `PG_PASSWORD` y `JWT_SECRET` no están ahí: Compose los requiere y se deben definir solo para tu entorno local.

Para una demo breve, exportarlos en la terminal es razonable: existen mientras viva esa sesión de shell y sus procesos hijos. Alternativamente podés guardarlos en un `.env` local: `.gitignore` excluye `.env` y `.env.*` (y conserva los archivos `*.example`), pero eso no protege el archivo de otros usuarios con acceso a tu equipo ni de copias/respaldos. Usá únicamente valores inventados y exclusivos de esta réplica; nunca pegues credenciales reales, reutilizadas o de producción, ni compartas o versionés `.env`.

Desde la raíz del repositorio:

```bash
export PG_PASSWORD='solo-local-demo-cambiar'
export JWT_SECRET='solo-local-demo-cambiar-por-un-valor-largo'
cp .env.example .env
docker compose up -d --build
docker compose ps
```

Compose publica frontend `http://localhost:4200`, NestJS `http://localhost:3000/api`, FastAPI `http://localhost:8000` y PostgreSQL `localhost:5432`. El frontend llama a NestJS; NestJS usa PostgreSQL y `http://intelligence:8000` dentro de la red Compose. La variable `INTELLIGENCE_SERVICE_URL=http://localhost:8000` del template es para uso desde el host; el servicio backend en Compose configura correctamente el hostname interno.

## Servicios de Compose

| Servicio | Contenedor | Puerto host | Rol / señal de disponibilidad |
|---|---|---|---|
| `db` | `erp-db` | 5432 | PostgreSQL; healthcheck `pg_isready` |
| `intelligence` | `erp-intelligence` | 8000 | FastAPI; healthcheck `GET /health` |
| `backend` | `erp-backend` | 3000 | NestJS; inicia después de `db` e `intelligence` healthy; no tiene healthcheck |
| `frontend` | `erp-frontend` | 4200 | Angular + Ionic; no tiene healthcheck |

## Siete criterios de demostración

### 1. Levantamiento reproducible

`docker compose ps` debe mostrar `db` e `intelligence` como `healthy` y `backend` como `running` (no tiene healthcheck). Frontend tampoco declara healthcheck: abrí `http://localhost:4200`. Si el inicio sigue en curso, esperá y volvé a consultar el estado; no borres volúmenes para resolver un problema.

### 2. Salud de FastAPI

```bash
curl -i http://localhost:8000/health
```

**Esperado por el handler:** HTTP 200 y `{"status":"ok","service":"intelligence-service"}`. Esto prueba FastAPI directamente, no el salto desde NestJS. Anotá el estado y cuerpo realmente observados.

### 3. Inicio y navegación Angular/Ionic

La ruta inicial redirige a `inicio`, que requiere sesión y deriva a `login`. En `http://localhost:4200`, iniciá sesión con uno de los usuarios de la semilla (usuario sensible a mayúsculas; clave demo `replica2026`):

| Usuario | Perfil | Alcance descrito |
|---|---|---|
| `admin` | Administrador | todo |
| `gestion` | Control de Gestión | consulta y mantenedores |
| `operador` | Op. Operaciones | operación diaria |
| `consulta` | Visualización Documentos | solo lectura |

Inicio muestra usuario, perfil, permisos y menús. El menú se carga desde NestJS y depende del perfil. Elegí una opción visible; las rutas dedicadas incluyen `/f/MATERIAL_X_BODEGA`, `/f/BODEGA_MOVIMIENTOS`, `/f/ING_MATERIAL`, `/f/DOC_DISTRIBUIR` y `/f/BALANCE_CCOSTO`. No todas las opciones necesariamente tienen una pantalla de negocio completa. Registrá qué pantalla y perfil observaste.

### 4. Frontend → NestJS

En el navegador abrí herramientas de desarrollo → **Network/Red**, filtro **Fetch/XHR**, y recargá o iniciá sesión. **Esperado por Angular:** `POST http://localhost:3000/api/auth/login` responde con `access_token` y `usuario`; después carga `GET /api/menu`. El interceptor adjunta `Authorization: Bearer …` a solicitudes autenticadas. Mostrá estados HTTP y pantalla Inicio; no copies ni compartas el token.

También podés usar `curl`. Imprime el token solo en tu terminal; no lo publiques:

```bash
TOKEN=$(curl -sS -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"user":"admin","clave":"replica2026"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
test -n "$TOKEN" && echo 'Token recibido (no compartir)'
curl -i http://localhost:3000/api/menu -H "Authorization: Bearer $TOKEN"
```

Registrá los códigos observados sin capturar el token.

### 5. NestJS → FastAPI

Ambos handlers NestJS requieren JWT. Con el token del paso anterior:

```bash
curl -i http://localhost:3000/api/inteligencia/salud \
  -H "Authorization: Bearer $TOKEN"
curl -i -X POST http://localhost:3000/api/inteligencia/eco \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"mensaje":"hola desde la demo"}'
```

**Esperado por los handlers:** salud devuelve HTTP 200 y `{"status":"ok","service":"intelligence-service"}`; eco devuelve HTTP 200 y `{"eco":"hola desde la demo","servicio":"intelligence-service"}`. El nombre del servicio en la respuesta demuestra el salto NestJS→FastAPI; la llamada directa a `:8000/health` no lo demuestra. Anotá las respuestas observadas.

### 6. Prueba de PostgreSQL

Consulta de solo lectura ejecutada dentro del contenedor:

```bash
docker compose exec -T db psql -U erp -d erp_replica \
  -c 'SELECT current_database(), count(*) AS perfiles FROM acceso_perfiles;'
```

**Esperado:** `current_database` es `erp_replica` y se muestra un conteo de perfiles. Los argumentos coinciden con los defaults del template; si cambiaste `PG_USER` o `PG_DATABASE`, reemplazalos por tus valores locales. En el primer arranque se importan en orden `01_schema.sql`, `02_datos.sql.gz`, `03_vistas.sql` y `04_secuencias.sql`; los scripts de init no se repiten sobre un volumen ya inicializado. Las vistas no traducidas pueden aparecer como `WARNING` sin impedir el resto del arranque. Registrá el resultado realmente obtenido.

### 7. GitHub Actions y prueba controlada del gate

El workflow `.github/workflows/repository-checks.yml` corre en pull requests, pushes a `main`/`develop` y permite `workflow_dispatch` con un único input booleano `exercise_failure` (default `false`). La ejecución manual **requiere dispatch explícito en GitHub y permisos adecuados**; esta guía no lo ejecuta. Para evidencia real, en GitHub elegí **Actions → Repository checks → Run workflow**, dejá el input desactivado y guardá URL/ID del run, commit, estado de jobs y artifacts `ci-evidence-<sha>-<run_id>-…` (discovery, security, frontend, backend, intelligence, postgres, containers y critical-gate, según aplique). Los artifacts son resúmenes de metadatos redactados.

El job de seguridad valida el contrato de excepciones y variables de entorno, escanea secretos del rango de cambios y working tree, y usa Trivy: LOW/MEDIUM advierte; HIGH/CRITICAL bloquea. El job policy-probe es una prueba independiente del gate, no un scanner de vulnerabilidades.

Un YAML o una respuesta esperada no equivale a un run observado. Los jobs `skipped` o `not_applicable` no cuentan como aprobados; informá el resultado de cada control según su aplicabilidad. Para probar de manera intencional y desechable que el gate falla de forma cerrada, ejecutá un **segundo** `workflow_dispatch` con `exercise_failure=true`. `CI policy probe` termina con error deliberado y `CI critical gate` debe fallar porque ese control aplicable falló. Este probe solo verifica el gate final ante un fallo simulado: no introduce vulnerabilidades ni secretos y no prueba los scanners. No lo presentes como pipeline verde ni como hallazgo de seguridad. Para una corrida normal, volvé a despachar con `false`; guardá ambos enlaces por separado. GitHub Actions habilitado y permiso de dispatch son requisitos.

## Inicialización y operación de la base

La primera vez que arranca, PostgreSQL corre en orden los scripts de `apps/backend/database/init/`:

| Archivo | Qué hace |
|---|---|
| `01_schema.sql` | Estructura: 69 tablas, generada desde el `information_schema` del ERP |
| `02_datos.sql.gz` | Datos ya anonimizados (~415.000 filas) |
| `03_vistas.sql` | Las vistas, traducidas de MySQL a PostgreSQL |
| `04_secuencias.sql` | Sincroniza los contadores de identidad con los datos cargados |

El orden importa: los datos entran con sus `id` originales, y eso **no** avanza las secuencias. Sin el cuarto paso, el primer `INSERT` nuevo pide `id = 1` y choca con las filas existentes. Seis vistas no se pudieron traducir automáticamente y quedan sin crear; el arranque las informa como `WARNING` en `docker compose logs db` y continúa con el resto.

Comandos útiles que no eliminan datos:

```bash
docker compose stop          # parar sin perder datos
docker compose up -d         # volver a levantar
docker compose down          # quitar contenedores/red, conservar volumen
docker compose logs -f backend
docker compose logs -f intelligence
```

Para desarrollar el frontend con recarga en caliente conviene sacarlo de Docker:

```bash
docker compose stop frontend
cd apps/frontend && npm install && npm start
```

## Regeneración de la base

En `apps/backend/database/migracion/` están los scripts que produjeron la base leyendo la original; **solo leen MySQL, nunca escriben**:

- `gen_ddl.php` — genera `01_schema.sql` desde el `information_schema`.
- `gen_vistas.php` — traduce las vistas y las ordena por dependencia.
- `anonimiza.php` — extrae y anonimiza los datos con remapeo consistente.
- `carga.sh` — crea la base y hace el `COPY`.
- `informe_anonimizacion.txt` — detalla el tratamiento de cada tabla y columna.

Correrlos requiere acceso a la base original, restringido por IP.
