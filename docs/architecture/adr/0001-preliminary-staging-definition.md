# ADR 0001: definición preliminar de staging

## Estado

Aceptado para el alcance preliminar de EP1.

## Contexto

La réplica local ya está descrita en `docker-compose.yml`: cuatro servicios (`db`, `intelligence`, `backend` y `frontend`) en la red implícita del proyecto Compose. No hay cuenta cloud en este repositorio y GitHub Actions no tiene secretos de aplicación. Un plan contra un proveedor cloud no sería reproducible aquí: fallaría por falta de credenciales, no por la forma del entorno.

EP1 pide una definición preliminar de staging, no un ambiente desplegado. Presentar un plan o un archivo Terraform como servidor creado sería falso.

## Decisión

Staging preliminar queda definido por el root `infrastructure/terraform/staging`, no por un proveedor cloud.

- Terraform 1.6 o superior.
- Único proveedor: `hashicorp/null` 3.2.3.
- Cinco `null_resource` cuyos `triggers` copian la topología de `docker-compose.yml`: la red del proyecto y los servicios `db`, `intelligence`, `backend` y `frontend`.
- Variables solo de nombres y puertos no sensibles. No hay contraseñas, secretos JWT ni credenciales.
- La salida `status` es `defined-not-deployed`. Las otras salidas son los cuatro endpoints locales previstos. No hay URL pública de staging.

El detalle operativo, y la advertencia de no tratar esto como un ambiente vivo, está en [la descripción de staging](../../ep1/staging.md).

## Por qué el proveedor null

`null_resource` no crea infraestructura. Permite versionar la forma del entorno y ejecutar `init`, `fmt -check`, `validate` y `plan` sin credenciales. Un proveedor de AWS, GCP, Azure u otro cloud exigiría una cuenta y secretos que este repositorio no tiene; el plan no se podría repetir en esta máquina ni en Actions.

## Consecuencias

- `terraform plan` es reproducible sin cuenta cloud. Eso es la evidencia EP1, junto con `fmt -check` y `validate`.
- El plan no crea servidores, redes, bases ni contenedores. `terraform apply` no se ejecutó y no debe presentarse esta definición como un entorno en línea.
- El estado local y el directorio `.terraform/` no se versionan. El lock del proveedor sí queda en el root.
- El diagrama de despliegue preliminar de EP1 puede seguir diciendo que no hay staging desplegado. Esta decisión no cambia ese hecho.

## Qué lo reemplazaría después

Cuando existan credenciales y una cuenta cloud autorizada, este root se reemplaza por un proveedor real y recursos que correspondan a esa cuenta. Hasta entonces, no se sustituye `hashicorp/null` por un proveedor cloud solo para que el archivo parezca un despliegue.
