# Sistema visual de StockAware

Especificación única de la interfaz del frontend (Angular 20 + Ionic 8). Define colores, tipografía, espaciado, componentes y comportamiento móvil de la dirección **Operacional denso**, con la variante móvil **A (tabla priorizada)**.

**Regla de uso:** para construir o revisar una pantalla basta con este documento. Si algo no está aquí, no se inventa en la pantalla: se agrega primero a este documento.

| Dato | Valor |
|------|-------|
| Estado | Aprobado para implementación, versión 1 |
| Alcance | Versión web (escritorio) primero, luego móvil variante A |
| Tema | Solo claro en la versión 1 |
| Fuera de alcance | Modo oscuro, barra de pestañas inferior, escaneo, modo sin conexión (variantes móviles B y C) |

## Ruta rápida

1. Todo valor visual sale de un token `--sa-*` (sección [Tokens](#1-tokens)). No se escriben hex, tamaños ni radios sueltos en los componentes.
2. Los tokens viven en `src/theme/tokens.css`. El puente hacia Ionic vive en `src/theme/ionic.css`. Los componentes compartidos viven en `src/theme/components.css` (sección [Archivos](#6-dónde-vive-cada-cosa)).
3. Cada pantalla usa las piezas de la sección [Componentes](#3-componentes). No redefine `.tabla`, `.aviso`, `.vacio` ni `.pastilla` dentro de su propio `styles`.
4. Antes de abrir el PR, se revisa la [lista de verificación](#7-lista-de-verificación).

---

## 1. Tokens

### 1.1 Color

Un solo color de acento (petróleo). Los colores de estado (ok, alerta, crítico, info) son semánticos y no cuentan como acento: solo comunican el estado de un dato.

**Superficies y texto**

| Token | Hex | Uso |
|-------|-----|-----|
| `--sa-bg` | `#f6f7f8` | Fondo de página (`ion-content`) |
| `--sa-surface` | `#ffffff` | Paneles, tablas, formularios, barra superior de escritorio |
| `--sa-surface-2` | `#eef1f2` | Hover de fila, campos de solo lectura, fondos secundarios |
| `--sa-ink` | `#12161a` | Texto principal |
| `--sa-ink-soft` | `#5a626b` | Texto secundario, etiquetas, encabezados de tabla |
| `--sa-line` | `#e3e7ea` | Divisor entre filas |
| `--sa-line-strong` | `#d5dade` | Borde de paneles, borde inferior de encabezados de tabla y barras |
| `--sa-border-input` | `#8b949c` | Borde de inputs, selects y botones secundarios (contraste 3:1 con blanco) |

**Acento**

| Token | Hex | Uso |
|-------|-----|-----|
| `--sa-accent` | `#155e63` | Botón primario, enlaces, foco, ítem activo del contenido |
| `--sa-accent-hover` | `#125357` | Hover y presionado del botón primario |
| `--sa-accent-ink` | `#ffffff` | Texto sobre el acento (contraste 7.5:1) |
| `--sa-accent-tint` | `#e6f0f0` | Fila seleccionada o expandida |

**Armazón (menú lateral y barra superior móvil)**

| Token | Hex | Uso |
|-------|-----|-----|
| `--sa-shell` | `#0e2a2c` | Fondo del menú lateral y de la barra superior en móvil |
| `--sa-shell-2` | `#12383a` | Fondo del ítem de menú activo y hover |
| `--sa-shell-line` | `#1c3d3f` | Divisores dentro del armazón |
| `--sa-shell-ink` | `#cfe0df` | Texto de ítems de menú |
| `--sa-shell-soft` | `#7fa3a1` | Títulos de sección del menú, textos secundarios del armazón |
| `--sa-shell-mark` | `#4fd0bd` | Solo la franja de 3px del ítem activo y la marca "Aware" del logotipo. Nunca como texto sobre fondo claro |

**Estado (semánticos)**

Cada estado tiene tres tonos: `fg` para texto e íconos, `bg` para el fondo de pastillas y avisos, `line` para el borde de avisos.

| Estado | `fg` | `bg` | `line` | Significado |
|--------|------|------|--------|-------------|
| `ok` | `#1d6b2f` | `#d6ecd8` | `#b9dcbd` | Correcto, cerrado, stock sobre el mínimo |
| `warn` | `#7a5a00` | `#fbe6c8` | `#eedcb8` | Requiere atención pronto, pendiente |
| `crit` | `#8f2019` | `#f7dcd9` | `#efcccc` | Error, sin stock, acción bloqueada |
| `info` | `#14508a` | `#d9e8f7` | `#c2d7ee` | Informativo, emitido, en proceso |

Tokens: `--sa-ok-fg`, `--sa-ok-bg`, `--sa-ok-line`, y así para `warn`, `crit` e `info`. Para bordes de error en inputs se usa `--sa-crit` = `#b0281f`.

### 1.2 Tipografía

| Rol | Familia | Pesos | Uso |
|-----|---------|-------|-----|
| Texto | IBM Plex Sans | 400, 500, 600 | Todo el texto de la interfaz |
| Datos | IBM Plex Mono | 400, 500, 600 | Todo número, monto, cantidad, fecha en tabla, código (`MC_10421`, N° de OC, código de función) |

Fallback: `system-ui, -apple-system, "Segoe UI", sans-serif` para Sans y `ui-monospace, "Cascadia Mono", Consolas, monospace` para Mono.

**Carga de fuentes:** se autoalojan con `@fontsource/ibm-plex-sans` y `@fontsource/ibm-plex-mono` (npm), no con un `<link>` a Google Fonts. La app corre como PWA y en Capacitor, y tiene que mostrar las fuentes sin conexión. Instalación:

```bash
npm install @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
```

**Escala (única permitida)**

| Token | Tamaño | Alto de línea | Peso | Uso |
|-------|--------|---------------|------|-----|
| `--sa-text-label` | 11px | 1.3 | 600 | Encabezados de tabla, etiquetas de KPI, títulos de sección del menú. Siempre en mayúsculas con `letter-spacing: .06em` |
| `--sa-text-meta` | 12px | 1.4 | 400 o 500 | Texto de apoyo, ayuda bajo inputs, errores, migas, perfil de usuario |
| `--sa-text-dense` | 13px | 1.35 | 400 | Celdas de tabla, ítems de menú, botones |
| `--sa-text-body` | 14px | 1.45 | 400 | Texto corrido, inputs en escritorio |
| `--sa-text-input-mobile` | 16px | 1.3 | 400 | Inputs bajo 768px (evita el zoom automático de iOS) |
| `--sa-text-title` | 16px | 1.25 | 600 | Título de panel o de ficha |
| `--sa-text-page` | 18px | 1.25 | 600 | Título de página en la barra superior |
| `--sa-text-kpi` | 24px | 1.1 | 600, Mono | Valor de KPI |

Reglas:

- Todo número va en Mono con `font-variant-numeric: tabular-nums`. En tablas se alinea a la derecha.
- Mayúsculas solo en el tamaño `label`. Títulos, botones y textos van en tipo oración ("ÓRDENES DE COMPRA" no, "Órdenes de compra" sí; "GUARDAR" no, "Guardar" sí). Excepción: las pastillas de estado, ver [3.4](#34-pastilla-de-estado-sa-pill).
- No se usan otros tamaños. Si una pantalla "necesita" 10px o 15px, se ajusta al token más cercano.

### 1.3 Espaciado, forma y elevación

| Token | Valor | Uso |
|-------|-------|-----|
| `--sa-space-1` | 4px | Separación entre ícono y texto, dentro de pastillas |
| `--sa-space-2` | 8px | Separación entre controles de una barra, padding vertical de celda |
| `--sa-space-3` | 12px | Padding horizontal de celda, padding de paneles en móvil |
| `--sa-space-4` | 16px | Padding de paneles en escritorio, margen lateral mínimo en móvil |
| `--sa-space-5` | 24px | Separación entre bloques de una página |
| `--sa-space-6` | 32px | Margen inferior de página |
| `--sa-radius` | 6px | Botones, inputs, selects, paneles, avisos, tarjetas de KPI, modales |
| `--sa-radius-pill` | 3px | Solo pastillas de estado |
| `--sa-border` | 1px | Todo borde y divisor |
| `--sa-focus` | `2px solid var(--sa-accent)`, offset 2px | Foco visible de todo control |

- **Sin sombras** en la interfaz. La jerarquía se marca con fondo, borde de 1px y espacio. Excepción: el menú superpuesto y los modales conservan la sombra por defecto de Ionic.
- Un único radio (6px). La única excepción documentada son las pastillas (3px).

### 1.4 Tamaños de control y breakpoints

| Breakpoint | Rango | Comportamiento |
|------------|-------|----------------|
| Móvil | menor a 768px | Menú superpuesto, barra superior oscura, tabla priorizada (variante A), controles de 44px |
| Tableta | 768px a 991px | Menú superpuesto, barra superior clara de escritorio, tablas completas con scroll horizontal |
| Escritorio | 992px o más | Menú lateral fijo (`ion-split-pane`, `when="lg"`, valor por defecto de Ionic) |

| Elemento | Escritorio y tableta | Móvil |
|----------|----------------------|-------|
| Botón y input | 36px de alto | 44px de alto |
| Botón pequeño (acción dentro de fila) | 28px | No se usa: la acción pasa a la fila expandida |
| Fila de tabla | 34px aprox. (padding 8px 12px) | 44px mínimo |
| Ítem de menú | 36px | 44px |
| Barra superior | 48px | 56px |
| Menú lateral | 240px de ancho | 280px, superpuesto |

---

## 2. Armazón de la aplicación

### 2.1 Escritorio (992px o más)

```text
+------------------+-----------------------------------------------------------+
| StockAware       | Materiales por bodega              Nombre Apellido  Salir |
|                  | MATERIAL_X_BODEGA                   Perfil               |
| Inicio           +-----------------------------------------------------------+
|                  | [aviso, si corresponde]                                   |
| BODEGA Y MATER.  | [barra de filtros ........................ Acción prim.] |
| > Materiales ... | +-------------------------------------------------------+ |
|   Movimientos    | | TABLA                                                 | |
|   Recibe mat...  | |                                                       | |
| COMPRAS          | +-------------------------------------------------------+ |
|   Órdenes de c.  |                                                           |
+------------------+-----------------------------------------------------------+
  240px, --sa-shell            --sa-bg, contenido con .page-content
```

**Menú lateral** (`app.component.ts`)

| Parte | Especificación |
|-------|----------------|
| Fondo | `--sa-shell` en todo el menú, incluido `ion-content` del menú |
| Marca | "Stock" en `#ffffff` y "Aware" en `--sa-shell-mark`, Mono 600, 15px, padding 16px, borde inferior `--sa-shell-line` |
| Título de área (encabezado del acordeón) | Tamaño `label`, color `--sa-shell-soft`, fondo transparente, padding 16px 16px 4px. Sin `color="light"` |
| Ítem | 13px, color `--sa-shell-ink`, alto 36px, padding horizontal 16px |
| Ítem hover | Fondo `--sa-shell-2` |
| Ítem activo | Fondo `--sa-shell-2`, texto `#ffffff` peso 600, franja izquierda de 3px `--sa-shell-mark` |
| Ítem no implementado (`pendiente`) | Opacidad .55, se mantiene clicable como hoy |
| Contenido | Lo entrega el backend (`agruparAreas`). No se escriben opciones a mano |

**Barra superior** (`page-header.component.ts`)

| Parte | Especificación |
|-------|----------------|
| Alto y fondo | 48px, `--sa-surface`, borde inferior `--sa-line-strong` |
| Izquierda | Título de página (tamaño `page`) y debajo el código de función en Mono 11px `--sa-ink-soft` |
| Nombre "StockAware" en la barra | Se elimina en escritorio: ya está en el menú lateral |
| Derecha | Acciones de la página (`header-actions`), luego usuario (12px 600) y perfil (12px `--sa-ink-soft`) en dos líneas, luego botón "Salir" secundario |
| Botón de menú | Oculto en escritorio (lo resuelve `ion-split-pane`) |

**Área de contenido**

- Se mantienen `.page-content` (máximo 960px) y `.page-content--wide` (máximo 1440px) de `styles.css`.
- Pantallas con tablas usan `.page-content--wide`. Formularios y fichas usan `.page-content`.
- Orden vertical fijo de una pantalla: aviso (si existe), KPIs (si existen), barra de filtros, contenido principal, paginación. Separación entre bloques: `--sa-space-5`.

### 2.2 Móvil, variante A (menor a 768px)

```text
+-------------------------------------+
| [≡]  Materiales               [MS]  |  56px, --sa-shell, texto blanco
|      MXB · 01 Central Renca         |
+-------------------------------------+
| 5 materiales bajo mínimo. Filtrar   |  aviso
+-------------------------------------+
| [ Buscar código o nombre ] [Filtros]|  44px
+-------------------------------------+
| MATERIAL               STOCK    MÍN |
| MC_10421                            |
| Guante nitrilo talla L    18    120 |  fila tocada: expandida
|   Código      MC_10421              |
|   Bodega      01 Central Renca      |
|   Unidad      par                   |
|   [Ajustar stock]                   |
| Casco de seguridad clase E  3    25 |
+-------------------------------------+
```

| Parte | Especificación |
|-------|----------------|
| Barra superior | 56px, fondo `--sa-shell`, título 16px 600 blanco, código de función en Mono 11px `--sa-shell-soft`. Botón de menú a la izquierda, botón con iniciales del usuario a la derecha (abre un popover con nombre, perfil y "Salir") |
| Menú | `ion-menu` superpuesto de 280px, mismas reglas visuales que en escritorio, ítems de 44px |
| Acciones de página | Máximo una visible en la barra. El resto va en el popover del usuario o en la pantalla |
| Márgenes | 12px laterales dentro de paneles, 16px mínimo contra el borde de la pantalla para texto suelto |
| KPIs | Grilla de 2 columnas |
| Filtros | La barra de filtros se reduce a búsqueda + botón "Filtros", que abre un `ion-modal` tipo hoja (`breakpoints: [0, 0.6, 1]`) con los demás filtros y un botón "Aplicar" |

**Tabla priorizada (regla central de la variante A)**

1. Cada tabla declara la prioridad de sus columnas: **P1** siempre visible, **P2** visible desde 768px, **P3** visible desde 992px.
2. En móvil se muestran como máximo 3 columnas P1. El código del material va como línea superior Mono 11px dentro de la celda del nombre, no como columna.
3. Tocar una fila la expande: debajo aparece una lista de pares etiqueta y valor con todas las columnas ocultas y las acciones de la fila como botones de 44px.
4. Solo una fila expandida a la vez. La fila expandida tiene fondo `--sa-accent-tint` y borde inferior de 2px `--sa-accent`.
5. La fila tiene `aria-expanded` y responde a Enter y Espacio.

Prioridades para las tablas existentes:

| Pantalla | P1 (móvil) | P2 (768px o más) | P3 (992px o más) |
|----------|------------|------------------|------------------|
| Materiales por bodega | Material, Stock, Mínimo | Bodega, Unidad | Código (columna propia), Tarifa, Acciones |
| Movimientos de bodega | Fecha, Material, Cantidad | Tipo, Bodega | Documento, Usuario |
| Órdenes de compra | N° OC, Proveedor, Estado | Fecha, Total | Centro de costo, Avance |
| Otras tablas | Se definen en el PR de esa pantalla y se agregan a esta tabla antes de implementarla |

---

## 3. Componentes

Cada componente se implementa una sola vez en `src/theme/components.css` (o como componente Angular en `src/app/shared/` cuando tiene lógica). Las pantallas lo usan, no lo copian.

### 3.1 Botón

| Variante | Fondo | Texto | Borde | Uso |
|----------|-------|-------|-------|-----|
| Primario | `--sa-accent` | `--sa-accent-ink` | `--sa-accent` | La acción principal de la vista. Máximo uno por vista |
| Secundario | transparente | `--sa-accent` | `--sa-border-input` | Acciones alternativas, "Cancelar", filtros rápidos |
| Peligro | transparente | `--sa-crit` | `--sa-crit` | Eliminar, anular. Siempre pide confirmación en pantalla |
| Texto | transparente | `--sa-accent` | ninguno | Enlaces de acción dentro de avisos o vacíos |

- Etiqueta 13px peso 600, tipo oración, verbo concreto ("Guardar ajuste", "Emitir OC"). Máximo 3 palabras. Nunca en dos líneas.
- Estados: hover (primario pasa a `--sa-accent-hover`, secundario toma fondo `--sa-surface-2`), foco (`--sa-focus`), deshabilitado (opacidad .45, sin hover), cargando (spinner de 16px en lugar del texto, mismo ancho, deshabilitado).
- En Ionic: `ion-button` con `fill="solid"` (primario), `fill="outline"` (secundario y peligro) y `fill="clear"` (texto). Radio y alto vía `--border-radius` y `--min-height` según [1.4](#14-tamaños-de-control-y-breakpoints).

### 3.2 Campo de formulario

```text
Stock que debe quedar          <- etiqueta, 12px 500 --sa-ink-soft
+------------------------------+
| -5                       par |  <- input, 36px (44px en móvil), Mono si es número
+------------------------------+
El stock no puede ser negativo <- error, 12px --sa-crit-fg
```

| Parte | Especificación |
|-------|----------------|
| Etiqueta | Siempre arriba del control, 12px peso 500, `--sa-ink-soft`. Nunca un placeholder como etiqueta |
| Control | Fondo `--sa-surface`, borde 1px `--sa-border-input`, radio 6px, padding horizontal 10px. Texto 14px (16px en móvil). Números y códigos en Mono |
| Unidad | Dentro del control a la derecha, 12px `--sa-ink-soft` |
| Ayuda | Debajo, 12px `--sa-ink-soft`. Opcional |
| Error | Debajo, 12px `--sa-crit-fg`, reemplaza a la ayuda. Borde del control pasa a 2px `--sa-crit` |
| Foco | Borde `--sa-accent` + `--sa-focus` |
| Solo lectura | Fondo `--sa-surface-2`, texto `--sa-ink-soft`, sin borde de foco |
| Separación | 4px entre etiqueta y control, 16px entre campos |
| Validación | Al salir del campo y al enviar. No mientras se escribe |

En Ionic: `ion-input` y `ion-select` con `label-placement="stacked"` y `fill="outline"`; `ion-searchbar` solo para búsquedas de lista.

### 3.3 Tabla (`.sa-table`)

| Parte | Especificación |
|-------|----------------|
| Contenedor | Panel con fondo `--sa-surface`, borde `--sa-line-strong`, radio 6px, `overflow-x: auto` |
| Encabezado | Tamaño `label`, `--sa-ink-soft`, padding 8px 12px, borde inferior `--sa-line-strong`, fijo (`position: sticky; top: 0`) cuando la tabla hace scroll vertical |
| Celda | 13px, padding 8px 12px, borde inferior `--sa-line`, `white-space: nowrap` salvo en la columna de nombre |
| Números | Clase `.num`: Mono, `tabular-nums`, alineados a la derecha (también su encabezado) |
| Códigos | Clase `.code`: Mono 12px |
| Hover | Fila con fondo `--sa-surface-2` |
| Seleccionada | Fondo `--sa-accent-tint` |
| Sin rayado | No se usan filas alternadas de color |
| Acciones de fila | Botón secundario pequeño (28px) en la última columna. En móvil, dentro de la fila expandida |
| Cantidad de resultados | Arriba a la derecha de la barra de filtros: "148 materiales", 12px Mono `--sa-ink-soft` |

### 3.4 Pastilla de estado (`.sa-pill`)

- Mono 11px peso 600, mayúsculas, padding 2px 6px, radio 3px, fondo `--sa-{estado}-bg`, texto `--sa-{estado}-fg`.
- Texto siempre presente: el color nunca es la única señal.
- No se usan puntos de color decorativos en listas ni menús.

**Estados de stock** (reglas actuales del código, no se agregan otras sin respaldo de datos):

| Condición | Pastilla | Número de stock |
|-----------|----------|-----------------|
| stock = 0 | `crit`, "SIN STOCK" | `--sa-crit-fg`, peso 600 |
| 0 < stock < mínimo | `warn`, "BAJO MÍNIMO" | `--sa-crit-fg`, peso 600 |
| stock ≥ mínimo | `ok`, "OK" | `--sa-ink` |

**Estados de documento** (OC, HES, guías): `PENDIENTE` = `warn`, `EMITIDO` = `info`, `CERRADO` = `ok`, `ANULADO` = `crit`. Se usa el texto que entrega el backend, en mayúsculas.

### 3.5 Aviso (`.sa-notice`)

- Franja de ancho completo del contenido, radio 6px, padding 8px 12px, texto 13px.
- Fondo `--sa-{estado}-bg`, borde 1px `--sa-{estado}-line`, texto `--sa-{estado}-fg`.
- Contenido: una frase que dice qué pasa + una acción opcional como botón de texto ("5 materiales bajo mínimo en 01 Central Renca. **Filtrar**").
- Máximo un aviso por pantalla. Errores de formulario van en el campo, no en un aviso.
- Confirmaciones pasajeras ("Ajuste guardado") van en `ion-toast`, 3 segundos, abajo, sin color de estado.

### 3.6 Fila de KPIs (`.sa-kpis`)

- Grilla de 4 columnas en escritorio, 2 en móvil. Celdas unidas por líneas de 1px (`gap: 1px` sobre fondo `--sa-line-strong`), dentro de un panel con radio 6px.
- Cada celda: etiqueta (tamaño `label`), valor (tamaño `kpi`, Mono) y variación opcional (Mono 12px; `--sa-ok-fg` si mejora, `--sa-crit-fg` si empeora, `--sa-ink-soft` si es neutra).
- Solo en Inicio y en pantallas cuyo propósito sea un resumen. No se agregan KPIs decorativos.

### 3.7 Estados vacío, carga y error

| Estado | Especificación |
|--------|----------------|
| Vacío (`.sa-empty`) | Centrado dentro del panel de la tabla, padding 32px. Título 14px 600 que dice qué no hay ("Sin materiales para 'respirador'"), una frase 13px `--sa-ink-soft` con la causa, y una acción ("Limpiar búsqueda") |
| Carga | `ion-skeleton-text` con la forma de la tabla: 5 filas con el alto real de fila. El `ion-spinner` centrado de hoy se reemplaza. Spinner solo dentro de botones |
| Error de carga | Aviso `crit` con la causa en lenguaje de usuario y botón de texto "Reintentar". Sin códigos técnicos a la vista |

### 3.8 Íconos

- Se usa `ionicons` (ya está en el proyecto), estilo outline, 20px, color heredado del texto.
- Solo cuando agregan significado: menú, cerrar sesión, búsqueda, filtros, expandir fila. Nunca como adorno de títulos.
- Todo botón con solo ícono lleva `aria-label`.

### 3.9 Textos de interfaz

- Español neutro de Chile, con tildes, tipo oración, sin guiones largos: se usa el guion común `-`.
- Trato de tú, nunca voseo: "Ingresa el stock contado", "Elige una bodega", "Revisa los filtros". Formas como "ingresá", "elegí", "tocá" o "podés" no se usan.
- Sin modismos regionales ni coloquiales. Si una frase depende de un modismo, se reescribe en forma directa.
- Nombres de pantalla iguales a los que entrega el backend en el menú.
- Botones con verbo; errores que dicen qué pasó y cómo seguir ("Ingresa el stock contado", no "Campo inválido").
- Montos en CLP con separador de miles de punto y sin decimales: `$1.746.000`. Fechas en tablas: `25-09-2026`.

---

## 4. Ejemplo de referencia

Materiales por bodega en escritorio, armado solo con piezas de este documento:

```html
<app-page-header title="Materiales por bodega">
  <ion-button header-actions fill="outline">Exportar CSV</ion-button>
</app-page-header>

<ion-content>
  <div class="page-content page-content--wide">
    <div class="sa-notice sa-notice--warn">
      5 materiales bajo mínimo en 01 Central Renca.
      <button type="button" class="sa-link">Filtrar</button>
    </div>

    <div class="sa-toolbar">
      <ion-select label="Bodega" label-placement="stacked" fill="outline">…</ion-select>
      <ion-searchbar placeholder="Código o nombre"></ion-searchbar>
      <span class="sa-count">148 materiales</span>
    </div>

    <div class="sa-table-wrap">
      <table class="sa-table">
        <thead>
          <tr><th>Material</th><th>Bodega</th><th>Unidad</th>
              <th class="num">Stock</th><th class="num">Mínimo</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="code">MC_10421</span><br>Guante nitrilo talla L</td>
            <td>01 Central Renca</td><td>par</td>
            <td class="num is-low">18</td><td class="num">120</td>
            <td><span class="sa-pill sa-pill--warn">BAJO MÍNIMO</span></td>
            <td><ion-button size="small" fill="outline">Ajustar</ion-button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</ion-content>
```

Los datos de este ejemplo son ilustrativos.

---

## 5. Tokens como código

Contenido de referencia de `src/theme/tokens.css`. Es la traducción literal de la sección 1.

```css
:root {
  /* superficies y texto */
  --sa-bg: #f6f7f8;
  --sa-surface: #ffffff;
  --sa-surface-2: #eef1f2;
  --sa-ink: #12161a;
  --sa-ink-soft: #5a626b;
  --sa-line: #e3e7ea;
  --sa-line-strong: #d5dade;
  --sa-border-input: #8b949c;

  /* acento */
  --sa-accent: #155e63;
  --sa-accent-hover: #125357;
  --sa-accent-ink: #ffffff;
  --sa-accent-tint: #e6f0f0;

  /* armazón */
  --sa-shell: #0e2a2c;
  --sa-shell-2: #12383a;
  --sa-shell-line: #1c3d3f;
  --sa-shell-ink: #cfe0df;
  --sa-shell-soft: #7fa3a1;
  --sa-shell-mark: #4fd0bd;

  /* estados */
  --sa-ok-fg: #1d6b2f;   --sa-ok-bg: #d6ecd8;   --sa-ok-line: #b9dcbd;
  --sa-warn-fg: #7a5a00; --sa-warn-bg: #fbe6c8; --sa-warn-line: #eedcb8;
  --sa-crit-fg: #8f2019; --sa-crit-bg: #f7dcd9; --sa-crit-line: #efcccc;
  --sa-info-fg: #14508a; --sa-info-bg: #d9e8f7; --sa-info-line: #c2d7ee;
  --sa-crit: #b0281f;

  /* tipografía */
  --sa-font-sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --sa-font-mono: "IBM Plex Mono", ui-monospace, "Cascadia Mono", Consolas, monospace;
  --sa-text-label: 11px;
  --sa-text-meta: 12px;
  --sa-text-dense: 13px;
  --sa-text-body: 14px;
  --sa-text-input-mobile: 16px;
  --sa-text-title: 16px;
  --sa-text-page: 18px;
  --sa-text-kpi: 24px;

  /* espacio y forma */
  --sa-space-1: 4px;
  --sa-space-2: 8px;
  --sa-space-3: 12px;
  --sa-space-4: 16px;
  --sa-space-5: 24px;
  --sa-space-6: 32px;
  --sa-radius: 6px;
  --sa-radius-pill: 3px;

  /* controles */
  --sa-control-h: 36px;
  --sa-control-h-sm: 28px;
  --sa-topbar-h: 48px;
  --sa-menu-w: 240px;
}

@media (max-width: 767.98px) {
  :root {
    --sa-control-h: 44px;
    --sa-topbar-h: 56px;
  }
}
```

Puente hacia Ionic, `src/theme/ionic.css`:

Los colores base se toman de los tokens con var(). Los valores -rgb, -shade y -tint quedan escritos porque Ionic los necesita en crudo; theme.spec.ts verifica que coincidan con tokens.css.

```css
:root {
  --ion-font-family: var(--sa-font-sans);
  --ion-background-color: var(--sa-bg);
  --ion-text-color: var(--sa-ink);
  --ion-border-color: var(--sa-line);
  --ion-item-background: var(--sa-surface);
  --ion-toolbar-background: var(--sa-surface);

  --ion-color-primary: var(--sa-accent);
  --ion-color-primary-rgb: 21, 94, 99;
  --ion-color-primary-contrast: var(--sa-accent-ink);
  --ion-color-primary-contrast-rgb: 255, 255, 255;
  --ion-color-primary-shade: var(--sa-accent-hover);
  --ion-color-primary-tint: #2c6e73;

  --ion-color-success: var(--sa-ok-fg);
  --ion-color-success-rgb: 29, 107, 47;
  --ion-color-success-contrast: #ffffff;
  --ion-color-success-contrast-rgb: 255, 255, 255;
  --ion-color-success-shade: #1a5e29;
  --ion-color-success-tint: #347a44;

  --ion-color-warning: var(--sa-warn-fg);
  --ion-color-warning-rgb: 122, 90, 0;
  --ion-color-warning-contrast: #ffffff;
  --ion-color-warning-contrast-rgb: 255, 255, 255;
  --ion-color-warning-shade: #6b4f00;
  --ion-color-warning-tint: #876b1a;

  --ion-color-danger: var(--sa-crit);
  --ion-color-danger-rgb: 176, 40, 31;
  --ion-color-danger-contrast: #ffffff;
  --ion-color-danger-contrast-rgb: 255, 255, 255;
  --ion-color-danger-shade: #9b231b;
  --ion-color-danger-tint: #b83e35;

  --ion-color-medium: var(--sa-ink-soft);
  --ion-color-medium-rgb: 90, 98, 107;
  --ion-color-medium-contrast: #ffffff;
  --ion-color-medium-contrast-rgb: 255, 255, 255;
  --ion-color-medium-shade: #4f565e;
  --ion-color-medium-tint: #6b727a;

  --ion-color-light: var(--sa-surface-2);
  --ion-color-light-rgb: 238, 241, 242;
  --ion-color-light-contrast: var(--sa-ink);
  --ion-color-light-contrast-rgb: 18, 22, 26;
  --ion-color-light-shade: #d1d4d5;
  --ion-color-light-tint: #f0f2f3;
}

ion-split-pane { --side-width: var(--sa-menu-w); --side-max-width: var(--sa-menu-w); }
ion-menu ion-content { --background: var(--sa-shell); }
```

---

## 6. Dónde vive cada cosa

| Archivo | Contenido | Estado |
|---------|-----------|--------|
| `src/theme/tokens.css` | Todos los `--sa-*` | Nuevo |
| `src/theme/ionic.css` | Traducción de tokens a variables `--ion-*` | Nuevo |
| `src/theme/components.css` | `.sa-table`, `.sa-pill`, `.sa-notice`, `.sa-kpis`, `.sa-empty`, `.sa-toolbar`, `.num`, `.code` | Nuevo. Reemplaza las copias de `.tabla`, `.aviso`, `.vacio`, `.pastilla`, `.num` que hoy están dentro del `styles` de cada página |
| `src/styles.css` | Importa los tres archivos anteriores y las fuentes; conserva `.page-content` | Se modifica |
| `src/app/app.component.ts` | Menú lateral según [2.1](#21-escritorio-992px-o-más) | Se modifica |
| `src/app/shared/page-header.component.ts` | Barra superior según [2.1](#21-escritorio-992px-o-más) y [2.2](#22-móvil-variante-a-menor-a-768px) | Se modifica |
| Páginas en `src/app/*` | Solo estilos propios de su diseño; nada de colores ni tamaños sueltos | Se migran una por una |

**Orden de implementación:** tokens, puente Ionic y fuentes → armazón (menú y barra) → componentes compartidos → páginas de escritorio una por una → comportamiento móvil variante A.

---

## 7. Lista de verificación

Para cada PR de interfaz:

- [ ] No hay hex, `px` de tipografía ni radios sueltos fuera de `src/theme/`. Todo usa `--sa-*`.
- [ ] Números y códigos en Mono con `tabular-nums`; números de tabla alineados a la derecha.
- [ ] Solo tamaños de la escala tipográfica; mayúsculas solo en etiquetas de 11px.
- [ ] Un solo botón primario por vista; etiquetas en una línea.
- [ ] Cada input tiene etiqueta arriba; los errores aparecen debajo del campo.
- [ ] La pantalla tiene estado vacío, de carga (skeleton) y de error.
- [ ] Las pastillas de estado siguen la tabla de [3.4](#34-pastilla-de-estado-sa-pill) y siempre llevan texto.
- [ ] Foco visible en todo control; botones de solo ícono con `aria-label`.
- [ ] Revisado a 1280px, 800px y 375px de ancho. En 375px la tabla muestra solo columnas P1 y la fila se expande.
- [ ] En móvil, controles de 44px y inputs de 16px.
- [ ] Textos en español con tildes y sin guiones largos.
