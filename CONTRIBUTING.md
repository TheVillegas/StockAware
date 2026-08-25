# Contribuir a StockAware

Esta guía resume cómo proponer cambios en StockAware, mantener un historial comprensible y revisar el trabajo antes de integrarlo. Para una contribución normal, el flujo es:

1. Registrar el trabajo en un issue.
2. Crear una rama corta desde `develop`.
3. Implementar el cambio con commits [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/).
4. Abrir un pull request hacia `develop` con la plantilla del repositorio.
5. Incorporar la revisión y verificar las pruebas antes de integrar.

## Flujo de ramas

| Rama | Propósito | Origen y destino habitual |
|---|---|---|
| `main` | Estado estable y entregas publicables. | Recibe releases desde `develop` y hotfixes. |
| `develop` | Integración del trabajo aprobado. | Recibe pull requests de las ramas normales. |
| `feat/*` | Nueva funcionalidad. | Se crea desde `develop` y abre PR hacia `develop`. |
| `fix/*` | Corrección de errores. | Se crea desde `develop`, excepto un hotfix que parte de `main`. |
| `docs/*` | Documentación. | Se crea desde `develop` y abre PR hacia `develop`. |
| `chore/*` | Mantenimiento y tareas auxiliares. | Se crea desde `develop` y abre PR hacia `develop`. |
| `refactor/*` | Mejora estructural sin cambiar el comportamiento esperado. | Se crea desde `develop` y abre PR hacia `develop`. |
| `test/*` | Incorporación o ajuste de pruebas. | Se crea desde `develop` y abre PR hacia `develop`. |
| `ci/*` | Automatización e integración continua. | Se crea desde `develop` y abre PR hacia `develop`. |

### Nombres de ramas

Usá minúsculas, palabras separadas por guiones y una descripción breve:

```text
feat/alertas-stock
fix/validacion-cantidad
docs/flujo-contribucion
chore/actualizar-dependencias
refactor/servicio-inventario
test/integracion-inventario
ci/verificacion-calidad
```

No uses espacios, nombres genéricos como `cambios` ni ramas permanentes para trabajo diario.

### Releases y hotfixes

- **Release:** se revisa el estado de `develop` y se abre un PR de `develop` hacia `main`. Después de integrar, se crea un tag de versión sobre el commit publicado en `main`.
- **Hotfix:** se crea una rama `fix/*` desde `main` y se abre un PR hacia `main`. Una vez integrado, el cambio se sincroniza mediante un PR posterior hacia `develop` para evitar que las ramas diverjan.
- No se debe trabajar directamente sobre `main` ni `develop` mediante commits locales compartidos.

## Issues antes de implementar

Cada cambio debe partir de un issue que explique el problema, objetivo o tarea. El issue debería incluir:

- contexto suficiente para entender la necesidad;
- resultado esperado y criterios de aceptación;
- alcance y exclusiones relevantes;
- riesgos o dependencias conocidas.

El pull request debe enlazar el issue relacionado. Si se trata de un hotfix urgente, registrá el issue de inmediato y documentá la urgencia en el PR.

## Commits

Usá el formato de Conventional Commits:

```text
tipo(alcance): descripción breve en imperativo
```

Tipos recomendados para este repositorio:

| Tipo | Uso |
|---|---|
| `feat` | Nueva funcionalidad. |
| `fix` | Corrección de un error. |
| `docs` | Documentación. |
| `chore` | Mantenimiento o configuración. |
| `refactor` | Reestructuración sin cambio funcional intencional. |
| `test` | Pruebas. |
| `ci` | Automatización e integración continua. |

Ejemplos:

```text
feat(inventario): agrega consulta de cobertura
fix(api): valida cantidades negativas
docs(repo): documenta el flujo de ramas
chore(dependencias): actualiza versiones compatibles
```

Cada commit debe representar una unidad de trabajo comprensible y reversible. Incluí las pruebas y documentación relacionadas con esa unidad cuando correspondan; no separes el cambio funcional de la evidencia necesaria para revisarlo.

## Pull requests

Antes de abrir un PR:

- confirmá que el issue relacionado esté enlazado;
- verificá que la rama tenga el prefijo correcto;
- ejecutá las pruebas y validaciones relevantes;
- revisá el diff para eliminar archivos temporales, secretos y cambios fuera de alcance;
- completá `.github/PULL_REQUEST_TEMPLATE.md`.

El destino depende del tipo de trabajo:

- trabajo normal: `feat/*`, `fix/*`, `docs/*`, `chore/*`, `refactor/*`, `test/*` y `ci/*` hacia `develop`;
- release: `develop` hacia `main`;
- hotfix: `fix/*` basada en `main` hacia `main`, seguida de la sincronización hacia `develop`.

El título del PR debe seguir Conventional Commits y su descripción debe permitir entender el propósito, los cambios, la verificación, los riesgos y el plan de reversión.

## Revisión

La revisión debe concentrarse primero en el objetivo y el alcance, y luego en la implementación. Como mínimo, verificá:

- que el cambio resuelva el issue y respete los criterios de aceptación;
- que no introduzca secretos, datos reales ni cambios accidentales;
- que mantenga las convenciones del componente afectado;
- que tenga pruebas suficientes o una justificación explícita;
- que la documentación y los contratos públicos estén actualizados;
- que los riesgos, migraciones y efectos sobre despliegue estén descritos.

Respondé los comentarios de revisión con evidencia. Una vez resueltas las observaciones y aprobadas las verificaciones, el PR puede integrarse según su rama destino.

## Pruebas y verificaciones

Ejecutá los comandos definidos por el componente modificado y registralos en el PR. Según corresponda, verificá:

- frontend Angular/Ionic: instalación, lint, pruebas y build;
- backend NestJS: lint, pruebas unitarias/integración y build;
- servicio FastAPI: formato, lint, pruebas y validación de dependencias;
- PostgreSQL y Docker: configuración, migraciones y levantamiento local;
- Terraform: `terraform fmt -check`, `terraform validate` y revisión del plan;
- GitHub Actions: validación local disponible y revisión de los workflows modificados.

Si una verificación no puede ejecutarse, indicá el motivo y el impacto en la sección correspondiente del PR.

## Releases y tags

Las versiones se publican desde `main` después de integrar un PR de release proveniente de `develop`. Usá tags con el formato de versionado semántico, por ejemplo:

```text
v1.0.0
v1.1.0
v1.1.1
```

El PR de release debe indicar la versión, los cambios incluidos, las verificaciones ejecutadas y cualquier migración o instrucción de despliegue. Los tags deben apuntar al commit estable integrado en `main`.
