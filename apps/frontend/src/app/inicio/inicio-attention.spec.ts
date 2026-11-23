// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { construirNavegacion, pendientesPerfil } = require('../shared/workspace-navigation');

const page = () => readFileSync(join(__dirname, 'inicio.page.ts'), 'utf8');
const expr = (source, name) => source.match(new RegExp(`readonly ${name} = computed\\(\\(\\) =>([\\s\\S]*?)\\);`))[1];
function recibir(permisos, codes) {
  const source = page();
  const project = new Function('pendientesPerfil', `return function () { return ${expr(source, 'pendienteRecibir')}; }`)(pendientesPerfil);
  const menu = [{ codigo: 'COMPRAS', opciones: codes.map((codigo) => ({ codigo, implementada: true })) }];
  return project.call({ navegacion: () => construirNavegacion(menu), auth: { sesion: () => ({ permisos }) } });
}
function pending(permisos, codes) {
  const menu = [{ codigo: 'X', opciones: codes.map((codigo) => ({ codigo, implementada: true })) }];
  return pendientesPerfil(construirNavegacion(menu), permisos).map((item) => item.key);
}
function states(ctx) {
  const source = page();
  const total = new Function(`return (${expr(source, 'totalStock')})`).call(ctx);
  const attention = new Function(`return (${expr(source, 'hayAtencion')})`).call(ctx);
  const areaFn = source.match(/return (!this\.esPendientes[\s\S]*?);/)[1];
  // The captured expression takes the panel area; assertions read a bodega boolean.
  const visible = new Function('area', `return (${areaFn})`).call(ctx, 'bodega');
  return { total, attention, visible };
}

describe('Inicio attention and permission effects', () => {
  it.each([[[]], [['EMITE_HES']], [['CON_DOC_EMI']]])('hides receiving unless both permissions are present: %j', (permisos) => {
    expect(recibir(permisos, ['EMITE_HES', 'CON_DOC_EMI', 'EMITE_OC'])).toBeNull();
  });
  it('shows receiving with both permissions even when the órdenes route is EMITE_OC', () => {
    expect(recibir(['EMITE_HES', 'CON_DOC_EMI'], ['EMITE_OC', 'EMITE_HES'])).toEqual(expect.objectContaining({
      key: 'oc-recibir', ruta: '/f/EMITE_OC', query: { estado: 'EMITIDO' },
    }));
  });
  it('gates stock and distribution entries on their backend permission codes', () => {
    expect(pending(['MATERIAL_X_BODEGA'], ['MATERIAL_X_BODEGA'])).toEqual(['reponer']);
    expect(pending(['DOC_DISTRIBUIR'], ['DOC_DISTRIBUIR'])).toEqual(['facturas']);
    expect(pending([], ['MATERIAL_X_BODEGA', 'DOC_DISTRIBUIR'])).toEqual([]);
    expect(pending(['APRUEBA_ORDEN_COMPRA'], ['EMITE_OC'])).toEqual(['oc-aprobar']);
    expect(pending(['EMITE_HES'], ['EMITE_HES'])).not.toContain('oc-aprobar');
  });
  it('keeps the only approve control inside the non-Pendientes branch', () => {
    const template = page().slice(page().indexOf('template:'), page().indexOf('export class'));
    expect(template.match(/\(click\)="aprobar\(o\)"/g)).toHaveLength(1);
    expect(template).toMatch(/@if \(!esPendientes\)\s*\{[\s\S]*?\(click\)="aprobar\(o\)"/);
  });
  it('derives attention from loaded data and distinguishes capped and filtered states', () => {
    const ready = {
      paneles: () => new Set(['reponer', 'oc-aprobar', 'facturas']),
      cargaStock: () => 'listo', cargaOc: () => 'listo', cargaFacturas: () => 'listo',
      agotados: () => [{}], porAprobar: () => 2, aceptadas: () => 0,
      stockTope: () => false, esPendientes: true, area: () => 'bodega',
    };
    expect(states(ready)).toEqual({ total: 1, attention: true, visible: true });
    expect(states({ ...ready, area: () => 'finanzas' }).visible).toBe(false);
    expect(states({ ...ready, esPendientes: false, area: () => 'finanzas' }).visible).toBe(true);
    expect(states({ ...ready, stockTope: () => true }).total).toBeNull();
    expect(states({ ...ready, agotados: () => [], porAprobar: () => 0, aceptadas: () => 0 }).attention).toBe(false);
    expect(states({ ...ready, cargaStock: () => 'cargando', cargaOc: () => 'error', cargaFacturas: () => 'cargando' }).attention).toBe(false);
  });

  it('offers authorized menu modules when frequent actions and task tiles are not permitted', () => {
    const source = page();
    const expression = expr(source, 'modulosAutorizados');
    const project = new Function(`return function () { return ${expression}; }`)();
    const call = (menu, tiles) => project.call({
      navegacion: () => construirNavegacion(menu),
      registrar: () => tiles.registrar,
      ingreso: () => tiles.ingreso,
      stock: () => tiles.stock,
    });
    const vacio = { registrar: null, ingreso: null, stock: null };
    const menu = [
      { codigo: 'COMPRAS', opciones: [{ codigo: 'EMITE_HES', implementada: true }] },
      { codigo: 'MANTENEDOR', opciones: [{ codigo: 'ADM_MAT_FUN', implementada: true }] },
    ];
    const tiles = call(menu, vacio);
    expect(tiles).toEqual([
      expect.objectContaining({ titulo: 'Órdenes de compra', ruta: '/f/EMITE_HES' }),
    ]);
    expect(tiles.map((t) => t.titulo)).not.toEqual(expect.arrayContaining(['Inicio', 'Pendientes', 'Configuración']));
    expect(tiles.map((t) => t.ruta)).not.toEqual(expect.arrayContaining(['/inicio', '/pendientes', '/configuracion']));
    const conStock = [
      { codigo: 'COMPRAS', opciones: [{ codigo: 'EMITE_HES', implementada: true }] },
      { codigo: 'BODEGA', opciones: [{ codigo: 'MATERIAL_X_BODEGA', implementada: true }] },
    ];
    const duplicados = call(conStock, { ...vacio, stock: { key: 'stock', ruta: '/f/MATERIAL_X_BODEGA' } });
    expect(duplicados.map((t) => t.key ?? t.ruta)).not.toContain('stock');
    expect(duplicados.map((t) => t.ruta)).not.toContain('/f/MATERIAL_X_BODEGA');
    expect(call([], vacio)).toEqual([]);
    expect(call([{ codigo: 'MANTENEDOR', opciones: [{ codigo: 'ADM_MAT_FUN', implementada: true }] }], vacio)).toEqual([]);
    const template = source.slice(source.indexOf('template:'), source.indexOf('export class'));
    expect(template).toMatch(/Otras tareas[\s\S]*modulosAutorizados\(\)/);
  });
});
