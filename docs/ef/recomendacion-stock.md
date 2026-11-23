# Recomendación de stock y observaciones

Stock consulta `GET /precios/:codMaterial/observaciones` con el permiso `MATERIAL_X_BODEGA`. Esta lectura solo consulta material, marca de cotizabilidad y observaciones guardadas; no actualiza fuentes, inteligencia, base de datos ni cachés. Sin datos devuelve fuentes sin datos y la recomendación es validar fuentes. Un material inexistente devuelve 404.

Solo se incluyen observaciones cuya verificación individual es válida, no futura y tiene menos de siete días (la vigencia por fuente del servicio). Una fila reciente no renueva las demás. La aplicación también rechaza respuestas o fuentes desactualizadas y exige abrir la publicación y confirmar manualmente unidad, empaque y vigencia antes de recomendar cotizar ahora. La urgencia continúa dependiendo del stock. La confirmación y las decisiones son locales, no crean órdenes ni modifican la base.

El panel de precios conserva `GET /precios/:codMaterial`: esa consulta puede refrescar fuentes vencidas y persistir resultados o fallas; no es la lectura de solo observaciones.
