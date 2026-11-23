# Rollback seguro de staging

**No ejecutar un rollback hasta identificar un SHA anterior compatible con la base actual y contar con autorización explícita.** Un deploy anterior no revierte datos ni garantiza compatibilidad. Si la compatibilidad, la recuperación de datos o la salud no están claras, detenerse y escalar; no vaciar, importar ni restaurar la base como solución improvisada. Este documento no autoriza cambios en Render.

## Antes de decidir

1. Registrar incidente, hora, responsable, servicios afectados, SHA actual y SHA completo candidato, además de los IDs/enlaces de los deploys y la última versión sana verificable. Confirmar que el candidato existe y contiene las tres aplicaciones y sus configuraciones de build. No asumir que el SHA de un servicio identifica el frontend.
2. Comparar cambios de esquema, migraciones, datos y contratos entre ambos cortes; comprobar que el código anterior puede leer y escribir la base **actual** y que API, FastAPI y web son compatibles entre sí. Revisar variables, secretos, dependencias y configuración sin revelar sus valores. Documentar evidencia de compatibilidad y plan de recuperación aprobado; si se requiere migración inversa o restauración, detenerse para una decisión y procedimiento separados. Verificar respaldo y restaurabilidad sin tocar los datos actuales.
3. Revisar `render.yaml` y el arranque del SHA elegido: en este corte Nest usa `/app/database/render-start.sh`, que ejecuta `load-replica.mjs` antes del servidor. Según [staging EP2](../ep2/staging.md), si existe esquema sin marca `replica_carga`, la carga vacía y recarga tablas: **no reiniciar ni desplegar** hasta verificar el estado de la marca y el comportamiento del candidato con responsables de datos. PostgreSQL free puede caducar; comprobar disponibilidad y ventana de mantenimiento. No exponer la base ni copiar credenciales.
4. Acordar ventana, responsables, comunicación, criterios de parada y recuperación. El staging actual está administrado por Blueprint; el candidato IaC `c4485d5` tiene evidencia Terraform validate/mock separada, sin import/apply. No superponerlo ni cambiar la propiedad de recursos durante el rollback.

## Procedimiento controlado, solo tras autorización

1. Pausar cambios concurrentes y registrar el SHA completo elegido. El mecanismo existente `.github/scripts/desplegar-staging.sh` solicita a Render un deploy de `STAGING_SHA` para API, intelligence y web, espera cada deploy `live` y comprueba salud. Es una operación real con credenciales y efectos externos, **no ejecutarla para el ensayo local**. Usar el mecanismo aprobado por el equipo, con secretos en el almacén autorizado, nunca en consola, comandos compartidos o evidencia. Preparar respuesta ante despliegue parcial: el script crea los tres antes de esperar y no revierte automáticamente los ya creados.
2. Registrar IDs, estados y SHA de cada deploy, incluyendo web, y confirmar que corresponden al candidato. Si falla o queda parcial, no declarar éxito: detener cambios y escalar con el estado por servicio. No asumir atomicidad ni repetir sin investigar.
3. Tras arranque y posible espera por cold start, comprobar HTTP 200 de web; Nest `/api/health` debe tener `estado: ok`, `servicio: erp-backend`, `postgres: ok` y `version` exactamente igual al SHA; FastAPI `/health` debe tener `status: ok`, `service: intelligence-service` y ese mismo `version`. La puerta existente compara JSON y SHA, no comprueba por sí sola HTTP, web ni identidad de la versión web. `postgres: ok` solo prueba conectividad (SELECT 1), no compatibilidad funcional o integridad.
4. Con permiso y datos de prueba, verificar una operación de lectura/escritura apropiada y el flujo de fuentes externas sin provocar tráfico no autorizado; revisar fallas, degradación y recuperación por fuente. Health verde no demuestra disponibilidad ni corrección de proveedores. Si cualquier requisito falla, declarar rollback no verificado, conservar evidencia sanitizada y escalar; no presentar el resultado como sano.
5. Registrar hora, SHA resultante por servicio, IDs/enlaces, controles y aprobación; comunicar estado y continuar monitoreo. Si no se identifica versión web mediante evidencia de deploy, dejarla como no verificada.

## Observabilidad y muestra

Correlacionar petición y fallo por `correlation_id`, estado y duración; revisar tendencias de latencia/errores y fallos de fuente. Antes de compartir, aplicar lista permitida y retirar credenciales, cookies, tokens, cuerpos, query strings y datos sensibles; no confiar solamente en redacción automática. La siguiente muestra es **de una réplica local anterior**, no de Render ni de este ensayo ([origen y límites](../ep2/demo-local.md), [JSONL](../ep2/evidence/local-2026-10-25/requests.jsonl)):

```json
{"time":"2026-10-26T02:37:36.072Z","nivel":"error","evento":"fuente_externa","correlation_id":"081105c2-b5be-44c0-a521-660e359572b6","fuente":"dartel","causa":"http_error","host":"www.dartel.cl"}
{"time":"2026-10-26T02:37:38.504Z","nivel":"info","evento":"peticion","correlation_id":"081105c2-b5be-44c0-a521-660e359572b6","method":"GET","path":"/api/precios/MC_204","status":200,"duration_ms":2503}
```

La duración pertenece a la petición, no al evento de fuente; no todas las ramas de falla emiten ese evento. Un 200 global puede coexistir con una fuente fallida.

## Evidencia y límites del ensayo aislado

`python3 -B -m unittest discover -s tests/infrastructure -p 'test_staging_rollback_rehearsal.py' -v` ejecutó una prueba con cuatro escenarios sintéticos en HTTP loopback y archivo temporal descartable, pasando el cuerpo al CLI real `comprobar-salud-staging.py`: SHA incorrecto rechazado (1), API con SHA de rollback aceptada (0), FastAPI con ese SHA aceptada (0), y postgres `error` rechazado (1); stdout/stderr vacíos. El SHA de fixture es `9ceaac1a73daeb5ce4e8f911b4d678c91950176b`. No hubo redeploy simulado ni real: se ejercitó solo el contrato JSON, no HTTP del script de deploy, startup, web, base real, tráfico externo ni rollback end-to-end.

Como evidencia independiente previa, job-5 observó web HTTP 200, FastAPI y Nest saludables y postgres ok, con ambos SHA API exactamente `9ceaac1a73daeb5ce4e8f911b4d678c91950176b`. No acredita SHA web, candidato final desplegado, rollback, fuentes externas ni logs actuales. Para cerrar la evidencia operativa faltan autorización, compatibilidad y recuperación de datos verificadas, deploy/rollback real controlado con versión de cada servicio, health y flujo funcional posterior, fuentes y registros sanitizados actuales. No se ejecutaron import, apply ni cambios en servicios vivos.
