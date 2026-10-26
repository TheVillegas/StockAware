# StockAware: presentación breve de la EP2

Guion preparado para aproximadamente seis minutos, seguido de preguntas. No registra una presentación ya realizada ni reemplaza la demo funcional. Referencia evaluable: [v0.2.0-ep2](https://github.com/TheVillegas/StockAware/releases/tag/v0.2.0-ep2), main `cc02c23`.

## 1. Problema y alcance — 40 segundos

StockAware consolida inventario MRO y permite consultar precios externos para apoyar decisiones de reposición. La EP2 conecta recuperación web, procesamiento y persistencia con la interfaz existente. No presentamos todavía un motor adaptativo final.

Mostrar el README y el tag evaluable, no una rama de trabajo sin identificar. Integrantes: Matías Villegas y Matías Ignacio Romero Alvarez; el [registro](gestion.md#participación-verificable) enlaza contribuciones concretas.

## 2. Integración funcional — 60 segundos

Angular/Ionic consulta a NestJS. NestJS recupera las fuentes permitidas, envía información a FastAPI para preparar/procesar y valida/persiste publicaciones, observaciones y vínculos en PostgreSQL. La interfaz recibe los resultados desde NestJS, no desde FastAPI directamente.

Se consideran Dartel, Dimeiggs, SoloTodo, Rhona y Sodimac. Las fuentes tienen restricciones y fallas posibles; Rhona/Sodimac necesitan URL de listado asociada. La procedencia y las fechas permiten distinguir datos vigentes, parciales o desactualizados. Referencia: [fuentes y contratos](../architecture/adr/0002-precios-de-mercado-externos.md).

## 3. Demostración — 100 segundos

Con la réplica y la cuenta local de demostración ya preparadas:

1. Abrir Stock, seleccionar material y mostrar el panel de precios de mercado.
2. Identificar la consulta a NestJS y el salto a FastAPI mediante evidencia sanitizada.
3. Mostrar fuente, enlace, precio, disponibilidad y fecha; relacionar el material con los registros persistidos.
4. Recargar y explicar la reutilización de datos vigentes.
5. Mostrar un error controlado o un estado sin resultados, sin interrumpir staging.

Seguir el [recorrido detallado](entrega.md#recorrido-funcional-comprobable). No mostrar tokens, contraseñas ni registros privados. Si no se pudo ejecutar el recorrido, declarar la limitación: una captura, una prueba HTTP aislada o un health check no lo sustituyen. La [matriz](evidencias.md) separa lo ejecutado de lo pendiente.

## 4. Evaluación de datos — 45 segundos

La [medición real del 2026-10-24](metrica/README.md) obtuvo precio para 26 de 32 materiales: cobertura del 81,3 %. El 100 % de candidatos devueltos cumplió la validación aplicada. Esto no equivale a precisión semántica ni garantiza disponibilidad actual de las tiendas. El runner de la métrica no persistió precios; la demo debe demostrar esa parte por separado.

## 5. Calidad, seguridad y despliegue — 45 segundos

Mostrar el [CI de main](https://github.com/TheVillegas/StockAware/actions/runs/40245633645): incluye pruebas Python, ocho pruebas HTTP reales Nest–FastAPI, integración PostgreSQL, análisis de seguridad y contenedores. El test de correlación y los errores 422/502 comprueban contratos, no una sesión completa de navegador.

El [staging verificado](https://github.com/TheVillegas/StockAware/actions/runs/40243507519) despliega develop `4a7b161`; el tag/main usa `cc02c23` por el squash. Sus árboles son iguales. No afirmar que el SHA de main se desplegó ni que la disponibilidad futura esté garantizada.

## 6. Adaptación, límites y siguiente etapa — 30 segundos

La [especificación preliminar](especificacion-adaptativa.md) identifica beneficiarios, datos web, variables de contexto, decisión y resultado esperado. El motor adaptativo, su evaluación final y las pruebas con usuarios corresponden a la siguiente etapa.

Declarar los pendientes reales: Figma actualizado, evidencia completa de demo/logs si aún no está registrada, enlace/acceso al tablero y autorización docente de infraestructura equivalente. El tag publicado no cierra automáticamente estos puntos.

## Preparación y reparto sugerido

El equipo debe confirmar el reparto: una persona explica alcance/CI/infraestructura y la otra fuentes/procesamiento/persistencia/métrica; ambas deben poder explicar el flujo completo. No se asignan horas ni porcentajes de trabajo.

Antes de presentar, verificar acceso al tag, staging y tablero, ejecutar la demo y anexar su evidencia. Para mostrar participación, usar PRs y revisiones reales del [registro](gestion.md), no un reparto de archivos creado para la evaluación.
