# ADR 0003: motor de recomendaciones de reposición explicable

## Estado

Propuesto para la entrega final (BE-01 de [pendientes del backend](../../ef/pendientes/backend.md#be-01)). Los pesos y umbrales son una primera versión: se validan con el equipo y con la evaluación de QA-01 antes de darlos por definitivos.

## Contexto

La rúbrica EF pide una adaptación funcional y verificable: variables justificadas, una decisión útil que se explique, control del usuario y consideración de sesgos y privacidad. La [especificación adaptativa de la EP2](../../ep2/especificacion-adaptativa.md) definió las entradas candidatas, pero no implementó ningún motor. Hasta ahora el orden de reposición venía de reglas fijas del frontend (`sortByStockRisk`, `suggestedOrderQty` y `coverageDays` en `apps/frontend/src/app/shared/consulta.js`).

## Decisión

### Dónde vive el motor

El puntaje se calcula en FastAPI (`POST /v1/recomendaciones/ranking`), porque la pauta (secc. 4) le asigna a Python el procesamiento adaptativo. NestJS (`GET /api/recomendaciones`) reúne los datos autorizados, llama a FastAPI, valida la respuesta, guarda cada recomendación y degrada a la regla base. Es el mismo reparto que en los precios externos (ADR 0002). El frontend nunca llama a FastAPI.

*Alternativa descartada:* calcular el puntaje en NestJS. Era más simple, pero contradice la asignación de responsabilidades de la pauta y duplicaría la lógica de los datos web.

### Puntaje explicable

Es una suma de factores con peso, sin IA generativa ni aprendizaje automático. Cada factor da un valor entre 0 y 1:

| Factor | Peso | Cálculo | Faltante si |
| --- | --- | --- | --- |
| `cobertura_dias` | 0,4 | `1 - cobertura/30`, con cobertura = stock / consumo diario anual | No hay consumo |
| `bajo_minimo` | 0,3 | `(mínimo - stock) / mínimo` | Mínimo nulo o 0 |
| `consumo_reciente` | 0,15 | `(consumo 30 días / consumo anual) / 2` | No hay consumo anual |
| `variacion_precio` | 0,15 | `-variación × 2`: un precio externo más bajo que el último pagado sube la prioridad | Falta el último precio (`ultimo_precio_pagado`) o un precio externo de menos de 7 días (`precio_externo_vigente`) |

- **Datos faltantes:** un factor sin datos suma 0 y se informa en `factoresFaltantes`. Sin datos no significa precio cero, y no se inventa cobertura sin consumo.
- **Cantidad sugerida:** es la de la regla base, así que el motor cambia el orden, no la cantidad.
- **Empates:** conservan el orden de la regla base.
- **Por qué esos pesos:** el riesgo de quiebre (cobertura y mínimo) pesa el 70 %, porque la especificación de la EP2 lo define como la base. El precio es contexto de compra y por eso pesa poco. Un precio menor no justifica reemplazar un EPP sin aprobación técnica.

### Control del usuario y modo base

- `modo=base` devuelve exactamente la regla actual, para compararla con el motor (QA-01).
- `POST /api/recomendaciones/:id/decision` registra si la persona aceptó, ajustó (con cantidad) o rechazó una recomendación, y su motivo. El sistema solo propone y nunca emite compras.

### Degradación

Si FastAPI no responde, devuelve un error o un formato inválido, la API responde `200` con `degradado: true` y el orden de la regla base. Es el mismo patrón que los precios desactualizados en `consulta.service.ts`.

### Persistencia sin FK hacia la réplica

Las recomendaciones (`recomendaciones.recomendacion`) y las decisiones (`recomendaciones.recomendacion_decision`) viven en un esquema propio. Guardan `id_usuario` y `cod_material` con índices, sin FK a `public`. Hay dos razones: `materiales.cod_material` no es único, y la recarga de la réplica vacía `public`. Es el mismo criterio que `precios_externos`. La única FK es de la decisión hacia su recomendación, dentro del esquema.

*Alternativa descartada:* FK reales a `usuarios` y `materiales`. Dan más integridad, pero rompen o bloquean la recarga de la réplica.

### Permiso propio

Ambas rutas exigen `@Requiere('RECOMENDACIONES')`. La migración agrega la función (`FUNCION`, fuera del menú) y la concede a los perfiles que ya tienen `MATERIAL_X_BODEGA` activo. Las concesiones que ya existen no se tocan.

Esto cambia la decisión de la EP2 de reusar códigos existentes ([decisiones de implementación](../../ep2/decisiones-implementacion.md)), porque la pauta exige que un token válido no dé acceso a todo. Como la recarga de la réplica vacía `acceso_funciones` pero no `migraciones_typeorm`, un paso idempotente al arrancar vuelve a sembrar la función solo si falta, y nunca devuelve un permiso que un administrador quitó.

## Sesgos y privacidad

- **Datos personales:** el motor no usa ninguno. El usuario solo se guarda para trazar quién decidió.
- **Sesgo hacia lo más consumido:** el consumo histórico favorece a los materiales de alta rotación, y un material nuevo sin consumo queda abajo. Esto se mitiga declarando `cobertura_dias` como faltante en vez de inventarla.
- **Cobertura parcial del catálogo:** los precios externos cubren mal ciertos rubros, como el EPP. El factor de precio pesa poco y se marca como faltante cuando no hay dato.

## Consecuencias

- La utilidad todavía no está demostrada: queda pendiente la evaluación contra la regla base (QA-01) usando las decisiones guardadas.
- Cada consulta guarda hasta 500 filas. Si el volumen crece, hará falta una política de limpieza.
- El SQL de la migración y del repositorio se valida en el CI contra Postgres (`db:migrate:ci`). No se pudo probar localmente.
