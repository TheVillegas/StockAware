# EP2: evidencias verificadas y cierre pendiente

Estado revisado el 2026-10-26. Este documento complementa el corte publicado: fue preparado después de `v0.2.0-ep2` y no se afirma que forme parte de ese tag. La etiqueta no se mueve. El paquete anterior de demo ya está adjunto a la release; los ajustes actuales de Figma/gestión/infraestructura todavía son locales.

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
| Persistencia | Verificada en demo local y CI | [Registro SQL y recarga](demo-local.md), además del [job PostgreSQL 121326645647](https://github.com/TheVillegas/StockAware/actions/runs/40245633645/job/121326645647) |
| Demo completa | Ejecutada localmente | [UI→fuente→Python→base→UI](demo-local.md), rechazo persistente y error/recuperación; no equivale a defensa realizada |
| Logs de petición/fuente | Muestra local registrada | [JSONL sanitizado](evidence/local-2026-10-25/requests.jsonl): petición real correlacionada y falla de Dartel provocada solo en la réplica |
| Presentación breve | Material preparado | [Guion](presentacion.md); no se afirma que ya se haya presentado |
| Participación | Registro consolidado | [Contribuciones públicas](gestion.md#participación-verificable); no acredita horas ni reemplaza la explicación individual |
| Tablero | Uso real acreditado; enlace/acceso pendientes | [Eventos Projects v2](gestion.md#github-projects-actividad-comprobada-enlace-directo-pendiente) de #51, #52 y #77; no exponen la URL del proyecto |
| Infraestructura equivalente | Técnica acreditada; autorización académica pendiente | [Blueprint y pipeline reales](infraestructura.md); Terraform sigue `defined-not-deployed`; no hay respuesta docente adjunta verificada |
| Figma | EP2 actualizado; acceso docente por confirmar | [Siete pantallas editables y flujo navegable](prototipo.md), con EP1 intacto; abierto en navegador sin solicitud de inicio de sesión |

## Qué prueba el CI HTTP

El registro del job de main identifica Python **3.13.7**, Node **22.23.3** y:

```text
# tests 8
# pass 8
# fail 0
```

Comprueba preparación, procesamiento y deduplicación, validación pública, contenido inválido, fallas FastAPI/502, propagación de correlación a logs reales y upstream detenido. No llama a tiendas reales ni autentica un navegador o escribe PostgreSQL. Las 45 pruebas Python también aprobaron; el job informó dos advertencias.

## Reproducción local

El primer intento quedó limitado por permisos de Docker y por la ausencia de Python 3.13/PostgreSQL nativos. Después, con autorización explícita, se abrió una terminal visible de Omarchy para sudo y se levantó una réplica Docker aislada. No se cambió el grupo Docker, el socket ni sudoers, y no se reutilizó otro contexto remoto o secretos de staging.

La [demo local](demo-local.md) registra las acciones, resultados, configuración de puertos, procedencia del tag, capturas, SQL y logs. Las ocho pruebas HTTP no se volvieron a lanzar en los intérpretes nativos incompatibles; su resultado verificado sigue siendo el CI de main. No confundir esa suite con la nueva prueba de navegador ejecutada contra contenedores.

Para repetir: usar un entorno local autorizado, sin copiar secretos de staging. Compose usa nombres fijos `erp-*`; un nombre de proyecto distinto no basta para evitar colisiones. No borrar volúmenes existentes. Usar la réplica anonimizada y las cuentas exclusivamente locales de la [guía](../ep1/reproducibility.md), sin incluir sus claves en evidencias.

## Alcance del registro

El [registro ejecutado](demo-local.md) conserva:

1. Tag/SHA, fecha, entorno y material consultado; separar recuperación nueva de reutilización de caché.
2. Solicitud frontend a NestJS y salto a FastAPI, sin JWT, cookies ni encabezados de autorización.
3. Correspondencia del material con publicaciones/observaciones persistidas; recarga que conserve el resultado.
4. Resultado visible, procedencia y estado de fuente; captura sanitizada como complemento, no única prueba.
5. Escenario de error sin derribar staging y logs de petición/fuente con correlación y duración.

La demo local y sus logs ya están publicados como [paquete complementario de la release](https://github.com/TheVillegas/StockAware/releases/tag/v0.2.0-ep2). La actualización visual de Figma está realizada. Siguen pendientes el enlace/acceso del tablero, confirmar acceso docente al prototipo y acreditar la equivalencia académica. La defensa está fuera de esta actualización. La [gestión](gestion.md) concentra el cierre externo y la consulta docente preparada, todavía sin enviar.
