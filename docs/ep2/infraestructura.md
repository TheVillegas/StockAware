# Infraestructura EP2: implementada, con equivalencia docente pendiente

Render Blueprint describe el staging realmente desplegado. No falta reconstruir ese entorno: falta adjuntar la autorización docente de su equivalencia, porque el PDF del curso (p. 26) pide Terraform o una alternativa previamente autorizada.

## Evidencia técnica

| Elemento | Definición / prueba |
| --- | --- |
| PostgreSQL administrado | [`render.yaml`](../../render.yaml): `stockaware-db`, región Oregon, `ipAllowList: []`; NestJS usa referencias a la base, no claves literales |
| NestJS | Servicio Docker `stockaware-api`, arranque de réplica y `/api/health`; `SELECT 1` comprueba PostgreSQL |
| FastAPI | Servicio Docker `stockaware-intelligence`, `/health`; conexión entre servicios mediante referencia del Blueprint |
| Angular | Sitio estático `stockaware-web`, compilación y referencia al host de NestJS |
| Despliegue automático | [Workflow](../../.github/workflows/repository-checks.yml): push a `develop`, gate aprobado y job `staging-deploy`; `autoDeployTrigger: off` evita otro despliegue independiente de Render |
| Commit exacto y salud | [Script de despliegue](../../.github/scripts/desplegar-staging.sh) y [validador](../../.github/scripts/comprobar-salud-staging.py): tres despliegues live, versiones NestJS/FastAPI iguales al SHA, PostgreSQL ok y web HTTP 200 |
| Ejecución aprobada | [Run 40243507519 / job 121320670304](https://github.com/TheVillegas/StockAware/actions/runs/40243507519/job/121320670304), `develop` `4a7b16186738ab21fbcdb300d06e8a1bc7828087` |
| Corte entregado | Main/tag `cc02c2398bac3d2e604bb0613be964d6a9f3fbe8`; mismo árbol que develop, no mismo SHA. El job de staging de main se omite por diseño |

Los resultados acreditan esa ejecución histórica, no una consulta nueva de disponibilidad. [Staging](staging.md) conserva URLs, operación y límites del entorno. [La demo local](demo-local.md) añade evidencias de negocio y logs sanitizados, separados de Render.

## Qué no prueba Terraform actualmente

[`infrastructure/terraform/staging/main.tf`](../../infrastructure/terraform/staging/main.tf) contiene descriptores `null_resource`, no recursos de cómputo ni una base provisionada. Su validación no acredita un `apply` de infraestructura real. La [decisión de infraestructura](../architecture/adr/0001-preliminary-staging-definition.md) y la guía de staging conservan ese límite.

No se ejecutó un nuevo aprovisionamiento, no se creó una segunda base, no se inspeccionaron valores de secretos y no se alteró el Blueprint que funciona. Adoptar un proveedor Terraform real solo tendría sentido si el docente no acepta la equivalencia y después de acordar cuenta, permisos, costos y migración.

## Cierre académico pendiente

La [consulta preparada](gestion.md#autorización-de-infraestructura-equivalente) sigue sin enviar. Adjuntar la respuesta real del docente con fecha y referencia accesible. La aceptación técnica del pipeline, una aprobación de PR o la autorización de fuentes web no reemplazan esa respuesta.
