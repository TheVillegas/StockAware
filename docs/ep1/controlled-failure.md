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

## Captura observada

La imagen muestra el resumen del run, no el log interno del probe. Alcanza para ver `Failure`, el policy probe en rojo y el gate crítico en rojo. No alcanza para leer el mensaje del step. El job de seguridad también está en rojo por el rango vacío, no por un secreto.

![Resumen del fallo controlado](images/ep1-fallo-controlado.png)

Run: https://github.com/TheVillegas/StockAware/actions/runs/36371534531
