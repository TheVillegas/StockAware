# ADR 0002: precios de mercado desde fuentes web

## Estado

Aceptado para la EP2. Propuesta aprobada en el issue #27.

## Contexto

La EP2 pide recuperar información web, procesarla en FastAPI, integrarla con NestJS, persistirla con procedencia y medir su calidad. En la EP1, FastAPI solo normaliza una descripción local (`POST /v1/materiales/normalizar`) y NestJS lo llama con un timeout de 3 s, sin stub.

El dato que necesita la reposición adaptativa de la entrega final es el precio de mercado de los materiales del ERP. Mercado Público solo refleja compras del Estado, así que no sirve como precio de mercado general.

La evaluación completa de fuentes está en el [primer comentario de #27](https://github.com/TheVillegas/StockAware/issues/27#issuecomment-6358618260) y la propuesta de contrato en el [segundo](https://github.com/TheVillegas/StockAware/issues/27#issuecomment-6359412429). Las definiciones que faltaban para implementar están en [decisiones de implementación de la EP2](../../ep2/decisiones-implementacion.md).

## Decisión

### Fuentes

Cinco fuentes gratuitas, elegidas entre 24 evaluadas:

| Fuente | Rubro | Método | Búsqueda |
| --- | --- | --- | --- |
| Dartel | Material eléctrico, amarras, herramientas | API pública VTEX (JSON) | Automática por término |
| Dimeiggs | Oficina y librería | API pública VTEX (JSON) | Automática por término |
| SoloTodo | Equipos informáticos y tecnología | API pública REST (JSON) | Automática por término |
| Rhona | Material eléctrico, potencia, iluminación | HTML | Solo con una URL asociada al material |
| Sodimac | Ferretería, eléctrico, herramientas, químicos | HTML de categorías | Solo con una URL asociada al material |

Restricciones: se prefiere API sobre HTML, se respeta robots.txt y no se evaden protecciones. Un sitio con anti-bot o desafío JavaScript se descarta. Mercado Libre queda fuera porque exige OAuth con validación del titular, y los vehículos salieron del alcance.

### Reparto de responsabilidades

- **NestJS recupera.** Revisa la vigencia del precio guardado, consulta la fuente si venció, aplica el ritmo de peticiones y robots.txt, y registra la procedencia: fuente, URL, fecha y hora, y estado HTTP.
- **FastAPI procesa sin estado y sin red.** Recibe el contenido crudo, parsea, normaliza, valida, deduplica y propone el cruce con el material del ERP.
- **NestJS valida y persiste** el resultado. Es el único cliente de FastAPI; el frontend nunca lo llama.

La consulta es por material, no una actualización masiva. La vigencia base de un precio es de 1 semana, configurable por fuente.

### Contrato NestJS ↔ FastAPI

| Endpoint FastAPI | Entrada | Salida | Timeout en NestJS |
| --- | --- | --- | --- |
| `POST /v1/precios/preparar` | `cod_material`, `nombre` | `termino_busqueda`, `cotizable`, `motivo` | 3 s |
| `POST /v1/precios/procesar` | El material y el contenido crudo por fuente (`json` o `html`) | Por fuente, hasta 5 candidatos con `id_externo`, `nombre`, `marca`, `ean`, `categoria_fuente`, `precio_normal`, `precio_oferta`, `disponible`, `url` y `puntaje` | 5 s |

El contrato de referencia es el OpenAPI que FastAPI genera desde sus modelos Pydantic. Del lado de las fuentes: 10 s por fuente contando todas sus páginas, sin reintento dentro de la misma búsqueda, las 5 en paralelo y un tope total de 10 s. Sodimac lee como máximo 3 páginas.

Validación en NestJS:

- Respuesta completa inválida: `intelligence_error`.
- Registro inválido: se descarta y se registra. Si todos los de una fuente son inválidos, la fuente queda con `invalid_content`.
- Reglas por registro: `fuente` es una de las 5; `url` pertenece al dominio de la fuente; `nombre` no está vacío; `precio_normal` es un entero en CLP mayor que 0; `precio_oferta` es opcional, mayor que 0 y no supera `precio_normal`; `disponible` es obligatorio; un `ean` que no tiene 8 o 13 dígitos se guarda como `null`.
- La procedencia la registra NestJS. Si FastAPI devuelve otros valores, se ignoran.

### API de NestJS

| Endpoint | Permiso | Uso |
| --- | --- | --- |
| `GET /api/precios/:codMaterial` | `MATERIAL_X_BODEGA` | Precios del material, por fuente |
| `PATCH /api/precios/vinculos/:id` | `MOD_MATERIALES` | Confirma o rechaza un vínculo propuesto |
| `PUT /api/precios/:codMaterial/fuente-url` | `MOD_MATERIALES` | Asocia la URL de Rhona o Sodimac |
| `PUT /api/precios/:codMaterial/cotizable` | `MOD_MATERIALES` | Corrige la marca `cotizable` |

Códigos de `GET`: `200` con precios vigentes o desactualizados, o con `cotizable: false`; `404 material_not_found`; `502` con `sources_unavailable`, `intelligence_unreachable` o `intelligence_error` cuando la actualización falla y no hay nada guardado.

Estado por fuente en la respuesta: `ok` (con `parcial: true` si Sodimac no alcanzó a leer todo), `sin_resultados`, `desactualizada` con `motivo` (`timeout`, `http_error`, `invalid_content` o `cooldown`) y `sin_datos`.

### Persistencia

Esquema aparte `precios_externos`, creado con la primera migración de TypeORM del proyecto. FastAPI no toca la base y el esquema de la réplica no se modifica: el material se referencia por `cod_material`.

| Tabla | Contenido | Duplicados |
| --- | --- | --- |
| `publicacion` | `fuente`, `id_externo`, `url`, `nombre`, `marca`, `ean`, `categoria_fuente`, `activa` | Clave única `(fuente, id_externo)` |
| `observacion_precio` | `precio_normal`, `precio_oferta`, `disponible`, `iva_incluido`, `obtenido_en`, `verificado_en`, `parcial` | Sin cambio de precio ni de stock solo se actualiza `verificado_en` |
| `vinculo_material` | `cod_material`, `publicacion_id`, `puntaje`, `estado`, `definido_por`, `definido_en` | Clave única `(cod_material, publicacion_id)` |
| `material_cotizable` | `cod_material`, `cotizable`, `motivo`, `definido_por` y la URL de Rhona o Sodimac | Una fila por material |
| `falla_consulta` | `fuente`, `url`, `ocurrida_en`, `causa` | No aplica |

Se guarda historial de precios. Las publicaciones no se borran: pasan a `activa = false` cuando una lectura completa de la misma búsqueda no las devuelve. Un vínculo queda `propuesto` hasta que una persona lo confirma o lo rechaza. `iva_incluido` es `true` en Dartel y Dimeiggs y `null` en las demás hasta verificarlo. Queda fuera el contenido crudo, cualquier volcado de las fuentes y cualquier dato personal.

### Indisponibilidad

NestJS nunca inventa un precio. Si la actualización falla, responde con el último precio guardado marcado `desactualizado: true`, con `obtenido_en` y `motivo`. Sin precio guardado responde `502`. Cada falla queda en `falla_consulta` y deja a esa fuente en pausa por 30 minutos; la búsqueda siguiente reintenta solo la fuente vencida.

### Métrica

La métrica principal es la tasa de registros válidos por fuente y la complementaria es la cobertura del conjunto evaluado. El detalle está en las [decisiones de implementación](../../ep2/decisiones-implementacion.md#2-métrica-de-calidad-49).

## Consecuencias

- La cobertura es parcial: el catálogo de la réplica es mayormente EPP y ropa técnica. Los materiales con `LOGO` en el nombre se marcan no cotizables (`personalizado`) y una persona puede corregir la marca.
- Rhona y Sodimac solo entregan datos cuando alguien asocia una URL, porque Sodimac bloquea su buscador en robots.txt.
- Los precios de Dartel y Rhona son de referencia: el precio negociado a empresas puede ser menor.
- El parser HTML se rompe si cambia el diseño de Rhona o Sodimac. La falla queda controlada como `invalid_content`.
- Timeouts y vigencia son valores iniciales y se ajustan con las primeras mediciones reales.

## Qué lo reemplazaría después

Si una fuente agrega anti-bot o cambia sus términos, se retira de la lista en vez de forzarla. Si aparece un producto que ninguna fuente cubre, se evalúa una tienda especializada con los mismos criterios.
