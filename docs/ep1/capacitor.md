# Capacitor (EP1)

La app Ionic/Angular usa Capacitor 7, con `appId` `cl.pucv.stockaware` y `webDir` `dist/browser`. El proyecto Android generado y el wrapper Gradle permiten reproducir un APK debug; los assets web se regeneran mediante `cap sync`. No hay proyecto iOS.

Las instrucciones de build, workflow y verificación pendiente están en [Android](../ef/android.md). El manifiesto y service worker web se describen en [PWA](../ef/pwa.md); el registro del worker está deshabilitado en Capacitor nativo. El scaffold por sí solo no demuestra instalación ni funcionamiento en dispositivo.
