# Ficha de Inscripción — Proyecto Final
**Ingeniería Web Avanzada — Segundo semestre de 2026**
**Docente:** Sandra Cano — Pontificia Universidad Católica de Valparaíso

---

## 1. Identificación del equipo

| Integrante | Rol principal |
|---|---|
| Matías Romero | Backend NestJS, persistencia PostgreSQL, seguridad y control de acceso |
| Matías Villegas | Servicio Python/FastAPI, capacidad adaptativa, frontend Angular/Ionic, DevSecOps |

Equipo de **2 integrantes**, ambos del mismo paralelo.

**Distribución de responsabilidades (registrada en el repositorio):**

- **Frontend Angular + Ionic + Capacitor:** Villegas (líder), Romero (formularios y vistas de catálogo)
- **Backend NestJS y API REST:** Romero (líder), Villegas (integración con FastAPI)
- **Persistencia y modelo de datos:** Romero
- **Recuperación y normalización de información web:** Villegas
- **Capacidad adaptativa:** Villegas (líder), Romero (endpoints de soporte y contratos)
- **Pruebas automatizadas:** ambos, cada uno sobre sus componentes; pruebas de integración compartidas
- **Seguridad y gestión de secretos:** Romero
- **DevOps, Docker, Terraform y pipeline:** Villegas
- **Experiencia de usuario y accesibilidad:** Villegas
- **Documentación y ADR:** ambos

---

## 2. Nombre del proyecto

**StockAware — Priorización adaptativa de reposición de inventario MRO**

---

## 3. Definición del problema (sección 17)

### ¿Qué situación, necesidad u oportunidad origina el proyecto?

Una empresa de prestación de servicios y mantención eléctrica gestiona un inventario **MRO** (mantención, reparación y operaciones) altamente heterogéneo: equipos de protección personal, ropa técnica por condición climática, insumos químicos y de oficina, y herramientas menores y de poder.

Las órdenes de compra son generadas por distintas personas sin una nomenclatura estandarizada, de modo que un mismo producto aparece registrado bajo múltiples descripciones diferentes a lo largo del historial. Esta fragmentación provoca tres consecuencias operativas:

1. El consumo real por producto es desconocido, porque queda repartido entre variantes de nombre.
2. No existe volumen agregado visible, lo que debilita la posición de negociación frente a proveedores.
3. La decisión de qué reponer y cuándo se toma por criterio individual, sin referencia de precio de mercado ni control sistemático de cobertura.

El proyecto aísla el **módulo de inventario** de un sistema ERP más amplio y lo aborda como una solución acotada y evaluable. Se **excluyen los vehículos**, por su baja frecuencia de compra y por requerir procesos de gestión distintos (mantención programada, permisos, seguros).

### ¿Quiénes experimentan el problema?

- **Encargado de bodega / pañolero:** ejecuta conteos y despachos, muchas veces en faena y sin conectividad estable.
- **Encargado de adquisiciones:** decide qué comprar cada semana y con qué presupuesto.
- **Supervisor de terreno / prevencionista:** requiere disponibilidad garantizada de EPP vigente para habilitar cuadrillas.
- **Administrador del sistema:** gestiona usuarios, maestro de productos y parámetros.

### ¿Qué tareas necesitan realizar los usuarios?

Registrar movimientos de stock y conteos cíclicos; consultar cobertura y consumo real por producto; obtener una lista priorizada de reposición semanal; comparar el precio pagado históricamente contra un precio de referencia externo; confirmar o rechazar la consolidación automática de descripciones equivalentes; y ajustar los criterios de priorización según el momento operativo.

### ¿Qué limitaciones presentan las soluciones existentes?

Las planillas de cálculo no consolidan variantes de nombre ni incorporan referencias externas de precio. Los ERP comerciales asumen un maestro de productos ya normalizado, condición que no se cumple en este caso, y aplican una política de reposición uniforme a categorías que se comportan de manera distinta. Los comparadores de precio de consumo masivo no cubren catálogos industriales ni EPP normado.

### ¿Por qué una aplicación web es apropiada?

