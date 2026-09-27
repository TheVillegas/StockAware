// @ts-nocheck
const { agruparAreas, agruparAccesosInicio } = require('./workspace-navigation');

describe('agruparAreas', () => {
  it('groups known menu codes into approved areas and omits absent areas', () => {
    const menu = [
      { id: 1, codigo: 'SOT', titulo: 'Terreno', opciones: [] },
      { id: 2, codigo: 'ADM_PAGOS', titulo: 'Pagos', opciones: [] },
      { id: 3, codigo: 'INFORMES_GESTION', titulo: 'Informes', opciones: [] },
    ];

    expect(agruparAreas(menu)).toEqual([
      { key: 'operaciones', titulo: 'Operaciones de terreno', grupos: [menu[0]] },
      { key: 'finanzas', titulo: 'Finanzas y reportes', grupos: [menu[1], menu[2]] },
    ]);
  });

  it('preserves option data and routes codes without altering the source menu', () => {
    const option = { id: 9, codigo: 'EMITE_OC', titulo: 'Emitir OC', implementada: false };
    const group = { id: 3, codigo: 'COMPRAS', titulo: 'Compras backend', opciones: [option] };

    const areas = agruparAreas([group]);

    expect(areas[0].grupos[0].opciones).toEqual([option]);
    expect(areas[0].grupos[0].opciones[0].codigo).toBe('EMITE_OC');
    expect(group.opciones).toEqual([option]);
  });

  it('keeps unknown future groups discoverable in a fallback area', () => {
    const unknown = { id: 20, codigo: 'NUEVO_MODULO', titulo: 'Nuevo', opciones: [] };
    expect(agruparAreas([unknown])).toEqual([
      { key: 'otros', titulo: 'Otros espacios', grupos: [unknown] },
    ]);
  });

  it('groups implemented Inicio links into approved areas and filters unimplemented options', () => {
    const menu = [
      { codigo: 'SOT', opciones: [
        { codigo: 'ORDEN_TRABAJO', titulo: 'Órdenes', implementada: true },
        { codigo: 'PENDIENTE', titulo: 'Pendiente', implementada: false },
      ] },
      { codigo: 'COMPRAS', opciones: [
        { codigo: 'OC', titulo: 'Órdenes de compra', implementada: true },
      ] },
    ];

    expect(agruparAccesosInicio(menu)).toEqual([
      { key: 'operaciones', titulo: 'Operaciones de terreno', grupos: [
        { ...menu[0], opciones: [menu[0].opciones[0]] },
      ], opciones: [menu[0].opciones[0]] },
      { key: 'compras', titulo: 'Compras', grupos: [menu[1]], opciones: menu[1].opciones },
    ]);
    expect(menu[0].opciones).toHaveLength(2);
  });

  it('retains implemented unknown Inicio groups under Otros espacios', () => {
    const menu = [
      { codigo: 'FUTURO', titulo: 'Futuro', opciones: [
        { codigo: 'FUTURO_LINK', titulo: 'Nuevo espacio', implementada: true },
        { codigo: 'NO', titulo: 'No disponible', implementada: false },
      ] },
    ];

    expect(agruparAccesosInicio(menu)).toEqual([
      { key: 'otros', titulo: 'Otros espacios', grupos: [
        { ...menu[0], opciones: [menu[0].opciones[0]] },
      ], opciones: [menu[0].opciones[0]] },
    ]);
  });

  it('returns no workspaces when the authorized menu has no implemented options', () => {
    expect(agruparAccesosInicio([
      { codigo: 'SOT', opciones: [{ codigo: 'X', implementada: false }] },
    ])).toEqual([]);
  });
});
