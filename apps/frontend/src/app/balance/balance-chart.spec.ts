// @ts-nocheck
const {
  allocation, barPercents, buildCsv, isoLocal, monthlySeries, monthLabel, originSegments,
  percentChange, periodPreset, shiftYear, trailingEmptyMonths, valueLabel,
} = require('./balance-chart');

describe('balance chart helpers', () => {
  it('formats a local date as ISO without shifting to UTC', () => {
    expect(isoLocal(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('shifts an ISO date by whole years, clamping 29 February', () => {
    expect(shiftYear('2026-10-20', -1)).toBe('2025-10-20');
    expect(shiftYear('2024-02-29', -1)).toBe('2023-02-28');
    expect(shiftYear('2025-01-01', 1)).toBe('2026-01-01');
    expect(shiftYear('', -1)).toBe('');
  });

  it('builds the period presets from today', () => {
    const today = new Date(2026, 9, 20);
    expect(periodPreset('ytd', today)).toEqual({ desde: '2026-01-01', hasta: '2026-10-20' });
    expect(periodPreset('12m', today)).toEqual({ desde: '2025-11-01', hasta: '2026-10-20' });
  });

  it('computes the percent change against the previous period', () => {
    expect(percentChange(69, 100)).toBe(-31);
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(100, 300)).toBe(-66.7);
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(100, null)).toBeNull();
  });

  it('fills twelve months ending at the period end and marks those in range', () => {
    const rows = [{ mes: '2026-01', total: '900' }, { mes: '2026-03', total: 50 }];
    const s = monthlySeries(rows, '2026-01-01', '2026-10-20', 12);
    expect(s).toHaveLength(12);
    expect(s[0]).toEqual({ mes: '2025-11', total: 0, enRango: false });
    expect(s[2]).toEqual({ mes: '2026-01', total: 900, enRango: true });
    expect(s[4].total).toBe(50);
    expect(s[11]).toEqual({ mes: '2026-10', total: 0, enRango: true });
  });

  it('names a month in short Spanish', () => {
    expect(monthLabel('2026-01')).toBe('ene');
    expect(monthLabel('2025-12')).toBe('dic');
  });

  it('scales bar heights against the largest value, ignoring negatives', () => {
    expect(barPercents([50, 100, 0, -20])).toEqual([50, 100, 0, 0]);
    expect(barPercents([0, 0])).toEqual([0, 0]);
  });

  it('counts the empty months at the end of the series', () => {
    expect(trailingEmptyMonths([{ total: 5 }, { total: 0 }, { total: 0 }])).toBe(2);
    expect(trailingEmptyMonths([{ total: 0 }, { total: 1 }])).toBe(0);
  });

  it('labels bar values in millions', () => {
    expect(valueLabel(1271301794)).toBe('1.271');
    expect(valueLabel(34955168)).toBe('35');
    expect(valueLabel(122199)).toBe('<1');
    expect(valueLabel(0)).toBe('0');
  });

  it('turns origins into stacked segments, dropping excluded and non-positive ones', () => {
    const segs = originSegments([
      { origen: 'RIN_GASTO', total: '50', movimientos: 2 },
      { origen: 'RECIBIDOS', total: '150', movimientos: 4 },
      { origen: 'INV_BODEGA', total: '-10', movimientos: 1 },
      { origen: 'RRHH', total: '0', movimientos: 0, excluido: true },
    ]);
    expect(segs).toEqual([
      { origen: 'RECIBIDOS', total: 150, share: 75 },
      { origen: 'RIN_GASTO', total: 50, share: 25 },
    ]);
  });

  it('measures how much of the invoice net is allocated', () => {
    expect(allocation(1000, [600, null, '100'])).toEqual({
      asignado: 700, falta: 300, excede: false, completo: false, segmentos: [60, 0, 10],
    });
    expect(allocation(1000, [600, 400]).completo).toBe(true);
    expect(allocation(1000, [800, 400])).toEqual({
      // Over-allocation scales against the assigned sum so the bar never overflows.
      asignado: 1200, falta: -200, excede: true, completo: false, segmentos: [66.7, 33.3],
    });
  });

  it('builds a semicolon CSV with BOM and quoting', () => {
    const csv = buildCsv(['Centro', 'Glosa', 'Total'], [['1-00', 'Uno; dos', 10], ['2-00', 'Dice "hola"', null]]);
    expect(csv).toBe('﻿Centro;Glosa;Total\r\n1-00;"Uno; dos";10\r\n2-00;"Dice ""hola""";\r\n');
  });
});