El proceso involucra usuarios en oficina, bodega y terreno, sobre dispositivos distintos. Una base de código web común desplegada como navegador, PWA y aplicación Android permite el conteo en bodega con cámara y operación parcial sin conexión en faena, manteniendo un único origen de datos y un ciclo de despliegue reproducible.

### ¿Qué valor aportará la solución propuesta?

Visibilidad del consumo real por ítem consolidado; una decisión semanal de reposición justificada y explicable; detección de desviaciones de precio respecto de una referencia pública verificable; y reducción de quiebres de stock en ítems críticos de seguridad.

### ¿Cómo se determinará si el proyecto logró resolver el problema?

Mediante tres familias de métricas: calidad del emparejamiento de productos (Precision@K contra un conjunto etiquetado manualmente), calidad de los datos recuperados (porcentaje de registros válidos, porcentaje de duplicados, disponibilidad de la fuente) y utilidad de la adaptación (simulación retrospectiva del ranking del sistema frente a una política de punto de reorden fijo, midiendo quiebres evitados y sobre-stock).

---

## 4. Usuarios objetivo

Personal de bodega, adquisiciones, supervisión de terreno y administración de una empresa de servicios eléctricos de tamaño medio.

---

## 5. Objetivos

**Objetivo general.** Diseñar, implementar, desplegar y evaluar una aplicación web multiplataforma que consolide un catálogo de inventario MRO con nomenclatura heterogénea, lo enriquezca con precios de referencia obtenidos desde una fuente web pública y produzca una recomendación semanal de reposición priorizada, explicable y controlable por el usuario.

**Objetivos específicos.**

1. Implementar un proceso automatizado de normalización, deduplicación y consolidación de descripciones de productos hacia un ítem maestro.
2. Recuperar, validar y persistir precios de referencia desde una fuente web pública, registrando procedencia y fecha de actualización.
3. Emparejar cada ítem maestro con su correspondiente en la fuente externa, con umbral de confianza y cola de revisión humana.
4. Clasificar automáticamente cada ítem en una familia de política de reposición y aplicar la lógica de decisión correspondiente.
5. Producir un ranking semanal de reposición con justificación en lenguaje natural y pesos ajustables por el usuario.
6. Construir, probar, proteger, desplegar y monitorear el sistema mediante un enfoque DevSecOps reproducible.

---

## 6. Alcance y exclusiones

**Incluye:** maestro de productos y consolidación de variantes; movimientos de stock y conteo cíclico; recuperación y procesamiento de precios de referencia externos; emparejamiento interno–interno e interno–externo; clasificación por familia de política; motor de priorización con pesos configurables; autenticación y autorización por roles; despliegue en staging.

**Excluye:** gestión de flota de vehículos; módulos contables, de facturación y de remuneraciones; integración con proveedores para emisión efectiva de órdenes de compra; versión iOS.

---

## 7. Principales funcionalidades

1. Carga del histórico de compras en formato crudo, sin normalización previa.
2. Normalización automática de descripciones (unidades, medidas, tallas, calibres, acentuación).
3. Consolidación de variantes internas hacia un ítem maestro, con revisión y confirmación del usuario.
4. Emparejamiento de ítems maestros con productos de la fuente web externa.
5. Serie histórica de precios por ítem consolidado y detección de precio anómalo.
6. Clasificación automática en familias de política de reposición.
7. Ranking semanal de reposición con explicación por ítem y semáforo comprar / esperar / no aplica.
8. Ajuste de pesos del criterio de priorización por parte del usuario.
9. Conteo cíclico en bodega mediante escaneo con cámara (Capacitor) y operación parcial sin conexión (PWA).
10. Panel de calidad de datos y estado de la fuente externa.

---

## 8. Fuente de información web

**Fuente principal:** API pública de **Mercado Público (ChileCompra)** — órdenes de compra adjudicadas del Estado, con producto, cantidad, precio unitario, proveedor y fecha. Se accede mediante API documentada, sin recurrir a web scraping.

**Justificación.** El Estado adquiere el mismo tipo de catálogo que la empresa (EPP, herramientas eléctricas, insumos de aseo y oficina), lo que la convierte en una referencia de precio pertinente y defendible. Los datos presentan nomenclatura inconsistente, lo que justifica un proceso real de limpieza, normalización y deduplicación. La taxonomía **ONU/UNSPSC** utilizada por la plataforma provee un esquema de categorización profesional sobre el cual anclar el clasificador.

