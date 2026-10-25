// @ts-nocheck
const {
  columnLabel, daysSince, outstandingAmount, restockQuantity, share, sortByStockRisk,
} = require('./consulta');

describe('consultation helpers', () => {
  it('turns database column names into readable labels', () => {
    expect(columnLabel('cod_comuna')).toBe('Código comuna');
    expect(columnLabel('nombre')).toBe('Nombre');
    expect(columnLabel('id_bodega')).toBe('Bodega');
    expect(columnLabel('fecha_ingreso')).toBe('Fecha ingreso');
    expect(columnLabel('RUT')).toBe('RUT');
    expect(columnLabel('codigo')).toBe('Código');
    expect(columnLabel('com_glosa')).toBe('Comuna glosa');
    expect(columnLabel('fono')).toBe('Teléfono');
    expect(columnLabel('')).toBe('');
  });

  it('counts whole days between an ISO date and today', () => {
    expect(daysSince('2026-10-10', new Date('2026-10-20T12:00:00'))).toBe(10);
    expect(daysSince('2026-10-20T08:00:00', new Date('2026-10-20T23:00:00'))).toBe(0);
    expect(daysSince('', new Date('2026-10-20'))).toBeNull();
  });

  it('computes the amount still to receive from net and progress percent', () => {
    expect(outstandingAmount(1000, '25')).toBe(750);
    expect(outstandingAmount(1000, 100)).toBe(0);
    expect(outstandingAmount(1000, 130)).toBe(0);
    expect(outstandingAmount('500', null)).toBe(500);
  });

  it('computes the quantity needed to reach the minimum', () => {
    expect(restockQuantity(2, 10)).toBe(8);
    expect(restockQuantity('-3', '5')).toBe(8);
    expect(restockQuantity(12, 10)).toBe(0);
    expect(restockQuantity(4, null)).toBe(0);
  });

  it('computes a rounded percentage share', () => {
    expect(share(25, 200)).toBe(12.5);
    expect(share(1, 3)).toBe(33.3);
    expect(share(5, 0)).toBe(0);
  });

  it('sorts stock rows with no stock first, then below minimum, keeping order inside each group', () => {
    const rows = [
      { id: 'a', stock: 10, stock_minimo: 5 },
      { id: 'b', stock: 2, stock_minimo: 5 },
      { id: 'c', stock: 0, stock_minimo: 5 },
      { id: 'd', stock: 1, stock_minimo: 5 },
    ];
    expect(sortByStockRisk(rows).map((r) => r.id)).toEqual(['c', 'b', 'd', 'a']);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('coverage', () => {
  const { coverageDays, coverageLabel } = require('./consulta');

  it('divides stock by average daily consumption, rounded down', () => {
    expect(coverageDays(30, 2)).toBe(15);
    expect(coverageDays('10', '3')).toBe(3);
  });

  it('keeps the fraction when stock lasts less than a day, so it is never shown as out of stock', () => {
    expect(coverageDays(1, 4)).toBe(0.25);
    expect(coverageDays(2, 3)).toBeGreaterThan(0);
    expect(coverageLabel(coverageDays(2, 3))).toBe('Menos de 1 día');
  });

  it('returns null when there is no consumption to project', () => {
    expect(coverageDays(30, 0)).toBeNull();
    expect(coverageDays(30, null)).toBeNull();
    expect(coverageDays(30, undefined)).toBeNull();
  });

  it('returns zero when the stock is already gone', () => {
    expect(coverageDays(0, 2)).toBe(0);
    expect(coverageDays(-5, 2)).toBe(0);
  });

  it('labels coverage in plain words', () => {
    expect(coverageLabel(null)).toBe('Sin consumo reciente');
    expect(coverageLabel(0)).toBe('Agotado');
    expect(coverageLabel(0.4)).toBe('Menos de 1 día');
    expect(coverageLabel(1)).toBe('1 día');
    expect(coverageLabel(45)).toBe('45 días');
    expect(coverageLabel(400)).toBe('Más de 1 año');
  });
});

describe('restock order', () => {
  const { suggestedOrderQty, ordenDesdeStock } = require('./consulta');

  it('covers 30 days of use or reaches the minimum, whichever is larger', () => {
    expect(suggestedOrderQty(0, 5, 1)).toBe(30);
    expect(suggestedOrderQty(10, 50, 1)).toBe(40);
    expect(suggestedOrderQty(0, 0, 0.11)).toBe(4);
    expect(suggestedOrderQty(-2, 3, 0)).toBe(5);
  });

  it('never suggests a negative quantity', () => {
    expect(suggestedOrderQty(100, 5, 1)).toBe(0);
    expect(suggestedOrderQty(5, null, null)).toBe(0);
  });

  it('builds order lines with code, name, quantity, unit and price', () => {
    const filas = [
      { cod_material: 'MC_1', nombre: 'GUANTE', stock: 0, stock_minimo: 10, consumo_diario: '0.5', unidad: 'PAR', tarifa: 1200, id_bodega: 7 },
      { cod_material: 'MC_2', nombre: 'CASCO', stock: 1, stock_minimo: 2, consumo_diario: null, unidad: 'UNI', tarifa: 9000, id_bodega: 7 },
    ];
    const orden = ordenDesdeStock(filas, { 7: '1-00-12-009' });
    expect(orden.ccosto).toBe('1-00-12-009');
    expect(orden.lineas).toEqual([
      { nombre: 'MC_1 GUANTE', cantidad: 15, unidad: 'PAR', precio_uni: 1200 },
      { nombre: 'MC_2 CASCO', cantidad: 1, unidad: 'UNI', precio_uni: 9000 },
    ]);
  });

  it('leaves the cost center empty when lines come from bodegas with different centers', () => {
    const filas = [
      { cod_material: 'A', nombre: 'A', stock: 0, stock_minimo: 1, unidad: 'UNI', tarifa: 1, id_bodega: 1 },
      { cod_material: 'B', nombre: 'B', stock: 0, stock_minimo: 1, unidad: 'UNI', tarifa: 1, id_bodega: 2 },
    ];
    expect(ordenDesdeStock(filas, { 1: 'X', 2: 'Y' }).ccosto).toBe('');
  });

  it('drops lines with nothing to order', () => {
    const filas = [{ cod_material: 'A', nombre: 'A', stock: 50, stock_minimo: 1, unidad: 'UNI', tarifa: 1, id_bodega: 1 }];
    expect(ordenDesdeStock(filas, {}).lineas).toEqual([]);
  });
});
