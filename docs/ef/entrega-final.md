# Entrega final: guía de revisión y defensa

**Estado: candidato provisional, no entrega aprobada.** Hay evidencia local de la integración web móvil y un ensayo sintético del gate de rollback; el corte final, su APK instalada, la defensa y la aprobación humana siguen pendientes. Esta rama documental parte del runbook de staging, no contiene necesariamente los candidatos de aplicación descritos abajo. No confundir un historial local con una release ni con un despliegue.

## Ruta rápida

1. Identificar el árbol que se revisa y registrar commit, cambios locales y fecha; comparar con el corte finalmente aceptado cuando exista. No asumir que esta rama incluye el rediseño o la corrección adaptativa.
2. Para reproducir, usar una réplica aislada con [Compose](#reproducción-local) o las [pruebas con fixtures](#dependencias-y-pruebas); registrar lo observado, no solo lo esperado.
3. Consultar [API y recorrido](#api-y-recorrido), luego contrastar [evidencia y pendientes](#evidencia-y-pendientes). Para operación, leer el [runbook de rollback](staging-rollback.md), que no autoriza despliegues.
4. Preparar la [defensa](#lista-para-la-defensa) y adjuntar evidencia verificable del corte exacto antes de marcar pendientes.

## Reproducción local

Se requieren Docker y Compose v2, puertos disponibles y una copia de trabajo aislada. Seguir [requisitos, variables y arranque](../ep1/reproducibility.md#requisitos-y-secretos-locales): configurar `PG_PASSWORD` y `JWT_SECRET` con valores inventados exclusivos del entorno local, nunca credenciales reales. Desde la raíz, una vez configuradas las variables:

```bash
docker compose up -d --build
docker compose ps
curl --fail-with-body http://localhost:3000/api/health
curl --fail-with-body http://localhost:8000/health
```

Abrir <http://localhost:4200>; NestJS está en <http://localhost:3000/api> y FastAPI en <http://localhost:8000>. Son puertos predeterminados y pueden cambiar según la configuración local. Esperar la inicialización de PostgreSQL y las migraciones; `db` e `intelligence` tienen healthcheck, no así frontend ni backend. La primera inicialización usa la semilla anonimizada y el volumen conserva datos entre arranques; no borrar volúmenes, reutilizar datos productivos ni alterar staging para una demo. La consulta de precios puede acceder a tiendas externas y escribir en la réplica: usarla solo con autorización y con conocimiento de esos efectos. La [demo EP2](../ep2/demo-local.md) muestra un ensayo anterior, no garantiza resultados comerciales actuales.

### Dependencias y pruebas

Para pruebas locales sin Compose, Node 22 para frontend/backend y Python 3.13 con uv para intelligence; cada componente tiene su lockfile. Desde la raíz:

```bash
npm ci --prefix apps/frontend
npm --prefix apps/frontend test -- --runInBand
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run build
npm ci --prefix apps/backend
npm --prefix apps/backend test -- --runInBand
uv sync --frozen --project apps/intelligence-service
uv run --frozen --project apps/intelligence-service pytest
```

La instalación requiere dependencias disponibles y modifica los directorios locales de dependencias; no equivale a evidencia de una ejecución. Para integración real Nest–FastAPI con fixtures deterministas, sin base ni tiendas, seguir los comandos y requisitos de [tests/integration](../../tests/integration/README.md). Cubre HTTP entre servicios, no navegador, permisos de ERP, despliegue ni disponibilidad comercial. Registrar versión del árbol, comando y resultado de cada ejecución; no extrapolar pruebas de otro candidato.

## API y recorrido

Con Compose iniciado, Swagger está en <http://localhost:3000/api/docs> y su JSON en <http://localhost:3000/api/docs-json>; FastAPI publica su documentación en <http://localhost:8000/docs>. Las rutas protegidas requieren sesión y permisos; no compartir tokens ni encabezados. El [recorrido EP2](../ep2/entrega.md#recorrido-funcional-comprobable) explica Stock, fuente, persistencia y revisión, indicando qué acciones escriben en la réplica. El [ADR de fuentes y contratos](../architecture/adr/0002-precios-de-mercado-externos.md) distingue NestJS, FastAPI y persistencia; es evidencia EP2, no contrato certificado del candidato final.

## Evidencia y pendientes

Todas las referencias locales son provisionales y se deben reconciliar con el corte aceptado; los hashes identifican evidencia histórica, no instrucciones de release.

| Estado | Evidencia y alcance |
| --- | --- |
| Comprobado en candidato T1 | Integración `a2b2b1f`: 19 suites y 189 pruebas Jest, lint, typecheck y build; verificación independiente web en viewport móvil, con borrador/sesión preservados durante offline y reconexión. No es prueba de Android físico, ciclo de vida completo del service worker ni despliegue final. |
| Pendiente T1/T5 | La revisión nativa de T1 quedó pendiente. El APK descargado coincide con el build anterior `c61bdcb`, previo al rediseño integrado; no demuestra el candidato combinado ni una instalación actual verificada. Falta construir desde el corte aceptado, registrar procedencia y hash, instalar y probar en dispositivo Android, y conservar evidencia sanitizada. |
| Comprobado, no candidato final | Sondeo de staging: web HTTP 200; Nest y FastAPI saludables, postgres ok y ambas API en `9ceaac1`. No identifica el SHA de web ni acredita el candidato final desplegado, fuentes o logs actuales. |
| Comprobado solo en ensayo | Runbook `1a2d58b`: gate de salud con cuatro casos sintéticos, sin rollback real ni prueba de compatibilidad de base. IaC `c4485d5` es candidato separado validado con mocks; no acredita importación, apply ni adopción de recursos vivos. Ver [límites y procedimiento](staging-rollback.md). |
| Pendiente T2 | La corrección adaptativa está bajo verificación: se detectaron promoción de oferta vencida y efectos de escritura al consultar; se implementó corrección de lectura y fallo cerrado. Siguen pendientes la prueba de expiración con panel abierto y el contrato HTTP público, incluidos permisos y ausencia de escrituras. No presentar ese comportamiento como aceptado o disponible en esta rama. |
| Pendiente cierre | Identificar el corte exacto, integrar y revisar candidatos, repetir pruebas y CI sobre él, comprobar despliegue por servicio si se autoriza, y obtener aprobación según reglas del repositorio. No hay evidencia de rollback real, compatibilidad/recuperación de datos, evaluación con usuarios ni defensa realizada. |

## Privacidad, fuentes y control humano

- La réplica se describe como anonimizada, no como garantía absoluta de ausencia de riesgo. Minimizar capturas y registros: no incluir credenciales, JWT, cookies, datos personales ni datos comerciales reales; revisar y sanitizar antes de compartir. No usar la base original en la demostración.
- Las cinco fuentes y sus restricciones están en el [ADR](../architecture/adr/0002-precios-de-mercado-externos.md). Cobertura parcial, categorías distintas, precios no negociados, cambios de catálogo, disponibilidad, antigüedad, IVA incierto y formatos HTML pueden sesgar o invalidar comparaciones. La [métrica EP2](../ep2/metrica/README.md) no demuestra equivalencia semántica ni utilidad para usuarios. No sortear restricciones de los proveedores.
- Un candidato no es una orden de compra ni prueba de equivalencia. El objetivo T2 mantiene la urgencia dependiente del stock: solo una oferta vigente y comparable habilitaría «cotizar ahora». La persona abre la publicación y confirma manualmente unidad, empaque y vigencia; sin evidencia confiable o sin confirmación corresponde «validar fuentes». Esa confirmación prevista no cambia la base; su implementación final aún debe verificarse.
- El usuario conserva la decisión: puede revisar la procedencia, no confirmar y abandonar la consulta. Los permisos distinguen lectura (`MATERIAL_X_BODEGA`) de revisión persistente (`MOD_MATERIALES`); no atribuir a todos los perfiles capacidad de modificar vínculos. La confirmación manual prevista para la recomendación no debe confundirse con el PATCH persistente de revisión EP2. No se afirma compra automática ni evaluación humana realizada.

## Lista para la defensa

- [x] Señalar la arquitectura y una [demo local EP2 documentada](../ep2/demo-local.md), con sus límites y procedencia.
- [x] Distinguir el ensayo sintético de rollback y el sondeo de staging del despliegue y rollback reales.
- [ ] Mostrar el corte aceptado y sus pruebas/CI, además de un recorrido reproducido y registrado en ese mismo corte.
- [ ] Mostrar APK del corte, hash, instalación y recorrido en Android físico; no sustituirlo con el APK anterior ni la prueba web.
- [ ] Explicar sesgos, caducidad, permisos, confirmación humana y control del usuario con ejemplos, sin afirmar utilidad validada.
- [ ] Acreditar autorización académica, acceso docente al tablero/prototipo y defensa efectivamente realizada, cuando corresponda; registrar fuente y fecha reales.
- [ ] Verificar compatibilidad y recuperación de datos y, solo con autorización separada, ejecutar y documentar cualquier rollback real.

Para repartir la explicación y localizar contribuciones verificables, consultar [gestión y participación EP2](../ep2/gestion.md) y [guion previo](../ep2/presentacion.md); son referencias históricas, no atribuciones nuevas ni evidencia de defensa. El flujo de revisión y ramas está en [CONTRIBUTING](../../CONTRIBUTING.md). No inferir aprobaciones, porcentajes de esfuerzo o evaluación de usuarios a partir de esos documentos.