**Fuente complementaria:** IPC por división del **INE**, para ajustar precios históricos a valor presente antes de comparar.

**Estrategia de actualización:** recuperación incremental programada, con marca de procedencia y fecha-hora por registro. Ante indisponibilidad de la fuente, el sistema opera con el último precio de referencia válido, señalando explícitamente su antigüedad.

**Restricciones legales, éticas y de privacidad:** se revisarán los términos de servicio y los límites de solicitudes de la API antes del desarrollo. Los datos históricos de la empresa se incorporarán **anonimizados** (sin razones sociales de proveedores, RUT, nombres de compradores ni identificación de faenas), con autorización de la empresa, y el repositorio no contendrá datos comerciales sensibles reales.

---

## 9. Capacidad adaptativa o inteligente

### ¿Qué componente se adapta?

El orden y el contenido de la lista de reposición semanal, la decisión comprar / esperar y la política de reposición aplicada a cada ítem.

### ¿A quién o a qué se adapta?

Al perfil operativo de la empresa (consumo real, estacionalidad, dotación vigente), al contexto del ítem (familia de política, criticidad de seguridad, lead time) y a las preferencias explícitas del usuario de adquisiciones.

### ¿Qué variables activan la adaptación?

**Internas:** cobertura en días, tasa de consumo por media móvil, lead time del proveedor, criticidad de seguridad, presupuesto disponible, precio histórico pagado, tasa de pérdida o reposición.
**Externas (web):** precio de referencia vigente, tendencia respecto de períodos anteriores, cobertura de la fuente para ese ítem.

### ¿Qué decisión toma el sistema?

Asigna a cada ítem una familia de política, calcula un puntaje de prioridad y emite una recomendación de comprar ahora, esperar o no aplicar, acompañada de la justificación correspondiente.

**Familias de política de reposición:**

| Familia | Ejemplos | Lógica de decisión |
|---|---|---|
| Consumible de alta rotación | alcohol isopropílico, agua desmineralizada, insumos de oficina | punto de reorden por consumo histórico y lead time |
| EPP con vencimiento o desgaste | guantes dieléctricos, cascos, arneses | vida útil, dotación vigente, calendario de recertificación |
| Ropa por clima o estación | térmica, impermeable, alta visibilidad | estacionalidad y faenas programadas |
| Herramienta menor | destornilladores, alicates | tasa de pérdida y reposición, no consumo |
| Equipo mayor | martillos percutores, taladros | control de asignación en pañol; evaluación reponer contra reparar |

### ¿Qué mecanismo se utiliza?

Clasificación supervisada del ítem en familia de política, a partir del texto normalizado de la descripción y del patrón histórico de movimientos; puntaje multicriterio con pesos configurables; y detección de precio anómalo mediante z-score sobre la distribución histórica del ítem consolidado. No se emplea inteligencia artificial generativa.

**Procesamiento no trivial en Python/FastAPI:** normalización de texto industrial; generación de candidatos mediante TF-IDF sobre n-gramas de caracteres; reordenamiento por similitud de embeddings; umbral de confianza; clasificación por familia; y cálculo del puntaje de prioridad.

### ¿Cómo comprende el usuario la decisión?

Cada ítem del ranking muestra su familia detectada, la cobertura en días, la desviación entre el precio pagado y el precio de referencia, y una frase explicativa —por ejemplo: *cobertura de 4 días, precio de referencia 12 % bajo su promedio histórico, comprar ahora*.

### ¿Cómo puede aceptarla, modificarla o rechazarla?

Ajustando los pesos del criterio de priorización (urgencia operativa, ahorro, criticidad de seguridad); confirmando o rechazando cada consolidación de variantes y cada emparejamiento externo desde la cola de revisión; y reasignando manualmente la familia de política de un ítem.

### ¿Cómo se evaluará su utilidad?

