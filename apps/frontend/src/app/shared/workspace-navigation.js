/**
 * Navigation organized by what the user does, not by the ERP permission tree.
 *
 * The backend menu (acceso_funciones filtered by permisos) still decides what a
 * profile may open. This module only regroups those options into a few purpose
 * entries and hides the ones without a screen.
 */

/** Maestros used in daily operation; the rest are system settings. */
const MAESTROS_NEGOCIO = [
  'ADM_MAT_FUN', 'ADM_BODEGA', 'ADM_PROVEEDOR', 'ADM_CCOSTO',
  'ADM_EQUIPOS', 'ADM_VEHICULO', 'ADM_PERSONAL', 'ADM_CLIENTE', 'ADM_U_OBRA',
];
const GRUPOS_CONFIGURACION = ['MANTENEDOR', 'ADMINISTRACION'];

const REGISTRO = [
  { codigo: 'ING_MATERIAL', titulo: 'Ingreso desde HES' },
  { codigo: 'RECIBE_GR', titulo: 'Ingreso manual' },
  { codigo: 'EMITE_GR', titulo: 'Salida de bodega' },
  { codigo: 'ENTREGA_MAT', titulo: 'Entrega de fungibles' },
];

/**
 * Sections in display order. `codigos` are in preference order: the entry
 * opens the first one the profile has.
 */
const SECCIONES = [
  {
    key: 'compras', titulo: 'Compras',
    entradas: [{
      key: 'ordenes', titulo: 'Órdenes de compra', detalle: 'Emitir, aprobar y recibir',
      codigos: ['EMITE_OC', 'CON_DOC_EMI', 'EMITE_HES', 'EDITA_OC'], prefijos: ['/oc/'],
    }],
  },
  {
    key: 'bodega', titulo: 'Bodega',
    entradas: [
      { key: 'stock', titulo: 'Stock', detalle: 'Saldo, reposición y ajustes', codigos: ['MATERIAL_X_BODEGA'] },
      { key: 'movimientos', titulo: 'Movimientos', detalle: 'Entradas y salidas', codigos: ['BODEGA_MOVIMIENTOS'] },
      {
        key: 'registrar', titulo: 'Registrar movimiento', detalle: 'Ingresos, salidas y entregas',
        codigos: REGISTRO.map((p) => p.codigo),
      },
    ],
  },
  {
    key: 'finanzas', titulo: 'Finanzas',
    entradas: [
      { key: 'distribucion', titulo: 'Distribuir facturas', detalle: 'Reparto por centro de costo', codigos: ['DOC_DISTRIBUIR'] },
      { key: 'balance', titulo: 'Balance', detalle: 'Gasto por centro de costo', codigos: ['BALANCE_CCOSTO'] },
    ],
  },
  {
    key: 'configuracion', titulo: 'Sistema',
    entradas: [{
      key: 'configuracion', titulo: 'Configuración', detalle: 'Maestros y ajustes',
      grupos: GRUPOS_CONFIGURACION, ruta: '/configuracion', prefijos: ['/configuracion'],
    }],
  },
];

const lista = (menu) => (Array.isArray(menu) ? menu : []);

/** Implemented option codes the profile can open, optionally limited to some menu groups. */
function codigosImplementados(menu, grupos) {
  return new Set(lista(menu)
    .filter((g) => !grupos || grupos.includes(g.codigo))
    .flatMap((g) => (Array.isArray(g.opciones) ? g.opciones : []))
    .filter((o) => o.implementada)
    .map((o) => o.codigo));
}

/**
 * @param {Array<{codigo: string, opciones?: Array<{codigo: string, implementada: boolean}>}>} menu
 * @returns {Array<{key: string, titulo: string, entradas: Array<{key: string, titulo: string, detalle: string, ruta: string, codigos: string[], prefijos: string[]}>}>}
 */
function construirNavegacion(menu) {
  const disponibles = codigosImplementados(menu);
  return SECCIONES.map((seccion) => ({
    key: seccion.key,
    titulo: seccion.titulo,
    entradas: seccion.entradas.flatMap((e) => {
      const codigos = e.grupos
        ? [...codigosImplementados(menu, e.grupos)]
        : e.codigos.filter((c) => disponibles.has(c));
      if (!codigos.length) return [];
      return [{
        key: e.key, titulo: e.titulo, detalle: e.detalle,
        ruta: e.ruta ?? `/f/${codigos[0]}`, codigos, prefijos: e.prefijos ?? [],
      }];
    }),
  })).filter((s) => s.entradas.length > 0);
}

/**
 * Key of the entry that owns a URL, or null.
 * @param {ReturnType<typeof construirNavegacion>} navegacion
 * @param {string} url
 */
