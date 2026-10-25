// @ts-nocheck
const {
  construirNavegacion, entradaActiva, maestrosConfiguracion, pendientesPerfil, pestanasRegistro,
} = require('./workspace-navigation');

const opcion = (codigo, implementada = true) => ({ id: codigo, codigo, titulo: codigo, implementada });
const menuCompleto = [
  { id: 1, codigo: 'SOT', titulo: 'Terreno', opciones: [opcion('SOT_AT', false)] },
  { id: 2, codigo: 'BODEGA', titulo: 'Bodega', opciones: [
    opcion('BODEGA_MOVIMIENTOS'), opcion('EMITE_GR'), opcion('RECIBE_GR'), opcion('ING_MATERIAL'),
    opcion('ENTREGA_MAT'), opcion('MATERIAL_X_BODEGA'), opcion('PRODUCTO_X_BODEGA', false),
  ] },
  { id: 3, codigo: 'COMPRAS', titulo: 'Compras', opciones: [
    opcion('EMITE_OC'), opcion('EMITE_HES'), opcion('DOC_DISTRIBUIR'), opcion('EDITA_OC'),
  ] },
  { id: 4, codigo: 'DOCUMENTOS', titulo: 'Documentos', opciones: [opcion('CON_DOC_EMI')] },
  { id: 5, codigo: 'INFORMES_GESTION', titulo: 'Informes', opciones: [opcion('BALANCE_CCOSTO'), opcion('LIQUIDEZ', false)] },
  { id: 6, codigo: 'MANTENEDOR', titulo: 'Mantenedores', opciones: [
    opcion('ADM_COMUNA'), opcion('ADM_MAT_FUN'), opcion('ADM_PROVEEDOR'), opcion('ADM_USUARIO', false),
  ] },
  { id: 7, codigo: 'ADMINISTRACION', titulo: 'Administración', opciones: [opcion('PERFILES'), opcion('CON_LOG', false)] },
];

describe('construirNavegacion', () => {
  it('builds four purpose sections with seven entries from the full ERP menu', () => {
    const nav = construirNavegacion(menuCompleto);
    expect(nav.map((s) => s.key)).toEqual(['compras', 'bodega', 'finanzas', 'configuracion']);
    expect(nav.flatMap((s) => s.entradas.map((e) => e.titulo))).toEqual([
      'Órdenes de compra',
      'Stock', 'Movimientos', 'Registrar movimiento',
      'Distribuir facturas', 'Balance',
      'Configuración',
    ]);
  });

  it('routes each entry to the first code the profile has, in preference order', () => {
    const nav = construirNavegacion(menuCompleto);
    const ruta = (titulo) => nav.flatMap((s) => s.entradas).find((e) => e.titulo === titulo).ruta;
    expect(ruta('Órdenes de compra')).toBe('/f/EMITE_OC');
    expect(ruta('Registrar movimiento')).toBe('/f/ING_MATERIAL');
    expect(ruta('Configuración')).toBe('/configuracion');
  });

  it('falls back to another code when the preferred one is missing', () => {
    const nav = construirNavegacion([
      { id: 4, codigo: 'DOCUMENTOS', titulo: 'Documentos', opciones: [opcion('CON_DOC_EMI')] },
      { id: 2, codigo: 'BODEGA', titulo: 'Bodega', opciones: [opcion('ENTREGA_MAT')] },
    ]);
    expect(nav.map((s) => s.entradas.map((e) => e.ruta))).toEqual([['/f/CON_DOC_EMI'], ['/f/ENTREGA_MAT']]);
  });

  it('hides entries whose options are not implemented and sections left empty', () => {
    const nav = construirNavegacion([
      { id: 1, codigo: 'SOT', titulo: 'Terreno', opciones: [opcion('SOT_AT', false)] },
      { id: 2, codigo: 'BODEGA', titulo: 'Bodega', opciones: [opcion('MATERIAL_X_BODEGA', false), opcion('BODEGA_MOVIMIENTOS')] },
    ]);
    expect(nav).toEqual([
      expect.objectContaining({ key: 'bodega', entradas: [expect.objectContaining({ titulo: 'Movimientos' })] }),
    ]);
  });

  it('returns an empty navigation for a missing or empty menu', () => {
    expect(construirNavegacion(undefined)).toEqual([]);
    expect(construirNavegacion([])).toEqual([]);
  });
});

