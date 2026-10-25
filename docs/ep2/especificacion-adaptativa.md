# Reposición explicable: especificación adaptativa preliminar

Estado: propuesta de diseño para la EP2 y el [issue #50](https://github.com/TheVillegas/StockAware/issues/50). No implementa ni declara terminado un motor adaptativo. Parte de la visión de [StockAware](../project-overview.md) y de las fuentes aceptadas en el [ADR 0002](../architecture/adr/0002-precios-de-mercado-externos.md), no de fuentes nuevas.

Dependencia de fuentes: [#27](https://github.com/TheVillegas/StockAware/issues/27), cuya propuesta aceptada recoge el ADR. Su cierre debe verificarse por separado; este documento no lo cierra ni reemplaza esa decisión.

## Qué se adaptaría y para quién

**Parte adaptable:** el orden y la explicación de las recomendaciones de reposición en Stock, según la bodega y situación del material. No se propone cambiar permisos ni emitir compras automáticamente.

**Beneficiarios:** personal de bodega que identifica faltantes y personal de adquisiciones que revisa alternativas y prepara una compra. La priorización busca reducir el trabajo de reunir datos sin sustituir su criterio. Un precio menor no justifica reemplazar un EPP por otro sin equivalencia técnica y aprobación humana.

## Entradas previstas

| Entrada | Disponibilidad y límite |
| --- | --- |
| Datos web | Precios normales/oferta en CLP, disponibilidad declarada, URL, fuente y fechas de las publicaciones de Dartel, Dimeiggs, SoloTodo, Rhona y Sodimac. Recuperación y persistencia ya implementadas en EP2. |
| Calidad del vínculo | Estado propuesto/confirmado/rechazado y puntaje del candidato. El puntaje no acredita equivalencia; la confirmación humana sigue siendo necesaria. |
| Contexto operativo | Bodega seleccionada, stock, mínimo y consumo histórico usados actualmente en Stock. La cobertura calculada sin consumo suficiente debe tratarse como desconocida, no como certeza. |
| Variables del usuario | Tarea y bodega que la persona consulta; permisos existentes delimitan acciones. No hace falta perfilar datos personales ni inferir preferencias sensibles. |
| Contexto por validar | Criticidad, plazo de reposición, presupuesto y estacionalidad son necesidades de diseño, no entradas confirmadas del motor. Hay que acordar su definición, procedencia y disponibilidad antes de utilizarlas. |

Rhona y Sodimac dependen de una URL de listado asociada al material. La cobertura del catálogo es parcial, especialmente en EPP. La futura decisión debe conservar la procedencia y distinguir información vigente, desactualizada, parcial y ausente; **sin datos no significa precio cero**. Precios con unidades, presentación o IVA no comparables no deben presentarse como ahorro comprobado.

## Decisión y resultado visible propuestos

El sistema **propondría** qué materiales revisar primero para reposición y qué referencias externas consultar, explicando los factores disponibles. El stock y el riesgo de quiebre serían la base; los precios aportarían contexto de compra, no una sustitución automática por el candidato más barato. Umbrales, pesos y reglas de desempate siguen pendientes de validación.

Una recomendación futura mostraría:

- Material y bodega, cantidad sugerida y motivo de prioridad.
- Factores usados y faltantes: stock, consumo, cobertura y, cuando corresponda, criticidad validada.
- Referencias de precio con fuente, URL, fecha y estado del vínculo; aviso si no son comparables o están desactualizadas.
- Acciones humanas para revisar, ajustar o descartar la propuesta antes de preparar una compra.

**Ejemplo conceptual, no salida implementada:** para un material sin stock y con consumo reciente, priorizar su revisión y explicar ambos factores. Si solo hay un precio antiguo o un vínculo aún propuesto, mostrar esa limitación en vez de recomendar un proveedor como si estuviera confirmado. Si no hay consumo suficiente, pedir revisión, sin inventar días de cobertura.

## Posible mecanismo de adaptación

Como punto de partida se propone un conjunto de reglas explicables o un ranking parametrizable, no aprendizaje automático obligatorio. NestJS aportaría datos autorizados y procedencia; un procesamiento especializado podría evaluar los factores y devolver la propuesta con sus razones; NestJS seguiría validando y persistiendo lo que corresponda. El frontend no accedería directamente a fuentes ni a FastAPI.

Antes de implementarlo se deben acordar con usuarios los factores fiables y su precedencia, las restricciones de seguridad, los umbrales y la política ante datos faltantes. Las confirmaciones/rechazos de candidatos ya existentes podrían servir para revisar la calidad de los cruces, pero no se presume que entrenen hoy un modelo ni que una compra pruebe satisfacción.

## Cómo se evaluaría su utilidad después

Propuesta de evaluación para la entrega final, todavía sin ejecución ni resultados:

1. Fijar casos representativos de materiales y bodegas con datos fechados, incluyendo EPP, falta de consumo y precios ausentes/desactualizados. Separar casos de ajuste y evaluación.
2. Comparar la propuesta con una base de solo stock/mínimo/consumo sobre los mismos casos. Registrar reglas y parámetros para repetir el resultado.
3. Pedir a responsables de bodega/adquisiciones que juzguen pertinencia, equivalencia de candidatos y claridad de las razones. Medir coincidencia de los primeros puestos con su priorización y tiempo para decidir, además de propuestas aceptadas/ajustadas/descartadas.
4. Revisar explícitamente recomendaciones inseguras o apoyadas en datos incomparables; un ahorro aparente no compensa una recomendación de EPP incorrecta. Acordar metas y criterios de aceptación antes del ensayo.

La [métrica EP2](metrica/README.md) comprueba validez de registros y cobertura (26/32 materiales, 81,3 %), **no** utilidad adaptativa ni precisión del producto propuesto. Se conservará como evidencia de calidad de entrada, no como evaluación del futuro ranking.

## Límite de esta entrega y pendientes

La EP2 requiere la especificación preliminar, no implementar el motor final ni un modelo de usuario definitivo. Ya existen recuperación web, procesamiento, validación, persistencia, panel de precios y reglas operativas de Stock. Esta especificación no añade modelo de usuario, aprendizaje, ranking adaptativo contextual ni evaluación con usuarios. Tampoco modifica compras, autenticación o permisos.

Para la siguiente etapa quedan por validar factores/umbrales, comparabilidad de precios y equivalencia técnica, datos contextuales faltantes, diseño del resultado en Figma y protocolo de evaluación. Son decisiones pendientes, no acuerdos adoptados por este documento.
