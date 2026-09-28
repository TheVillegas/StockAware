# Configuración inicial de Capacitor (EP1)

La app Ionic/Angular tiene configuración inicial de Capacitor 7. Eso no es una app Android generada, ni un paquete nativo, ni un binario instalable.

## Qué existe

`apps/frontend/capacitor.config.ts` declara:

- `appId`: `cl.pucv.stockaware`
- `appName`: `StockAware`
- `webDir`: `dist/browser`

El application builder de Angular escribe el bundle del navegador en `dist/browser`. `webDir` apunta a esa salida. No apunta a un proyecto Android ni iOS.

`@capacitor/core` está en `dependencies` y `@capacitor/cli` en `devDependencies`, ambos en la línea 7. No hay otros plugins de Capacitor.

No se ejecutó `npx cap add`. No hay directorios `android/` ni `ios/`.

## Manifiesto

`apps/frontend/src/manifest.webmanifest` es solo metadata: `name` y `short_name` StockAware, `start_url` `/`, `display` `standalone` y `lang` `es`. `src/index.html` lo enlaza. `angular.json` lo registra en `assets` para que el build lo copie.

No es una PWA instalada verificada. No hay service worker y no se ejecutó `ng add @angular/pwa`.

## Qué no afirma esta evidencia

Esta configuración no produce un paquete Android, no instala la app en un dispositivo y no demuestra que la PWA se pueda instalar.
