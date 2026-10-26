# EP2: evidencias verificadas y cierre pendiente

Estado revisado el 2026-10-25. Este documento complementa el corte publicado: fue preparado después de `v0.2.0-ep2` y no se afirma que forme parte de ese tag. La etiqueta no se mueve.

## Corte y alcance

| Referencia | Identidad verificable |
| --- | --- |
| Release evaluable | [v0.2.0-ep2](https://github.com/TheVillegas/StockAware/releases/tag/v0.2.0-ep2), release `423732178`, publicada, no borrador ni prerelease |
| Main | `cc02c2398bac3d2e604bb0613be964d6a9f3fbe8`, squash aprobado en [#90](https://github.com/TheVillegas/StockAware/pull/90) |
| Develop desplegado | `4a7b16186738ab21fbcdb300d06e8a1bc7828087` |
| Árbol común | `8bffd49c49ef49dda6cadbac356536445d09f94b`; misma aplicación, no mismo SHA |

## Matriz de requisitos

| Punto | Estado | Evidencia o límite |
| --- | --- | --- |
| Repositorio y tag | Verificado | Release anterior enlazada y tag comprobado por API y git público sobre main |
| CI del corte | Verificado | [Run 40245633645](https://github.com/TheVillegas/StockAware/actions/runs/40245633645), `success`, SHA de main |
| Staging | Verificado para el run | [Run 40243507519](https://github.com/TheVillegas/StockAware/actions/runs/40243507519), job `121320670304`: tres servicios live y salud NestJS/FastAPI/PostgreSQL/web en develop |
| Datos reales y métrica | Verificado con alcance acotado | [Medición 2026-10-24](metrica/README.md): 26/32 materiales con precio (81,3 %), 100 % de candidatos devueltos válidos; no mide precisión semántica ni persiste precios |
| NestJS ↔ FastAPI | Verificado en CI | [Job 121326542791](https://github.com/TheVillegas/StockAware/actions/runs/40245633645/job/121326542791): ocho pruebas HTTP aprobadas |
| Persistencia | Pruebas parciales verificadas | [Job PostgreSQL 121326645647](https://github.com/TheVillegas/StockAware/actions/runs/40245633645/job/121326645647) aprobado; no demuestra por sí solo el recorrido de navegador completo |
| Demo completa | Pendiente de ejecución registrada | Existe el [recorrido](entrega.md#recorrido-funcional-comprobable), no un registro nuevo de UI→fuente→Python→base→UI |
| Logs de petición/fuente | Parcial | CI comprueba correlación real en FastAPI; falta anexar muestra sanitizada de petición y falla de fuente externa |
| Presentación breve | Material preparado | [Guion](presentacion.md); no se afirma que ya se haya presentado |
| Participación | Registro consolidado | [Contribuciones públicas](gestion.md#participación-verificable); no acredita horas ni reemplaza la explicación individual |
| Tablero | Acceso/enlace pendiente | [Índice de gestión](gestion.md) preparado; no se encontró un enlace verificado al tablero real del equipo |
| Infraestructura equivalente | Aprobación pendiente de evidencia | Blueprint existente; Terraform sigue `defined-not-deployed`; no hay autorización docente adjunta verificada |
| Figma | Pendiente por decisión del equipo | Se conserva el enlace EP1, sin presentarlo como EP2 actualizado |

## Qué prueba el CI HTTP

El registro del job de main identifica Python **3.13.7**, Node **22.23.3** y:

```text
# tests 8
# pass 8
# fail 0
```

Comprueba preparación, procesamiento y deduplicación, validación pública, contenido inválido, fallas FastAPI/502, propagación de correlación a logs reales y upstream detenido. No llama a tiendas reales ni autentica un navegador o escribe PostgreSQL. Las 45 pruebas Python también aprobaron; el job informó dos advertencias.

## Intento de reproducción local

No se obtuvo nueva evidencia de ejecución local. El acceso explícito al Docker local `unix:///var/run/docker.sock` devolvió `permission denied`, también al repetir fuera del sandbox. No se cambió el grupo Docker, no se usó sudo ni se reutilizó otro contexto remoto.

No hay servidor PostgreSQL local alternativo disponible. La verificación HTTP tampoco se lanzó: el proyecto requiere Python `>=3.13,<3.14`, pero los intérpretes disponibles son 3.14.8 y 3.12.14, sin un entorno 3.13 existente. Esto es **no ejecutado por entorno**, no una prueba fallida de la aplicación ni un resultado de cero fallas.

Para repetir: habilitar un entorno local autorizado con Docker, o PostgreSQL y Python compatibles, sin copiar secretos de staging. Compose usa nombres fijos `erp-*`; un nombre de proyecto distinto no basta para evitar colisiones. No borrar volúmenes existentes. Usar la réplica anonimizada y las cuentas exclusivamente locales de la [guía](../ep1/reproducibility.md), sin incluir sus claves en evidencias.

## Registro requerido al completar la demo

Anexar únicamente resultados realmente observados:

1. Tag/SHA, fecha, entorno y material consultado; separar recuperación nueva de reutilización de caché.
2. Solicitud frontend a NestJS y salto a FastAPI, sin JWT, cookies ni encabezados de autorización.
3. Correspondencia del material con publicaciones/observaciones persistidas; recarga que conserve el resultado.
4. Resultado visible, procedencia y estado de fuente; captura sanitizada como complemento, no única prueba.
5. Escenario de error sin derribar staging y logs de petición/fuente con correlación y duración.

Hasta obtener ese registro, el requisito de demo permanece abierto. La [gestión](gestion.md) concentra los restantes pasos humanos y la consulta docente lista para enviar.
