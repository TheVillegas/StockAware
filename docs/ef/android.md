# Android: APK debug para staging

El workflow **Android staging debug APK** corre en pushes de la rama `feat/ef-staging-multiplatform`, pull requests del mismo repositorio y manualmente sobre la rama elegida (una vez que el workflow esté disponible en la rama predeterminada). Sube únicamente `app-debug.apk` como artifact del run. No publica ni despliega; el APK debug usa la clave de debug generada por Gradle y no sirve para distribución de producción.

## Reproducción local

Requisitos: Node.js 22, JDK 21, Android SDK con plataforma 35 y build tools compatibles, y aceptación local de licencias Android. Configure `ANDROID_HOME` y `JAVA_HOME` para su instalación. Desde la raíz del repositorio:

```sh
cd apps/frontend
npm ci
API_URL=https://stockaware-api.onrender.com/api npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

El resultado es `apps/frontend/android/app/build/outputs/apk/debug/app-debug.apk`. El build usa el wrapper de T2 para fijar la URL pública, y Capacitor copia `dist/browser`. Vuelva a compilar y sincronizar tras cambiar código o URL; sincronizar por sí solo no recompila Angular. No incluya credenciales en la URL: queda embebida en el APK. El scaffold y el wrapper Gradle se versionan; assets copiados, SDK local, builds y claves no.

## Verificación manual pendiente

Con autorización y datos de prueba adecuados, instale el APK en un emulador o dispositivo Android (`adb install -r app/build/outputs/apk/debug/app-debug.apk` desde `apps/frontend/android`). Confirme inicio de sesión y navegación a Stock; desconecte la red, observe el estado degradado, reconéctela y confirme recuperación. No registre credenciales ni datos privados en evidencia. La preflight CORS previa para `https://localhost` no demuestra autenticación ni funcionamiento en dispositivo. El registro del service worker PWA está deshabilitado en la plataforma nativa; el comportamiento web se documenta en [PWA](pwa.md).

La generación del proyecto no demuestra que el workflow, el APK, la instalación o el flujo autenticado hayan sido ejecutados correctamente. Registrar esos resultados por separado antes de cerrar la entrega.
