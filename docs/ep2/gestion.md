# EP2: gestión, participación y decisiones pendientes

Registro documental revisado el 2026-10-25. Complementa el tag publicado; no cambia automáticamente el estado de los issues ni constituye un tablero GitHub Projects.

## Participación verificable

La distribución declarada por el equipo se mantiene: Matías Villegas, DevSecOps/gestión; Matías Ignacio Romero Alvarez, desarrollo fullstack. Estas referencias acreditan contribuciones concretas, no horas trabajadas, porcentajes ni igualdad de esfuerzo.

| Integrante / cuenta | Evidencia pública | Contribución comprobable |
| --- | --- | --- |
| Matías Villegas / `TheVillegas` | [PR #86](https://github.com/TheVillegas/StockAware/pull/86), merge `238669b` | Pipeline de despliegue real, salud y observabilidad inicial |
| Matías Villegas / `TheVillegas` | [PR #87](https://github.com/TheVillegas/StockAware/pull/87), merge `fb36902` | Especificación adaptativa preliminar, documentación e integración HTTP |
| Matías Ignacio Romero Alvarez / `Sptfff` | [PR #88](https://github.com/TheVillegas/StockAware/pull/88), merge `4a7b161` | Orígenes fijos de robots.txt y pruebas de rechazo sin petición |
| Matías Ignacio Romero Alvarez / `Sptfff` | [Revisión de #90](https://github.com/TheVillegas/StockAware/pull/90), aprobación 2026-10-25 | Revisión de la promoción a main antes del squash |

Cada integrante debe poder explicar su parte y la integración. Este registro no afirma que la presentación o defensa ya se haya realizado.

## Índice de gestión

El [listado de issues del repositorio](https://github.com/TheVillegas/StockAware/issues) permite revisar responsables y seguimiento. Snapshot de la auditoría, no sincronización automática:

| Seguimiento | Responsable registrado | Estado observado / revisión necesaria |
| --- | --- | --- |
| [#45](https://github.com/TheVillegas/StockAware/issues/45), [#46](https://github.com/TheVillegas/StockAware/issues/46), [#47](https://github.com/TheVillegas/StockAware/issues/47), [#48](https://github.com/TheVillegas/StockAware/issues/48) | `Sptfff` | Abiertos; la aplicación integrada contiene recuperación, procesamiento, persistencia y panel; revisar aceptación antes de cerrar |
| [#49](https://github.com/TheVillegas/StockAware/issues/49) | `Sptfff` | Abierto; medición real documentada, con límites explícitos |
| [#50](https://github.com/TheVillegas/StockAware/issues/50) | `Sptfff` | Abierto; especificación preliminar publicada, no motor final |
| [#51](https://github.com/TheVillegas/StockAware/issues/51) | `TheVillegas` | Abierto; staging comprobado, falta adjuntar muestra sanitizada de petición/falla de fuente |
| [#52](https://github.com/TheVillegas/StockAware/issues/52) | `TheVillegas` | Abierto; tag publicado, falta prueba completa de demostración y cierre documental |
| [#58](https://github.com/TheVillegas/StockAware/issues/58) | Ambos integrantes | Abierto; Figma queda pendiente por instrucción del equipo |
| [#77](https://github.com/TheVillegas/StockAware/issues/77) | `Sptfff` | Cerrado; corrección integrada por #88 y publicada en el corte |

**Falta el enlace al tablero real usado por el equipo y comprobar su acceso docente.** No se inventa una URL ni se da por cumplido ese requisito con este índice. Si el tablero existe fuera del repositorio, incorporarlo con sus permisos correctos; no compartir credenciales.

## Autorización de infraestructura equivalente

El curso permite Terraform o una herramienta equivalente previamente autorizada. `render.yaml` describe el staging real; `infrastructure/terraform/staging/main.tf` contiene recursos preliminares `null_resource` que no crean servidores. Un plan verde o la aprobación de la fuente web no prueban autorización de equivalencia.

Solicitud preparada, **no enviada**:

> Para la EP2 usamos Render Blueprint (`render.yaml`) como definición reproducible del staging de frontend, NestJS, FastAPI y PostgreSQL. El pipeline despliega un commit concreto y verifica salud/versiones. Terraform sigue siendo una definición preliminar no aplicada. ¿Puede confirmar la autorización de Render Blueprint como herramienta equivalente para este requisito, o indicar el ajuste requerido antes de la entrega?

Adjuntar la respuesta real y su fecha al obtenerla. Hasta entonces, la equivalencia sigue pendiente de evidencia; no se atribuye al docente una aprobación inexistente.

## Acciones del equipo antes de entregar

1. Ejecutar y registrar la [demo](entrega.md) del tag con su persistencia y escenario de error.
2. Aportar enlace/acceso al tablero y confirmar el registro de contribuciones.
3. Adjuntar autorización de equivalencia o resolver el requisito de infraestructura con el docente.
4. Ensayar el [guion breve](presentacion.md) y comprobar staging antes de presentar.
5. Actualizar Figma por separado y verificar su acceso; sigue pendiente, no se reemplazó su enlace EP1.
