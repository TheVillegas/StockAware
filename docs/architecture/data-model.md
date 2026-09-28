# Modelo de datos de la réplica

Este documento no diseña un modelo de dominio nuevo para StockAware. Describe el esquema de la réplica anonimizada del ERP VAIPS.

## Fuente autoritativa

La estructura autoritativa es [`apps/backend/database/init/01_schema.sql`](../../apps/backend/database/init/01_schema.sql). Ese archivo se generó desde el `information_schema` del ERP original. Su encabezado y la [guía de reproducibilidad](../ep1/reproducibility.md) indican 69 tablas. No reemplaces esa fuente por un esquema simplificado: esta nota no enumera columnas ni claves foráneas.

## Orden de inicialización

PostgreSQL ejecuta los scripts de `apps/backend/database/init/` solo cuando el volumen `pgdata` está vacío. En un volumen ya inicializado, Docker no los vuelve a correr. El orden es:

| Orden | Archivo | Rol |
|---|---|---|
| 1 | `01_schema.sql` | Estructura generada desde el `information_schema` |
| 2 | `02_datos.sql.gz` | Semilla ya anonimizada |
| 3 | `03_vistas.sql` | Vistas traducidas de MySQL a PostgreSQL |
| 4 | `04_secuencias.sql` | Sincroniza contadores de identidad con los datos cargados |

La guía de reproducibilidad explica por qué el cuarto paso importa y advierte que algunas vistas pueden quedar sin crear, con un `WARNING`, sin detener el resto del arranque.

## Ejemplos de grupos, no un modelo nuevo

Estos nombres existen como tablas en `01_schema.sql`. Sirven solo para reconocer grupos del ERP replicado. No implican columnas, relaciones ni flujos de StockAware que este documento no verificó:

| Grupo en la réplica | Tablas de ejemplo |
|---|---|
| Acceso | `acceso_perfiles`, `acceso_permisos` |
| Bodega y materiales | `bodega`, `materiales`, `materiales_x_bodega`, `mov_bodega` |
| Centro de costo | `centro_costo` |
| Documentos | `docs_emitidos`, `docs_recibidos` |

Hay más tablas en el script. La lista anterior no es el modelo de dominio previsto para la reposición adaptativa.
