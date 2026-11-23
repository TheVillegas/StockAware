# ADR 0004: rollback de staging

## Estado

Propuesto para la entrega final (BE-02 de [pendientes del backend](../../ef/pendientes/backend.md#be-02)). Falta la demostración real, que exige hacer push y desplegar en Render.

## Contexto

La pauta (secc. 10.1) exige volver a una versión estable en estos casos:

- falla el despliegue o el servicio no arranca;
- fallan los health checks;
- aparece un error crítico o una vulnerabilidad grave;
- la base de datos es incompatible.

Ya existían piezas sueltas:

- `desplegar-staging.sh` despliega un SHA por la API de Render;
- `comprobar-salud-staging.py` exige que los health checks reporten ese SHA exacto;
- las migraciones de TypeORM tienen `down`;
- el smoke de BE-10 prueba el flujo funcional.

## Decisión

### Rollback automático en `staging-deploy`

1. **Antes de desplegar:** `sha-en-vivo-staging.py` lee en Render cuál es el commit en vivo del servicio API. En el caso normal es el último SHA sano, pero no está garantizado. Un SHA roto puede quedar en vivo si el rollback se omitió (no había SHA o falló la API de Render), si el propio rollback falló o si se agotó el tiempo del job. En esos casos el run queda en rojo y hay que usar el rollback manual con un SHA que se sepa sano.
2. **Si algo falla después o el job se cancela**, por ejemplo por `timeout-minutes` (el deploy, los health checks o el smoke), el paso `Roll back to the last healthy SHA` vuelve a ejecutar `desplegar-staging.sh` con ese SHA en los tres servicios. Luego comprueba que los health checks reporten el SHA anterior.
3. **El job termina en rojo de todas formas.** Así el run muestra el fallo, el rollback y la salud recuperada, y nadie lo confunde con un despliegue bueno.

**Cuándo no hay rollback:**

- no hay un SHA en vivo, como en el primer despliegue o si la API de Render falló;
- el SHA en vivo es el mismo que se acaba de desplegar.

En los dos casos el job falla igual y se recurre al rollback manual.

`staging-deploy` y `rollback-staging.yml` comparten el grupo de concurrencia `staging-deploy`. Así dos despliegues o rollbacks no se pisan.

### Rollback manual

`rollback-staging.yml` (`workflow_dispatch`) recibe un `ref`, que puede ser un tag o un SHA, y valida su formato. Exige que el commit pertenezca a `develop` y lo vuelve a desplegar con el mismo script, que verifica la salud contra ese SHA. El `ref` se pasa por variable de entorno y nunca se interpola en el script.

*Alternativa descartada:* usar el rollback nativo del panel de Render. No queda registrado en GitHub, no verifica el SHA y no se puede demostrar en un run.

### Base de datos: expand/contract

- **Compatibilidad hacia atrás:** cada migración tiene que funcionar también con la versión anterior del código. Primero se agregan tablas o columnas (*expand*). Lo viejo se quita en una entrega posterior, cuando ningún SHA sano dependa de ello (*contract*).
- **Cuándo se revierte:** el rollback de código no ejecuta `migration:revert`. Volver a la versión anterior deja el esquema nuevo, que esa versión tolera. `npm run migracion:revertir` se usa a mano solo cuando la migración misma es la incompatible. Antes se respaldan los datos, porque `down` puede borrarlos (por ejemplo, el `DROP SCHEMA recomendaciones CASCADE`).
- **Revisión del esquema actual:** las migraciones crean esquemas propios (`precios_externos`, `recomendaciones`) con `IF NOT EXISTS` y sin FK hacia `public`. Por eso un SHA anterior a ellas sigue arrancando.

## Consecuencias

- El rollback automático depende de la API de Render y del secreto `RENDER_API_KEY`, igual que el despliegue.
- Un rollback deja el permiso `RECOMENDACIONES` y las tablas nuevas en su lugar. El código viejo simplemente no los usa.
- La demostración se hace desplegando a propósito una versión que rompe el health check, comprobando que vuelve sola al SHA anterior y guardando el enlace del run como evidencia de BE-02.
