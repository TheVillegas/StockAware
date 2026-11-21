# StockAware como PWA

El build de producción incluye el service worker de Angular y un manifiesto con iconos locales SVG de 192 y 512 píxeles. La instalación requiere HTTPS (o localhost), una primera visita en línea y un navegador compatible; el soporte de iconos SVG e instalación varía por navegador. No se ha demostrado la instalación en un dispositivo.

El worker precarga únicamente archivos estáticos del build y los recursos locales incluidos en él. No configura cachés de datos ni URLs remotas. Las llamadas API, credenciales y respuestas de negocio no se guardan en el caché del worker. La sesión existente de la aplicación sigue usando localStorage: esta PWA no cambia ese comportamiento ni garantiza el borrado de datos locales al cerrar el navegador.

Si el navegador informa que no hay conexión, se reemplazan las pantallas por un aviso: no hay consulta, escritura, cola ni sincronización offline. Al perder conexión pueden perderse cambios sin guardar. El indicador del navegador no detecta todos los fallos del servidor; estar «en línea» no garantiza que la API esté disponible. Una primera visita sin conexión no puede instalar ni cargar la app.

Cuando el worker tiene una versión nueva lista, se muestra un aviso y la persona decide cuándo recargar; debe guardar antes su trabajo. Sin recargar, la pestaña sigue en la versión anterior. Una recarga offline puede seguir usando la versión ya guardada. El registro se deshabilita en desarrollo y Capacitor nativo. Un worker ya registrado en el mismo origen por una visita anterior puede seguir controlando páginas: use otro origen o desregístrelo en herramientas del navegador para probar desarrollo.

## Prueba manual

1. Genere `cd apps/frontend && npm run build` y sirva `dist/browser` en HTTPS o localhost con fallback SPA, tipos MIME correctos y sin caché persistente para `index.html`, `ngsw.json`, `ngsw-worker.js` y el manifiesto.
2. Abra la app en línea, espere el registro y la instalación del worker y revise Application/Manifest y Service Workers. Compruebe la opción de instalación del navegador y los iconos en el dispositivo objetivo.
3. Tras completar la primera carga, simule desconexión de red real y recargue: debe aparecer «Sin conexión» sin datos de negocio. Vuelva a conectar y compruebe el acceso a la API. Examine Cache Storage y confirme que solo contiene archivos del build, no respuestas API.
4. Publique otra versión y conserve abierta la anterior. Abra la app en otra pestaña para provocar una navegación de documento completa; un cambio de ruta interno de Angular no basta. Una vez lista debe aparecer el aviso en la primera pestaña. Recargue voluntariamente y compruebe la nueva versión. No pruebe con formularios sin guardar.

En Chromium local se comprobó que el manifiesto no reporta errores de instalabilidad, que la app abre sin red después de la primera visita, que la caché no guarda respuestas de la API de prueba y que un nuevo manifiesto activa el aviso sin recarga automática. La imagen Nginx sirvió los archivos del worker y del manifiesto correctamente. Aún hay que verificar las cabeceras de Render, la instalación y el login contra el corte final en staging.
