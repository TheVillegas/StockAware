# StockAware

StockAware es un proyecto de Ingeniería Web Avanzada de la Pontificia Universidad Católica de Valparaíso, orientado a mejorar decisiones de inventario MRO —como equipos de protección personal, ropa técnica, insumos y herramientas— mediante información consolidada y recomendaciones explicables de reposición.

**Estado actual (EP2):** réplica funcional del ERP VAIPS con datos anonimizados, consulta de precios desde cinco fuentes web, procesamiento en FastAPI y persistencia con procedencia en NestJS. El panel de Stock permite revisar candidatos de precios. Esto no es todavía un motor de reposición adaptativa: su alcance futuro está separado en el [contexto del proyecto](docs/project-overview.md).

## Entrega parcial 2

- [Recorrido de demostración y evidencias pendientes](docs/ep2/entrega.md)
- [Fuentes, contratos y persistencia: ADR 0002](docs/architecture/adr/0002-precios-de-mercado-externos.md)
- [Decisiones de implementación](docs/ep2/decisiones-implementacion.md)
- [Métrica de calidad y sus límites](docs/ep2/metrica/README.md)
- [Especificación adaptativa preliminar](docs/ep2/especificacion-adaptativa.md)
- [Staging EP2 y despliegue verificado](docs/ep2/staging.md#evidencia-verificada-2026-10-25)
- [Estado de evidencias y bloqueos de cierre](docs/ep2/evidencias.md)
- [Gestión y participación verificable](docs/ep2/gestion.md)
- [Guion de presentación breve](docs/ep2/presentacion.md)

**Corte publicado:** [v0.2.0-ep2](https://github.com/TheVillegas/StockAware/releases/tag/v0.2.0-ep2), commit de `main` `cc02c2398bac3d2e604bb0613be964d6a9f3fbe8`, integrado mediante squash en [#90](https://github.com/TheVillegas/StockAware/pull/90). Su [CI](https://github.com/TheVillegas/StockAware/actions/runs/40245633645) terminó correctamente.

El [staging verificado](https://github.com/TheVillegas/StockAware/actions/runs/40243507519) corresponde a `develop` `4a7b16186738ab21fbcdb300d06e8a1bc7828087`; tiene el mismo árbol que el corte de main. Render sigue desde develop: no se afirma un despliegue del SHA de squash. Los documentos de cierre añadidos después del tag son complementarios, no parte de esa etiqueta inmutable.

La demo completa, el enlace real del tablero y la autorización docente de infraestructura equivalente siguen pendientes de evidencia. El enlace de Figma conservado abajo corresponde a EP1; su actualización queda expresamente pendiente.

## Base y referencias EP1

- [Reproducir la demo EP1](docs/ep1/reproducibility.md)
- [Diagramas de arquitectura EP1](docs/architecture/ep1-diagrams.md)
- [Staging preliminar EP1](docs/ep1/staging.md)
- [Configuración inicial de Capacitor EP1](docs/ep1/capacitor.md)
- [Fallo controlado del gate EP1](docs/ep1/controlled-failure.md)
- [Modelo de datos de la réplica](docs/architecture/data-model.md)
- [Prototipo Figma EP1](https://www.figma.com/design/RIvAtOoqdvHUBkURaxOopG/StockAware---Prototipo-EP1?node-id=7-3&t=0dfW1TifAtPN0y98-1)
- [Contribuir al proyecto](CONTRIBUTING.md)

## Integrantes

La asignación la definió el equipo. No incluye datos de contacto.

| Integrante | Ámbito |
| --- | --- |
| Matias Villegas | DevSecOps y gestión del repositorio |
| Matias Ignacio Romero Alvarez | Desarrollo fullstack |

## Variables de entorno

Los nombres y los valores ficticios de desarrollo están en `.env.example` y en la [guía de reproducibilidad](docs/ep1/reproducibility.md). `PG_PASSWORD` y `JWT_SECRET` son sensibles: no se documentan con un valor real ni se suben al repositorio. En GitHub Actions, `NODE_VERSION` y `PYTHON_VERSION` son variables no sensibles.

## Documentación de la API (OpenAPI)

El backend publica su contrato OpenAPI con Swagger. Los ejemplos son ficticios.

1. Levantar el stack con `docker compose up -d --build` (necesita un `.env` copiado de `.env.example`, con `PG_PASSWORD` y `JWT_SECRET`).
2. Abrir <http://localhost:3000/api/docs> (Swagger UI). El puerto es `BACKEND_PORT`.
3. El contrato en JSON está en <http://localhost:3000/api/docs-json>.
4. Para probar rutas protegidas: llamar a `POST /api/auth/login` y pegar el `access_token` en **Authorize**.

Sin Docker: `npm install` y `npm run dev` dentro de `apps/backend`, con PostgreSQL disponible. La prueba `npm test` (`src/documentacion/documentacion.spec.ts`) verifica el contrato sin base de datos.

## Evidencia visible de la EP1

Estas capturas acompañan los enlaces. No reemplazan el run ni el prototipo.

Pipeline verde del corte, incluido PostgreSQL, contenedores y el gate crítico. Run: https://github.com/TheVillegas/StockAware/actions/runs/36375148731

![Pipeline verde de la EP1](docs/ep1/images/ep1-pipeline-verde.png)

Fallo controlado disparado a propósito. Fallan el policy probe y el gate crítico. El job de seguridad también aparece en rojo porque el rango de escaneo quedó vacío, no porque se haya encontrado un secreto. Run: https://github.com/TheVillegas/StockAware/actions/runs/36371534531

![Fallo controlado del gate](docs/ep1/images/ep1-fallo-controlado.png)

Archivo de diseño de Figma, abierto sin contraseña. Muestra login, inicio, stock por bodega, órdenes de compra y el detalle de una OC.

![Prototipo Figma de la EP1](docs/ep1/images/ep1-figma-prototipo.png)