Mediante simulación retrospectiva sobre el histórico real de la empresa, comparando el ranking del sistema contra una **línea base no adaptativa** de punto de reorden fijo, y midiendo quiebres evitados, sobre-stock generado y desviación del precio pagado.

### ¿Qué riesgos de sesgo, privacidad o falta de transparencia existen?

El riesgo principal es que un criterio orientado al ahorro postergue la reposición de **EPP crítico de seguridad**, con consecuencias sobre la integridad de los trabajadores. El sistema mitiga este riesgo tratando la criticidad de seguridad como restricción y no como variable ponderable: los ítems de EPP normado priorizan disponibilidad por sobre precio, y el sistema lo declara explícitamente en la justificación.

Riesgos adicionales: sesgo de representatividad de la fuente externa, que puede cubrir mejor unos rubros que otros —se reporta la cobertura por categoría—; y desactualización de precios ante indisponibilidad de la fuente —se muestra siempre la antigüedad del dato—. Los datos personales de compradores se excluyen por minimización.

---

## 10. Arquitectura tecnológica

```
Angular + Ionic + Capacitor  (navegador, PWA, Android)
                ↓
        NestJS — API REST principal
          ↙                    ↘
   PostgreSQL            Python + FastAPI
                                ↓
              API Mercado Público (ChileCompra) + INE
```

Contenerización mediante Docker y Docker Compose; pipeline DevSecOps en GitHub Actions; infraestructura definida con Terraform; despliegue en ambiente de staging.

---

## 11. Respuesta a la pregunta integradora (sección 15)

> *¿Cómo diseñar, implementar, desplegar y evaluar una aplicación web que obtenga información desde la Web y adapte su comportamiento a las necesidades, características o contexto de sus usuarios de manera segura, transparente y verificable?*

**1. ¿Qué problema real resuelve y quiénes son sus usuarios?**
La fragmentación del catálogo de inventario MRO por nomenclatura inconsistente y la ausencia de un criterio sistemático de priorización de reposición, en una empresa de servicios eléctricos. Usuarios: bodega, adquisiciones, supervisión de terreno y administración.

**2. ¿Qué información obtiene desde la Web y cómo garantiza su calidad, procedencia y actualización?**
Precios de referencia de órdenes de compra adjudicadas desde la API de Mercado Público, complementados con IPC del INE. Cada registro almacena fuente, identificador de origen y fecha-hora de recuperación. La calidad se controla mediante validación de esquema, normalización, deduplicación y métricas de porcentaje de registros válidos y de duplicados. La actualización es incremental y programada, con degradación controlada ante indisponibilidad.

**3. ¿Qué comportamiento adapta, con qué variables y mediante qué mecanismo?**
Adapta la prioridad de reposición y la política aplicada a cada ítem, según cobertura, consumo, lead time, criticidad, estacionalidad, presupuesto y precio de referencia externo, mediante clasificación en familias de política, puntaje multicriterio con pesos configurables y detección de precio anómalo por z-score.

**4. ¿Cómo se construye, prueba, despliega y monitorea de manera reproducible?**
Mediante contenerización de los cuatro componentes, orquestación local con Docker Compose, pipeline DevSecOps en GitHub Actions con quality gates que bloquean ante pruebas fallidas, secretos expuestos o vulnerabilidades críticas, infraestructura declarada en Terraform, despliegue automatizado en staging y observabilidad basada en logs estructurados correlacionados, endpoints de salud y métricas de tiempo de respuesta.

**5. ¿Qué evidencia demuestra que la solución es útil, segura, accesible y responsable?**
Precision@K del emparejamiento contra un conjunto etiquetado manualmente durante auditorías previas; métricas de calidad de datos; comparación de la adaptación contra una línea base no adaptativa mediante simulación retrospectiva; cobertura de pruebas automatizadas y resultados del análisis de seguridad del pipeline; verificación de criterios de accesibilidad en el frontend; y documentación de datos personales tratados, sesgos identificados y medidas de mitigación.

---

## 12. Enlaces

| Recurso | Enlace |
|---|---|
| Repositorio | *(por definir)* |
| Prototipo Figma | *(por definir)* |
| Tablero de gestión | *(por definir)* |
| Ambiente de staging | *(por definir)* |