describe('entradaActiva', () => {
  const nav = construirNavegacion(menuCompleto);

  it('matches any code that belongs to an entry', () => {
    expect(entradaActiva(nav, '/f/EMITE_HES')).toBe('ordenes');
    expect(entradaActiva(nav, '/f/CON_DOC_EMI?estado=PENDIENTE')).toBe('ordenes');
    expect(entradaActiva(nav, '/f/RECIBE_GR')).toBe('registrar');
    expect(entradaActiva(nav, '/f/BALANCE_CCOSTO')).toBe('balance');
  });

  it('matches detail routes and maestros', () => {
    expect(entradaActiva(nav, '/oc/42')).toBe('ordenes');
    expect(entradaActiva(nav, '/configuracion')).toBe('configuracion');
    expect(entradaActiva(nav, '/f/ADM_COMUNA')).toBe('configuracion');
  });

  it('returns null outside the navigation', () => {
    expect(entradaActiva(nav, '/inicio')).toBeNull();
    expect(entradaActiva(nav, '/f/SOT_AT')).toBeNull();
  });
});

describe('pestanasRegistro', () => {
  it('lists the movement tabs the profile has, with plain names', () => {
    expect(pestanasRegistro(menuCompleto)).toEqual([
      { codigo: 'ING_MATERIAL', titulo: 'Ingreso desde HES' },
      { codigo: 'RECIBE_GR', titulo: 'Ingreso manual' },
      { codigo: 'EMITE_GR', titulo: 'Salida de bodega' },
      { codigo: 'ENTREGA_MAT', titulo: 'Entrega de fungibles' },
    ]);
    expect(pestanasRegistro([{ id: 2, codigo: 'BODEGA', opciones: [opcion('EMITE_GR')] }]))
      .toEqual([{ codigo: 'EMITE_GR', titulo: 'Salida de bodega' }]);
  });
});

describe('maestrosConfiguracion', () => {
  it('splits implemented maestros into daily business data and system settings', () => {
    const grupos = maestrosConfiguracion(menuCompleto);
    expect(grupos.map((g) => [g.titulo, g.opciones.map((o) => o.codigo)])).toEqual([
      ['Datos del negocio', ['ADM_MAT_FUN', 'ADM_PROVEEDOR']],
      ['Ajustes del sistema', ['ADM_COMUNA', 'PERFILES']],
    ]);
  });
});

describe('pendientesPerfil', () => {
  const nav = construirNavegacion(menuCompleto);

  it('lists the pending work the profile can act on, linked to its filtered screen', () => {
    const todos = ['APRUEBA_ORDEN_COMPRA', 'EMITE_HES', 'DOC_DISTRIBUIR', 'MATERIAL_X_BODEGA'];
    expect(pendientesPerfil(nav, todos).map((p) => [p.key, p.ruta, p.query])).toEqual([
      ['oc-aprobar', '/f/EMITE_OC', { estado: 'PENDIENTE' }],
      ['oc-recibir', '/f/EMITE_OC', { estado: 'EMITIDO' }],
      ['facturas', '/f/DOC_DISTRIBUIR', { estado: 'ACEPTADO' }],
      ['reponer', '/f/MATERIAL_X_BODEGA', { bajo: '1' }],
    ]);
  });

  it('skips work whose action permission or screen is missing', () => {
    expect(pendientesPerfil(nav, ['DOC_DISTRIBUIR']).map((p) => p.key)).toEqual(['facturas']);
    expect(pendientesPerfil([], ['APRUEBA_ORDEN_COMPRA', 'DOC_DISTRIBUIR'])).toEqual([]);
    expect(pendientesPerfil(nav, undefined)).toEqual([]);
  });
});

describe('accionesCrear', () => {
  const { accionesCrear } = require('./workspace-navigation');

  it('offers the create actions the profile can perform, in a fixed order', () => {
    expect(accionesCrear(menuCompleto).map((a) => [a.key, a.ruta])).toEqual([
      ['oc', '/oc/nueva'],
      ['ingreso', '/f/ING_MATERIAL'],
      ['salida', '/f/EMITE_GR'],
      ['reparto', '/f/DOC_DISTRIBUIR'],
    ]);
  });

  it('falls back to the manual entry when the profile cannot load an HES', () => {
    const menu = [{ id: 2, codigo: 'BODEGA', opciones: [opcion('RECIBE_GR'), opcion('EMITE_GR', false)] }];
    expect(accionesCrear(menu).map((a) => a.ruta)).toEqual(['/f/RECIBE_GR']);
  });

  it('returns nothing for an empty menu', () => {
    expect(accionesCrear([])).toEqual([]);
  });
});
