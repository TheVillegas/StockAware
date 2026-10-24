# Métrica de calidad de datos de precios de mercado (#49)

Fecha de la medición: 2026-10-24. Resultado: [`resultado-2026-10-24.json`](resultado-2026-10-24.json).
Definición aprobada: [`../decisiones-implementacion.md`](../decisiones-implementacion.md), sección 2.

## Justificación

Los precios de mercado vienen de 5 fuentes web que el ERP no controla. Antes de mostrarlos a una persona interesa saber qué parte de lo que entregan las fuentes cumple las reglas de datos del ADR 0002 y cuántos materiales del ERP terminan con al menos un precio. La métrica responde las dos preguntas con conteos que se pueden repetir:

- **Tasa de registros válidos por fuente** (principal): `válidos / devueltos`. Corresponde al ejemplo "porcentaje de registros válidos" de la rúbrica y reutiliza las reglas ya definidas en #27, sin reglas nuevas.
- **Cobertura** (complementaria): porcentaje de materiales del conjunto con al menos un precio válido. Deja a la vista la brecha aceptada: el catálogo es mayormente EPP y las fuentes cubren sobre todo material eléctrico, herramientas, oficina y tecnología.

### Qué cuenta como "registro que devuelve FastAPI"

FastAPI lee el contenido de cada fuente, descarta lo que no se puede interpretar o no se relaciona con el material (puntaje 0) y entrega **como máximo 5 candidatos por fuente**. Para la métrica:

| Término | Definición |
| --- | --- |
| Devueltos | Candidatos que FastAPI entrega en `candidatos` para una fuente y un material, antes de la validación de NestJS. |
| Válidos | Devueltos que pasan `validaCandidato` (la validación de NestJS al guardar): campos requeridos y tipos, `precio_normal` entero ≥ 1, nombre no vacío, URL `https` del dominio de la fuente, `precio_oferta` no mayor que `precio_normal`. |
| Inválidos por regla | Devueltos que no pasan, contados por la primera regla que incumplen: `esquema`, `nombre_vacio`, `url_fuera_de_fuente`, `oferta_mayor_normal`. |
| Descartados de FastAPI | Campo `descartados` de FastAPI: registros ilegibles, sin relación con el material o que no entraron en los 5 primeros. Se informa como contexto y **no entra en la tasa**: FastAPI no separa los ilegibles de los sin relación. |

Se eligió medir sobre los candidatos devueltos porque es lo único que NestJS recibe y valida. Contar también los descartados mezclaría el filtro de relevancia (puntaje) con la validez del dato.

## Conjunto evaluado

[`conjunto.json`](conjunto.json): 32 materiales cotizables de la réplica del ERP, cada uno con `cod_material`, nombre, rubro y el motivo por el que se eligió. Los nombres son datos de catálogo (productos), no datos personales.

| Rubro | Materiales | Criterio |
| --- | --- | --- |
| Electricidad y herramientas | 8 | Rubro que cubren Dartel, Dimeiggs, Rhona y Sodimac. |
| Herramientas | 5 | Ídem. |
| Oficina y papelería | 6 | Rubro de Dartel y Dimeiggs. |
| Tecnología | 6 | Rubro de SoloTodo. |
| EPP | 7 | Rubro mayoritario del catálogo; expone la brecha de cobertura. |

**Rhona y Sodimac** solo se leen con la URL de un listado de categoría (el buscador de Sodimac está prohibido por su robots.txt). El conjunto trae `url_rhona` y/o `url_sodimac` solo en los materiales cuya categoría existe en esa fuente: 7 materiales con Rhona y 10 con Sodimac. Los demás materiales **no se consultan** en esa fuente (`sin_url`) y no entran en su tasa. Esas URL reemplazan lo que en producción asocia una persona con `PUT /api/precios/:codMaterial/fuente-url`.

## Procedimiento

Requisitos: el stack de Compose con `db` e `intelligence` arriba (`docker compose up -d`). El runner no usa la base; solo necesita FastAPI en `INTELLIGENCE_SERVICE_URL` (por defecto `http://localhost:8000`).

```bash
cd apps/backend
npm run metrica:precios
```

El comando compila (`nest build`) y ejecuta `dist/precios/metrica/medir.js`, que escribe `docs/ep2/metrica/resultado-<fecha>.json`. Acepta dos argumentos opcionales: ruta del conjunto y ruta de salida.

Por cada material, en orden y de a uno:

1. `IntelligenceService.preparar` obtiene el término de búsqueda y si es cotizable (los no cotizables se cuentan aparte).
2. `RecuperadorFuentes` lee las fuentes elegibles con el ritmo acordado: una petición a la vez por fuente, 2 s entre páginas, 10 s por fuente, sin reintento, `User-Agent` identificable y robots.txt.
3. Se llama a `POST /v1/precios/procesar` de FastAPI con el mismo cuerpo y timeout (5 s) que usa NestJS, y se valida la respuesta completa con `validaProcesamiento`.
4. Cada candidato devuelto se valida con las reglas de NestJS y se cuenta.

