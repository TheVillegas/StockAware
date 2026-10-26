# Prototipo Figma EP2: consulta, revisión y errores

Actualizado el 2026-10-26 en el archivo existente, sin modificar las tres páginas EP1. Abrir el [flujo navegable EP2](https://www.figma.com/proto/RIvAtOoqdvHUBkURaxOopG/StockAware---Prototipo-EP1?page-id=56%3A6&node-id=59-1279&starting-point-node-id=59%3A1279&scaling=scale-down-width) o la [página editable EP2](https://www.figma.com/design/RIvAtOoqdvHUBkURaxOopG/StockAware---Prototipo-EP1?node-id=56-6).

## Recorrido

| Acción | Pantalla / resultado |
| --- | --- |
| Entrar con los campos ilustrativos | Stock, selección de materiales; no autentica contra el ERP |
| Precios de mercado de `MC_202` | Cinco candidatos de Dartel; fuentes sin resultados y fuentes que necesitan URL |
| Confirmar el primer candidato | Aviso «Candidato confirmado.» y estado `CONFIRMADO` |
| Desde la consulta inicial, rechazar el candidato VERDE | Aviso de rechazo; ese candidato desaparece de la lista |
| Volver al stock, abrir `MC_203` | Mensaje de indisponibilidad del procesamiento, sin precios inventados |
| Volver al stock, abrir `MC_204` | Falla de Dartel y un candidato de Dimeiggs como ejemplo de respuesta parcial |

Las revisiones son ramas independientes de navegación, no una sesión persistente. Los demás controles son referencia visual; el alcance está escrito junto a las pantallas. La prueba real de permisos, persistencia y errores está en la [demo local](demo-local.md), no en Figma.

## Correspondencia y comprobación

- Siete pantallas, cuatro puntos de inicio y 16 enlaces entre pantallas verificados en la estructura del archivo.
- Componentes editables: adaptación de botones/campos existentes, barra lateral y candidatos reutilizables; no se importaron capturas aplanadas de la interfaz.
- Tipografías Public Sans e IBM Plex Mono y colores de `apps/frontend/src/theme/tokens.css`. Los tokens EP2 están separados para no alterar EP1.
- Textos y estados contrastados con `stock.page.ts`, `precios-panel.component.ts`, `precios-api.js` y las capturas de la demo. No se representa el motor adaptativo futuro como implementado.
- Capturas de composición revisadas; se corrigieron iconos, centrado, recorte y conexiones de revisión. El flujo se abrió en el navegador sin solicitar inicio de sesión; confirmar también el acceso desde la cuenta/dispositivo docente antes de entregar.
- Navegación comprobada en el navegador: entrada → stock → consulta → confirmación, regreso → consulta → rechazo, y rutas de error de procesamiento/falla parcial. La comprobación visual incluye desplazamiento por la lista; no reemplaza la demo funcional del ERP.

El nombre histórico del archivo conserva «Prototipo EP1». La página **04 · Prototipo EP2 — Precios de mercado** y los enlaces anteriores identifican el nuevo contenido. No se cambiaron permisos de uso compartido ni se movió el tag de la aplicación.
