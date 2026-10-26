# EP2: demostración y evidencias de entrega

La EP2 demuestra datos web → NestJS → FastAPI → validación/persistencia → interfaz. El [corte publicado v0.2.0-ep2](https://github.com/TheVillegas/StockAware/releases/tag/v0.2.0-ep2) está en main `cc02c23`, con CI aprobado y el mismo contenido que el staging verificado `4a7b161`. La [demo local ejecutada](demo-local.md) registra el flujo y sus errores; el [Figma EP2](prototipo.md) representa consulta, revisión y errores. Esto no acredita una defensa realizada ni el cierre de todos los entregables. Ver [evidencias](evidencias.md), [gestión y participación](gestion.md) y [guion de presentación](presentacion.md).

## Ruta rápida de revisión

1. Revisar [fuentes y contratos](../architecture/adr/0002-precios-de-mercado-externos.md), [decisiones](decisiones-implementacion.md) y [métrica](metrica/README.md).
2. Reproducir el recorrido funcional de abajo y registrar lo observado, sin confundir respuestas esperadas con evidencia ejecutada.
3. Revisar la [especificación adaptativa preliminar](especificacion-adaptativa.md) y completar las evidencias pendientes al final de esta guía.

## Preparación de la demo

Para una réplica local, seguir los requisitos, secretos locales e inicialización de la [guía EP1](../ep1/reproducibility.md). Desde la raíz, con las variables locales ya configuradas:

```bash
docker compose up -d --build
docker compose ps
curl --fail-with-body http://localhost:3000/api/health
curl --fail-with-body http://localhost:8000/health
```

Esperar al arranque de PostgreSQL y las migraciones de `precios_externos`; no eliminar volúmenes para preparar la demostración. En local, el frontend está en `http://localhost:4200`. Para el entorno publicado usar [staging](staging.md); no introducir credenciales reales en capturas o en el repositorio.

Usar una cuenta de la réplica con `MATERIAL_X_BODEGA` para lectura y, solo al demostrar revisión de candidatos, `MOD_MATERIALES` para escritura. Elegir materiales del [conjunto evaluado](metrica/conjunto.json), por ejemplo `MC_202` (CINTA AISLANTE ROJA); no se garantiza que una fuente comercial devuelva hoy los mismos resultados del 2026-10-24.

## Recorrido funcional comprobable

| Paso | Acción | Resultado esperado y evidencia a conservar |
| --- | --- | --- |
| 1. Consultar | Iniciar sesión, abrir **Stock** (`/f/MATERIAL_X_BODEGA`), seleccionar bodega o buscar un material. Cambiar a Todo si el filtro Urgente lo oculta. Abrir su panel **Precios de mercado**. | En Network, `GET /api/precios/:codMaterial` desde el frontend hacia NestJS. Capturar código del material, hora y estado HTTP, nunca JWT ni encabezados de autorización. |
| 2. Recuperar/procesar | Con datos ausentes o vencidos, observar la consulta. Dartel, Dimeiggs y SoloTodo usan término; Rhona/Sodimac necesitan URL de listado asociada. | NestJS prepara la búsqueda con `POST /v1/precios/preparar`, recupera las fuentes y envía el contenido a `POST /v1/precios/procesar`. Los logs sanitizados y la procedencia permiten explicar el salto; el navegador no llama directamente a FastAPI. |
| 3. Mostrar | Revisar los candidatos o los avisos por fuente. | Fuente, enlace, precio, disponibilidad, fechas y estado del vínculo; sin resultados, datos parciales o desactualizados deben explicarse, no sustituirse por precios inventados. |
| 4. Persistir/reutilizar | Recargar el mismo material dentro de su vigencia. Complementar con consultas de solo lectura a la base local. | Se conservan publicaciones y observaciones en `precios_externos`; no se debe interpretar la ausencia de nuevas llamadas web como un fallo: la vigencia base es una semana. |
| 5. Revisar | En una réplica de demostración y con permiso de escritura, confirmar o rechazar un candidato y recargar. | `PATCH /api/precios/vinculos/:id` conserva la decisión; un rechazado no se vuelve a proponer. Esta acción sí modifica datos de esa réplica. |
| 6. Explicar límites | Mostrar una fuente sin URL, un material sin coincidencias o un caso de falla disponible, sin provocar caídas en staging. | Diferenciar `sin_datos`, `sin_resultados` y `desactualizada`. Un `502` sin datos guardados es un error visible, no una respuesta exitosa vacía. Las pruebas deterministas cubren fallas sin depender de tiendas reales. |

Consultas locales de solo lectura (reemplazar usuario/base si se cambiaron los defaults):

```bash
docker compose exec -T db psql -U erp -d erp_replica \
  -c 'SELECT fuente, count(*) FROM precios_externos.publicacion GROUP BY fuente;'
docker compose exec -T db psql -U erp -d erp_replica \
  -c 'SELECT obtenido_en, verificado_en FROM precios_externos.observacion_precio ORDER BY obtenido_en DESC LIMIT 5;'
```

Los conteos globales no prueban por sí solos qué material originó una observación: acompañarlos con la respuesta del material y su hora. No borrar precios ni alterar fechas para forzar una actualización. Un caso con caché vigente demuestra reutilización; una recuperación nueva requiere un material elegible sin datos vigentes.

## Calidad y pruebas: qué demuestra cada evidencia

| Evidencia | Alcance y límite |
| --- | --- |
| [Medición real del 2026-10-24](metrica/resultado-2026-10-24.json) | 32 materiales, 100 % de candidatos devueltos válidos y 26/32 con precio (81,3 %). No es precisión semántica ni una demo de persistencia/UI: el runner no escribe precios en la base. |
| [Pruebas de integración HTTP](../../tests/integration/README.md) | En el CI de main `40245633645`, job `121326542791`: ocho pruebas aprobadas, Node 22.23.3 y Python 3.13.7. No incluye navegador, autenticación, base de datos ni tiendas reales. |
| [Actions y staging verificados](staging.md#corte-publicado-y-staging-equivalente) | Staging `40243507519` para develop `4a7b161`, mismo árbol que main/tag `cc02c23`. Health checks aprobados; no es una demostración completa del flujo de negocio. |
| [Propuesta adaptativa](especificacion-adaptativa.md) | Especificación preliminar; no se presenta como motor implementado ni evaluación con usuarios. |

## Checklist de cierre documental y académico

Requisitos revisados en `ProyectoFinal.pdf` del curso: pp. 26, 38, 40 y 50–51. El PDF no está versionado aquí; conservar su referencia en la entrega del curso. Marcar cada pendiente solo con evidencia verificable, no por el estado abierto/cerrado de un issue.

- [x] Fuentes, contratos, decisiones y resultado de una métrica real documentados en el repositorio.
- [x] Enlace a un run con despliegue real y health checks del mismo commit; ver detalle de [#51](staging.md#verificar-el-cierre-de-51).
- [x] Conservar [evidencia funcional local](demo-local.md): entrada, procesamiento, procedencia persistida, recarga/rechazo y resultado visible; incluye logs sanitizados de petición y falla controlada de fuente.
- [x] Verificar las pruebas de integración y el CI del commit entregado: [main cc02c23](https://github.com/TheVillegas/StockAware/actions/runs/40245633645), ocho pruebas HTTP aprobadas.
- [x] Actualizar el [prototipo Figma EP2](prototipo.md): siete pantallas editables, consulta, revisión y errores; EP1 conservado.
- [ ] Confirmar acceso al prototipo desde la cuenta/dispositivo docente; el flujo abre en el navegador de comprobación sin solicitar inicio de sesión.
- [x] Publicar y verificar [tag/release v0.2.0-ep2](https://github.com/TheVillegas/StockAware/releases/tag/v0.2.0-ep2) sobre el commit final de main `cc02c23`.
- [x] Consolidar responsables y contribuciones verificables en el [registro de gestión](gestion.md), sin atribuir horas ni porcentajes no demostrados.
- [ ] Incorporar el enlace directo y verificar acceso docente al tablero existente. [Eventos Projects v2](gestion.md#github-projects-actividad-comprobada-enlace-directo-pendiente) acreditan uso real, no su visibilidad o estado actual.
- [x] Preparar el [guion de presentación breve](presentacion.md), incluyendo alcance, métrica, límites y reparto sugerido.
- [x] Ejecutar y registrar la [demostración funcional local](demo-local.md), con su configuración y límites explícitos.
- [ ] Presentar/defender el avance; un guion preparado y una demo registrada no equivalen a una presentación realizada.
- [ ] Acreditar la autorización docente de Render Blueprint como equivalente. La [infraestructura técnica](infraestructura.md) sí está desplegada; Terraform continúa `defined-not-deployed` y un staging verde no prueba autorización académica.

Antes de la defensa, volver a comprobar disponibilidad del entorno y vigencia de su base; las limitaciones operativas se conservan en [staging](staging.md). No se afirma que todos los pendientes anteriores estén resueltos.