La corrida es de solo lectura: no escribe precios ni vínculos en la base, y el resultado no incluye contenido de las fuentes, nombres de productos ni precios.

## Resultado (2026-10-24, 69 s)

| Fuente | Materiales consultados | Devueltos | Válidos | Tasa de válidos | Materiales con precio | Sin resultados | Errores | Descartados de FastAPI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dartel | 32 | 35 | 35 | 100 % | 11 | 21 | 0 | 41 |
| Dimeiggs | 32 | 47 | 47 | 100 % | 12 | 20 | 0 | 103 |
| SoloTodo | 32 | 17 | 17 | 100 % | 4 | 28 | 0 | 90 |
| Rhona | 7 (25 sin URL) | 20 | 20 | 100 % | 7 | 0 | 0 | 155 |
| Sodimac | 10 (22 sin URL) | 47 | 47 | 100 % | 10 | 0 | 0 | 756 |

Inválidos por regla: 0 en las cuatro reglas y en las cinco fuentes. Errores de lectura (timeout o HTTP), errores de procesamiento, `invalid_content` y lecturas parciales: 0. Todos los materiales resultaron cotizables.

**Cobertura:** 26 de 32 materiales (81,3 %) con al menos un precio válido.

| Rubro | Con precio / materiales | Cobertura |
| --- | --- | --- |
| Electricidad y herramientas | 8 / 8 | 100 % |
| Herramientas | 5 / 5 | 100 % |
| Oficina y papelería | 5 / 6 | 83,3 % |
| Tecnología | 4 / 6 | 66,7 % |
| EPP | 4 / 7 | 57,1 % |

## Interpretación

- **La tasa de 100 % es esperable y no prueba que los precios sean correctos.** FastAPI ya descarta lo ilegible antes de devolver candidatos, así que NestJS recibe registros bien formados. La validación de NestJS funciona como segunda red de seguridad: en esta corrida no tuvo nada que atrapar. Un valor distinto de 100 % indicaría un cambio en el formato de una fuente o un fallo del contrato entre servicios.
- **La métrica no mide si el candidato es el producto correcto.** Eso lo mide el puntaje y lo resuelve una persona al confirmar o rechazar el vínculo.
- **Rhona y Sodimac devuelven candidatos en todas las consultas** porque se leen listados de categoría con decenas de productos, donde casi siempre algún nombre comparte una palabra con el material. Por eso su cobertura de 100 % entre los materiales consultados es optimista: los materiales con URL se eligieron porque la categoría existe, y la relación real queda por confirmar. Los 756 descartados de Sodimac reflejan que se leen hasta 3 páginas de listado y se conservan solo 5 candidatos.
- **La cobertura confirma la brecha esperada.** Electricidad y herramientas quedan completos; EPP baja a 57 %. Los 4 EPP con precio son justamente los que tenían URL de listado (3 de Rhona y 1 de Sodimac); botas mineras, lentes y mascarillas, sin listado asociado, quedaron sin precio. El resultado no separa qué fuente aportó cada precio por material.
- **Sin resultados no es falla.** Dartel, Dimeiggs y SoloTodo no devolvieron candidatos relacionados para 20 a 28 de los 32 materiales, lo que es coherente con un catálogo industrial y de marcas específicas.

## Limitaciones

- **Una sola medición.** Es una foto del 2026-10-24; el catálogo y el formato de las fuentes cambian. Repetirla con el mismo comando permite comparar. Una primera corrida del mismo día registró 2 lecturas parciales de Sodimac por timeout (los conteos de válidos y devueltos fueron iguales); el archivo publicado es la segunda corrida, que no tuvo parciales. Los timeouts de las fuentes son parte de la variabilidad.
- **Muestra pequeña y dirigida.** 32 materiales elegidos a mano, no una muestra aleatoria del catálogo. Las tasas no se pueden extrapolar a los ~1.000 materiales del ERP.
- **Precios B2B.** Las fuentes publican precios de lista al público; el ERP compra a precios negociados. La métrica evalúa la calidad del dato, no su 
- **Cobertura parcial del catálogo.** El catálogo es mayormente EPP y ropa técnica, que las fuentes cubren poco.
- **Rhona y Sodimac dependen de URL de listado** elegidas para esta medición. Con otras categorías, la cobertura de esas dos fuentes cambiaría.
- **Máximo 5 candidatos por fuente y puntaje 0 descartado.** La tasa se calcula sobre ese subconjunto; los descartados se informan como contexto, sin separar ilegibles de irrelevantes.
- **Anti-bot y timeouts.** Una fuente que bloquee, tarde más de 10 s o devuelva una página de error se cuenta como error de lectura y sale de la tasa; el 0 de errores de esta corrida no garantiza que se repita.
- **Validación en el runner.** Para clasificar los inválidos por regla, el runner llama a FastAPI directamente (mismo cuerpo y timeout que `IntelligenceService.procesar`) y aplica `validaProcesamiento`; la clasificación por regla vive en `conteo.ts` y una prueba comprueba que coincide con `validaCandidato`.
