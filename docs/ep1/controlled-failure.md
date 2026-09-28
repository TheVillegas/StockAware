# Demo EP1: fallo controlado del gate

Esta nota registra un fallo intencional y desechable del pipeline. No es un pipeline verde, no es un hallazgo de secretos y no reemplaza la [guía de reproducibilidad](reproducibility.md). Las capturas, si se agregan, son apoyo. La evidencia principal es el run de GitHub Actions, que se puede volver a abrir.

## Run observado

El 28 de septiembre de 2026 se disparó una sola vez `workflow_dispatch` sobre `develop` en `14f22fb709a3426f3cd5383e65f07aacea65e5a5`, con `exercise_failure=true`.

- Run: https://github.com/TheVillegas/StockAware/actions/runs/36371534531
- Conclusión del run: `failure`
- `CI policy probe`: `failure`. El step pide el fallo y termina con código 1. El mensaje esperado es `Controlled failure probe requested; CI critical gate must fail.`
- `CI critical gate`: `failure`. El gate no dejó pasar el flujo cuando un control aplicable falló.
- `CI PostgreSQL integration`: `skipped`, igual que en el push verde anterior. Un job salteado no cuenta como aprobado.

Ese probe no introduce vulnerabilidades ni secretos. No lo presentes como análisis de seguridad ni como el estado normal de `develop`. El push del mismo commit, sin el probe, está en https://github.com/TheVillegas/StockAware/actions/runs/36356334121 y concluyó `success`.

## El job de seguridad de ese dispatch no es un secreto

En el mismo run, `CI security` también falló. La causa observada en el log no es un secreto detectado. El dispatch corrió sobre `develop`, que es la base de integración, así que el rango de escaneo quedó vacío y el script rechazó la corrida:

`Secret-scan feature range is empty; refusing to scan an indeterminate change`

No uses la captura de `CI security` como evidencia de un secreto expuesto. Si hace falta mostrarla, el epígrafe tiene que decir que el rango estaba vacío.

## Dónde van las imágenes

Todavía no hay capturas en el repositorio. No se inventan. Cuando existan, van en `docs/ep1/images/` y se enlazan desde esta sección. Cada archivo tiene que mostrar lo que dice la tabla, y el epígrafe tiene que incluir la URL del run.

| Archivo previsto | Qué tiene que mostrar | Qué no debe implicar |
|---|---|---|
| `docs/ep1/images/ep1-controlled-failure-run.png` | La página del run 36371534531 con conclusión `failure` | Que `develop` esté rojo en un push normal |
| `docs/ep1/images/ep1-policy-probe.png` | El step del policy probe con el mensaje de fallo controlado y exit code 1 | Un scanner de vulnerabilidades |
| `docs/ep1/images/ep1-critical-gate.png` | `CI critical gate` en `failure` | Que el fallo sea un secreto o un deploy |

Hasta que esos archivos existan, esta página no los enlaza. Un enlace roto no es evidencia.
