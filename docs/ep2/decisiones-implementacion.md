# Decisiones de implementación de la EP2

Actualizado: 2026-10-24

Este documento complementa la propuesta aprobada en el issue #27 ([fuentes](https://github.com/TheVillegas/StockAware/issues/27#issuecomment-6358618260) y [contrato](https://github.com/TheVillegas/StockAware/issues/27#issuecomment-6359412429)). Registra las definiciones que faltaban para implementar los issues #45 a #49. Lo que ya fija #27 no se repite aquí.

## 1. Forma de trabajo

- La implementación se hace en ramas propias que salen de `develop`, una por PR, apiladas cuando una depende de la anterior.
- Los PR quedan preparados con título y descripción, pero no se suben ni se abren hasta que el responsable los revise.
- Si un PR no se puede preparar, se deja definido su alcance, sus archivos y sus pruebas para hacerlo cuando se apruebe.

## 2. Métrica de calidad (#49)

| Elemento | Definición |
| --- | --- |
| Métrica principal | Tasa de registros válidos por fuente: registros que pasan la validación de NestJS sobre el total de registros que devuelve FastAPI para esa fuente. |
| Métrica complementaria | Cobertura: porcentaje de materiales del conjunto evaluado con al menos un precio. |
| Conjunto evaluado | Un conjunto fijo de unos 30 materiales cotizables del ERP, escrito en el repositorio para que la medición se pueda repetir. |
| Procedimiento | Una corrida real contra las 5 fuentes aprobadas. |

Justificación: usa las reglas de validación ya definidas en #27, se puede repetir y corresponde al ejemplo "porcentaje de registros válidos" de la rúbrica. La cobertura deja visible la brecha aceptada: el catálogo es mayormente EPP y ropa técnica, y las fuentes cubren sobre todo material eléctrico, oficina y tecnología.

## 3. Endpoints de escritura (#47 y #48)

El diseño de #27 exige acciones de una persona que el contrato no definía. Se incluyen en la EP2.

**NestJS (#47), con JWT:**

| Endpoint | Uso |
| --- | --- |
| `PATCH /api/precios/vinculos/:id` | Cambia `estado` a `confirmado` o `rechazado`. Un vínculo rechazado no se vuelve a proponer. |
| `PUT /api/precios/:codMaterial/fuente-url` | Asocia la URL de Rhona o Sodimac a un material. La URL se valida contra el dominio de la fuente y contra su robots.txt. |
| `PUT /api/precios/:codMaterial/cotizable` | Corrige la marca `cotizable` y la guarda con `definido_por: usuario`. |

**Angular (#48):** botones Confirmar y Rechazar en cada candidato, un campo para pegar la URL de Rhona o Sodimac y un interruptor de "cotizable".

## 4. Permisos y ubicación de la pantalla (#48)

Los permisos viven en la base de la réplica (`acceso_permisos` cruza perfil y función de `acceso_funciones`). Crear una función nueva exigiría insertar filas en la réplica, y #47 pide no alterarla. Por eso se reutilizan permisos existentes y no se agrega una entrada al menú.

| Acción | Permiso |
| --- | --- |
| Ver precios de mercado | `MATERIAL_X_BODEGA`, el mismo de Stock |
| Confirmar o rechazar un vínculo, asociar una URL y marcar `cotizable` | `MOD_MATERIALES`, el permiso de escritura del mantenedor de materiales |

La información se muestra en un panel "Precios de mercado" dentro de Stock, al abrir un material.

## 5. Ritmo de peticiones y robots.txt

- Una petición a la vez por fuente. Las 5 fuentes corren en paralelo entre sí, dentro del tope de 10 s fijado en #27.
- Pausa de 2 s entre páginas de una misma fuente en Rhona y Sodimac. Con el máximo de 3 páginas de Sodimac son 4 s de espera.
- User-Agent identificable: `StockAware/0.1 (+https://github.com/TheVillegas/StockAware)`. No se simula un navegador.
- robots.txt se descarga por fuente, se guarda en memoria por 24 h y se consulta antes de cada URL.
- Una URL de Rhona o Sodimac que robots.txt prohíbe se rechaza al asociarla, con `422` en `PUT /api/precios/:codMaterial/fuente-url`. Así el contrato aprobado no necesita un motivo nuevo.

## 6. Paginación de VTEX (Dartel y Dimeiggs)

Verificado contra la API el 2026-10-24:

- El máximo es 50 productos por llamada (`_from=0&_to=49`). Un rango de 51 o más responde `400 Bad Request`.
- El total de resultados viene en el encabezado `resources`, por ejemplo `0-49/259`.
- Sin parámetros de rango, la API entrega 24 productos.

Decisión: una sola llamada de 50 productos por búsqueda, sin páginas adicionales. FastAPI devuelve como máximo 5 candidatos por fuente, así que leer más no mejora el resultado.

## 7. Vigencia de SoloTodo

- Solo se aceptan publicaciones con `active_registry` presente y con su última actualización de precio dentro de los últimos 14 días.
- Una publicación más antigua se descarta. Si no queda ninguna, la fuente informa `sin_resultados`, no una falla.

Justificación: la vigencia local de un precio es de 1 semana. Un precio que SoloTodo no actualiza hace más de dos semanas no sirve como precio actual.
