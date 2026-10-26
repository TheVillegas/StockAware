# EP2: gestión, participación y decisiones pendientes

Registro documental revisado el 2026-10-26. Complementa el tag publicado; no cambia automáticamente el estado de los issues ni reemplaza el tablero GitHub Projects existente.

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
| [#51](https://github.com/TheVillegas/StockAware/issues/51) | `TheVillegas` | Abierto en la revisión; staging comprobado y [evidencia publicada](https://github.com/TheVillegas/StockAware/issues/51#issuecomment-6407313416) con paquete y checksum |
| [#52](https://github.com/TheVillegas/StockAware/issues/52) | `TheVillegas` | Abierto en la revisión; tag y demo publicados, cierre académico externo todavía pendiente |
| [#58](https://github.com/TheVillegas/StockAware/issues/58) | Ambos integrantes | Abierto en la revisión; [prototipo EP2 actualizado](prototipo.md), sin cerrar automáticamente el issue |
| [#77](https://github.com/TheVillegas/StockAware/issues/77) | `Sptfff` | Cerrado; corrección integrada por #88 y publicada en el corte |

### GitHub Projects: actividad comprobada, enlace directo pendiente

El equipo sí usa Projects v2. Los eventos de GitHub permiten acreditar su actividad, aunque no exponen el identificador ni la URL del proyecto:

| Issue | Evento verificable | Fecha UTC |
| --- | --- | --- |
| #51 | [Añadido al proyecto](https://api.github.com/repos/TheVillegas/StockAware/issues/events/33545272167) y [cambio de estado](https://api.github.com/repos/TheVillegas/StockAware/issues/events/33545272109) | 2026-10-17 |
| #52 | [Añadido al proyecto](https://api.github.com/repos/TheVillegas/StockAware/issues/events/33545272191) | 2026-10-17 |
| #77 | [Cambio de estado en el proyecto](https://api.github.com/repos/TheVillegas/StockAware/issues/events/34210784972) | 2026-10-25 |

**Falta incorporar el enlace directo del tablero existente y comprobar el acceso docente.** El índice público del repositorio no muestra proyectos enlazados; esto no descarta un proyecto privado, no enlazado o de otro propietario. No crear un reemplazo ni ampliar visibilidad para compensar esa limitación. Los eventos prueban uso, no el estado actual, columnas o permisos del tablero.

## Autorización de infraestructura equivalente

El curso permite Terraform o una herramienta equivalente previamente autorizada. La [matriz de infraestructura](infraestructura.md) acredita Blueprint, servicios, base y despliegue real. Terraform contiene recursos preliminares `null_resource` que no crean servidores. Un plan verde o la aprobación de la fuente web no prueban autorización de equivalencia.

Solicitud preparada, **no enviada**:

> Para la EP2 usamos Render Blueprint (`render.yaml`) como definición reproducible del staging de frontend, NestJS, FastAPI y PostgreSQL. El pipeline despliega un commit concreto y verifica salud/versiones. Terraform sigue siendo una definición preliminar no aplicada. ¿Puede confirmar la autorización de Render Blueprint como herramienta equivalente para este requisito, o indicar el ajuste requerido antes de la entrega?

Adjuntar la respuesta real y su fecha al obtenerla. Hasta entonces, la equivalencia sigue pendiente de evidencia; no se atribuye al docente una aprobación inexistente.

## Acciones del equipo antes de entregar

1. Aportar enlace directo/acceso al tablero existente y confirmar el registro de contribuciones.
2. Adjuntar autorización de equivalencia o resolver ese requisito con el docente; no rehacer staging sin esa decisión.
3. Verificar el [Figma EP2](prototipo.md) desde el dispositivo/cuenta de evaluación. EP1 permanece conservado.
4. Integrar estos ajustes documentales mediante el flujo habitual del repositorio, sin mover `v0.2.0-ep2`. El [paquete anterior](https://github.com/TheVillegas/StockAware/releases/tag/v0.2.0-ep2) ya está publicado; estos nuevos ajustes aún son locales.

La defensa está expresamente fuera de esta actualización; el guion y la demo previos no equivalen a una defensa realizada.