function entradaActiva(navegacion, url) {
  const ruta = String(url ?? '').split(/[?#]/)[0];
  const codigo = ruta.startsWith('/f/') ? ruta.slice(3) : null;
  for (const seccion of navegacion) {
    for (const e of seccion.entradas) {
      if (codigo && e.codigos.includes(codigo)) return e.key;
      if (e.prefijos.some((p) => ruta.startsWith(p))) return e.key;
    }
  }
  return null;
}

/** Tabs of "Registrar movimiento" the profile can open. */
function pestanasRegistro(menu) {
  const disponibles = codigosImplementados(menu);
  return REGISTRO.filter((p) => disponibles.has(p.codigo));
}

/** Implemented maestros split into daily business data and system settings. */
function maestrosConfiguracion(menu) {
  const opciones = lista(menu)
    .filter((g) => GRUPOS_CONFIGURACION.includes(g.codigo))
    .flatMap((g) => (Array.isArray(g.opciones) ? g.opciones : []))
    .filter((o) => o.implementada);
  const negocio = opciones.filter((o) => MAESTROS_NEGOCIO.includes(o.codigo))
    .sort((a, b) => MAESTROS_NEGOCIO.indexOf(a.codigo) - MAESTROS_NEGOCIO.indexOf(b.codigo));
  const sistema = opciones.filter((o) => !MAESTROS_NEGOCIO.includes(o.codigo));
  return [
    { key: 'negocio', titulo: 'Datos del negocio', opciones: negocio },
    { key: 'sistema', titulo: 'Ajustes del sistema', opciones: sistema },
  ].filter((g) => g.opciones.length > 0);
}

/**
 * Pending work shown on Inicio. Each item needs the permission to act on it
 * and an entry in the profile navigation to open it.
 */
const PENDIENTES = [
  {
    key: 'oc-aprobar', entrada: 'ordenes', permiso: 'APRUEBA_ORDEN_COMPRA', query: { estado: 'PENDIENTE' },
    titulo: 'Órdenes por aprobar', detalle: 'Esperan tu aprobación para emitirse',
  },
  {
    key: 'oc-recibir', entrada: 'ordenes', permiso: 'EMITE_HES', query: { estado: 'EMITIDO' },
    titulo: 'Órdenes por recibir', detalle: 'Emitidas con recepción pendiente',
  },
  {
    key: 'facturas', entrada: 'distribucion', permiso: 'DOC_DISTRIBUIR', query: { estado: 'ACEPTADO' },
    titulo: 'Facturas por distribuir', detalle: 'Aceptadas sin reparto a centros de costo',
  },
  {
    key: 'reponer', entrada: 'stock', permiso: 'MATERIAL_X_BODEGA', query: { bajo: '1' },
    titulo: 'Materiales por reponer', detalle: 'Stock bajo el mínimo en alguna bodega',
  },
];

/**
 * @param {ReturnType<typeof construirNavegacion>} navegacion
 * @param {string[]} permisos
 */
function pendientesPerfil(navegacion, permisos) {
  const tiene = new Set(Array.isArray(permisos) ? permisos : []);
  const entradas = new Map(lista(navegacion).flatMap((s) => s.entradas).map((e) => [e.key, e]));
  return PENDIENTES.flatMap((p) => {
    const e = entradas.get(p.entrada);
    if (!e || !tiene.has(p.permiso)) return [];
    return [{ key: p.key, titulo: p.titulo, detalle: p.detalle, ruta: e.ruta, query: p.query }];
  });
}

/**
 * Global "Crear" menu. Each action opens the first screen the profile can use
 * for it; actions without an implemented option are left out.
 */
const CREAR = [
  { key: 'oc', titulo: 'Orden de compra', area: 'compras', codigos: ['EMITE_OC'], ruta: '/oc/nueva' },
  { key: 'ingreso', titulo: 'Ingreso a bodega', area: 'bodega', codigos: ['ING_MATERIAL', 'RECIBE_GR'] },
  { key: 'salida', titulo: 'Salida de bodega', area: 'bodega', codigos: ['EMITE_GR', 'ENTREGA_MAT'] },
  { key: 'reparto', titulo: 'Reparto de factura', area: 'finanzas', codigos: ['DOC_DISTRIBUIR'] },
];

/** @param {Array<{codigo: string, opciones?: Array<{codigo: string, implementada: boolean}>}>} menu */
function accionesCrear(menu) {
  const disponibles = codigosImplementados(menu);
  return CREAR.flatMap((a) => {
    const codigo = a.codigos.find((c) => disponibles.has(c));
    if (!codigo) return [];
    return [{ key: a.key, titulo: a.titulo, area: a.area, ruta: a.ruta ?? `/f/${codigo}` }];
  });
}

module.exports = {
  accionesCrear, construirNavegacion, entradaActiva, maestrosConfiguracion, pendientesPerfil, pestanasRegistro,
};
