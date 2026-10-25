# Demo EP1: staging definido, no desplegado

Staging, para el alcance preliminar de EP1, es el root Terraform `infrastructure/terraform/staging`. Esa definición sigue `docker-compose.yml`. No es un ambiente cloud, no tiene URL pública y no se desplegó.

`terraform apply` no se ejecutó. No lo presentes como un entorno vivo, ni como servidores, redes o bases creadas. Un plan exitoso solo demuestra que la definición es válida y reproducible sin credenciales. La evidencia EP1 de este root es `fmt -check`, `validate` y `plan`, no `apply`.

La decisión y el motivo del proveedor `hashicorp/null` están en el [ADR 0001](../architecture/adr/0001-preliminary-staging-definition.md).

## Qué queda definido

No hay cuenta cloud ni secretos de aplicación en GitHub Actions. Por eso el root usa Terraform 1.6 o superior y solo el proveedor `hashicorp/null` 3.2.3. Los recursos son `null_resource`; no son objetos de un proveedor cloud.

| Recurso | Corresponde en Compose |
|---|---|
| `staging_network` | Red implícita del proyecto para `db`, `intelligence`, `backend` y `frontend` |
| `staging_db` | Servicio `db`, contenedor `erp-db`, imagen `postgres:16-alpine`, puerto de host `5432`, base `erp_replica`, volumen `pgdata` |
| `staging_intelligence` | Servicio `intelligence`, contenedor `erp-intelligence`, puerto de host `8000`, health `GET /health` |
| `staging_backend` | Servicio `backend`, contenedor `erp-backend`, puerto de host `3000`; depende de `db` e `intelligence`; URL interna `http://intelligence:8000` |
| `staging_frontend` | Servicio `frontend`, contenedor `erp-frontend`, puerto de host `4200` publicado hacia el puerto 80 del contenedor; habla solo con `backend` |

Los puertos y el nombre de la base son variables con esos defaults. No hay contraseñas, `JWT_SECRET` ni otras credenciales en el root. La salida `status` es exactamente `defined-not-deployed`. Las otras salidas son endpoints locales previstos, no una URL de staging:

- base: `localhost:5432`
- intelligence: `http://localhost:8000`
- backend: `http://localhost:3000`
- frontend: `http://localhost:4200`

Esos puertos son los mismos defaults de la [guía de reproducibilidad](reproducibility.md). Levantar la réplica sigue siendo `docker compose` en un host de desarrollo. Este Terraform no la levanta.

## Comandos observados para la evidencia

Desde `infrastructure/terraform/staging`, con Terraform 1.6 o superior:

```bash
terraform init -input=false
terraform fmt -check
terraform validate
terraform plan -input=false -lock=false
```

`init` descarga el proveedor null. `fmt -check` comprueba el formato. `validate` comprueba la configuración. `plan` muestra el diff de la definición; con `-lock=false` no toma lock de estado. Ninguno de esos comandos crea el entorno.

No ejecutes `terraform apply` para “completar” la evidencia de EP1. Apply no se corrió en esta definición y no convierte estos `null_resource` en un staging de nivel cloud.

El directorio `.terraform/`, los `*.tfstate` y `crash.log` quedan fuera de Git por el `.gitignore` de este root. `.terraform.lock.hcl` sí se versiona: fija el proveedor que hizo reproducible el plan.
