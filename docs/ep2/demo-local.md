# EP2: demo local ejecutada

El recorrido navegador → NestJS → fuentes web → FastAPI → PostgreSQL → interfaz se ejecutó el **2026-10-25, America/Santiago**. También se observaron reutilización, rechazo persistente, caída/recuperación de FastAPI y continuidad ante una fuente fallida. Esta evidencia complementaria es posterior al tag; no mueve `v0.2.0-ep2` ni acredita una defensa ya presentada.

## Entorno y procedencia

- Base: main/tag `cc02c2398bac3d2e604bb0613be964d6a9f3fbe8`, árbol `8bffd49c49ef49dda6cadbac356536445d09f94b`.
- Réplica Docker aislada con volumen nuevo y semilla anonimizada. Autorización mediante sudo en terminal visible; sin cambiar grupos, permisos del socket ni sudoers.
- Frontend `http://localhost:4272`, NestJS `http://localhost:3007/api`, FastAPI `http://localhost:8017`; puertos solo en loopback, PostgreSQL sin puerto publicado.
- El puerto 3000 ya estaba ocupado. Se verificaron los 250 archivos del tag: la única diferencia de contenido es la URL de API del frontend, ajustada a `http://localhost:3007/api`. No se afirma identidad byte a byte del frontend desplegado.
- Los registros usan UTC (`2026-10-26T02:24…02:38Z`), todavía 2026-10-25 en Santiago. La interfaz muestra la fecha 26 de los datos; no se alteraron fechas para aparentar vigencia.
- [Procedencia y restauración](evidence/local-2026-10-25/provenance.json), [salud final](evidence/local-2026-10-25/health.json). Las versiones locales informan `local`; no se presentan como prueba de SHA desplegado en Render.

## Resultados observados

| Escenario | Evidencia ejecutada |
| --- | --- |
| Consulta nueva | Login con cuenta de demostración → Stock → buscar `MC_202` → Precios de mercado. La base inicial no tenía observaciones; aparecieron cinco candidatos Dartel: 8516, 301, 978, 461 y 447 CLP. |
| Salto real a Python | Correlación `7bba5784-9ce1-45b0-aab2-57a7b252cb37`: Nest `GET /api/precios/MC_202` 200/1850 ms y FastAPI `POST /v1/precios/preparar` y `/procesar`, ambos 200. |
| Persistencia y recarga | Cinco vínculos/observaciones de `MC_202`, IDs 1–5. Tras recargar y reabrir: HTTP 304/15 ms y mismos resultados; el snapshot intermedio conservó IDs y fechas. Es reutilización, no una segunda extracción. |
| Error de FastAPI | Se detuvo únicamente el FastAPI de esta réplica. `MC_203` devolvió 502/3017 ms y la interfaz mostró “El servicio que procesa los precios no responde. Intenta más tarde.” Se restauró; el reintento devolvió 200/1561 ms. |
| Revisión persistente | En `MC_203` (cinta negra) se rechazó el candidato de cinta roja mediante `PATCH /api/precios/vinculos/8`, 200. Tras recargar no reapareció; SQL conserva `rechazado`, `definido_por: usuario`. La publicación sigue vinculada por separado a `MC_202`. |
| Falla de listado | URLs deliberadamente inexistentes, asociadas solo a `MC_203`: Rhona produjo `http_error`; Sodimac, `invalid_content`. La interfaz mostró el error y posteriormente la pausa de Rhona. No son incidentes acreditados de las tiendas ni categorías reales. |
| Falla reproducible de fuente | Solo en el backend desechable se mapearon temporalmente los hosts Dartel a `127.0.0.1`. `MC_204` mostró el error de Dartel y cinco candidatos Dimeiggs, con respuesta global 200/2503 ms. Se capturó el evento real `fuente_externa`, causa `http_error`, host `www.dartel.cl`, correlación `081105c2-b5be-44c0-a521-660e359572b6`, compartida con Nest y FastAPI. |
| Restauración | Se eliminó el override DNS: inspección final `ExtraHosts: []`; frontend, NestJS/PostgreSQL y FastAPI volvieron a responder 200. Staging y el servicio existente en 3000 no se detuvieron. |

Los candidatos se presentan **SIN CONFIRMAR**: se observaron colores y tipos de producto no equivalentes. Recuperar datos válidos no prueba correspondencia semántica ni autoriza compras automáticas. La revisión humana sigue siendo necesaria.

## Artefactos sanitizados

- [Peticiones y evento de fuente](evidence/local-2026-10-25/requests.jsonl): líneas JSON originales, deduplicadas, con campos permitidos; sin login, JWT, cookies, cuerpos ni encabezados privados. La duración corresponde a la petición principal; el evento de fuente no incluye una duración propia.
- [Base antes](evidence/local-2026-10-25/database-before.txt) y [después](evidence/local-2026-10-25/database-after.txt): consultas de solo lectura que unen material, vínculo, publicación y observación. La consulta posterior de `MC_203` verificó de nuevo publicaciones compartidas; por eso algunos `verificado_en` avanzan sin cambiar `obtenido_en` ni duplicar su observación.
- [Consulta con precios](evidence/local-2026-10-25/market-prices.jpg), [error de FastAPI](evidence/local-2026-10-25/upstream-error.jpg), [continuidad ante falla de Dartel](evidence/local-2026-10-25/source-error.jpg).

No se capturó un evento estructurado de fuente para las fallas de Rhona/Sodimac de este ensayo. Algunas ramas de rechazo de redirección, tamaño o contenido persisten la falla sin emitir ese evento. No se reconstruyeron logs desde SQL; la muestra estructurada de fuente corresponde exclusivamente al bloqueo controlado de Dartel.

## Límites y repetición

La prueba se realizó en navegador integrado, viewport 1280×720. Identidad/ruta correctas, contenido no vacío, sin overlay y sin advertencias/errores relevantes en la consulta de consola disponible. No se probó móvil, otros navegadores, confirmación positiva de candidatos ni todos los permisos/perfiles. El control de navegador se hizo con CUA; el plugin Browser específico no estaba disponible.

Los dos primeros arranques fallaron por permisos restrictivos del archivo extraído y un puerto ocupado. Se corrigió únicamente la copia desechable y se repitieron los health checks antes de probar; no se atribuyen esos fallos al tag.

Para ensayar otra vez, usar el [recorrido](entrega.md#recorrido-funcional-comprobable) con una réplica aislada; los precios y las respuestas comerciales pueden cambiar. No borrar datos ni detener staging para forzar un escenario. La instancia local quedó encendida para el ensayo, con las fallas temporales restauradas; `MC_203` conserva sus URLs deliberadamente inválidas y las pausas de fuentes pueden seguir vigentes en esa base de prueba.

Quedan las [acciones humanas](gestion.md#acciones-del-equipo-antes-de-entregar): verificar tablero, acreditar equivalencia de infraestructura, presentar/defender y actualizar Figma. Esta ejecución no resuelve esos puntos.
