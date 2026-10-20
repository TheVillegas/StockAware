// @ts-nocheck
const { filtrarBodegas, etiquetaBodega } = require('./bodega-filter');

const bodegas = [
  { bodega: 10, descr: 'Central VAIPS HSEQ' },
  { bodega: 11, descr: 'VAIPS Santiago' },
  { bodega: 12, descr: 'Bodega Antofagasta' },
  { bodega: 210, descr: 'Pañol Concepción' },
  { bodega: 13, descr: 'Taller Calama' },
];

describe('filtrarBodegas', () => {
  it('returns the first entries in their order when the text is empty', () => {
    const r = filtrarBodegas(bodegas, '   ', 3);
    expect(r.coincidencias.map((b) => b.bodega)).toEqual([10, 11, 12]);
    expect(r.total).toBe(5);
  });

  it('caps the matches at 12 by default and reports the full total', () => {
    const muchas = Array.from({ length: 541 }, (_, i) => ({ bodega: i + 1, descr: `Bodega ${i + 1}` }));
    const r = filtrarBodegas(muchas, 'bodega');
    expect(r.coincidencias).toHaveLength(12);
    expect(r.total).toBe(541);
  });

  it('ignores case and accents', () => {
    expect(filtrarBodegas(bodegas, 'PANOL concepcion').coincidencias.map((b) => b.bodega)).toEqual([210]);
  });

  it('matches by bodega code', () => {
    expect(filtrarBodegas(bodegas, '210').coincidencias.map((b) => b.bodega)).toEqual([210]);
  });

  it('requires every word of the text to match', () => {
    expect(filtrarBodegas(bodegas, 'vaips santiago').coincidencias.map((b) => b.bodega)).toEqual([11]);
    expect(filtrarBodegas(bodegas, 'vaips calama').total).toBe(0);
  });

  it('ranks names that start with the text before names that only contain it', () => {
    const r = filtrarBodegas(bodegas, 'vaips');
    expect(r.coincidencias.map((b) => b.bodega)).toEqual([11, 10]);
  });

  it('tolerates a missing list', () => {
    expect(filtrarBodegas(null, 'x')).toEqual({ coincidencias: [], total: 0 });
  });
});

describe('etiquetaBodega', () => {
  it('names the selected bodega and falls back to all bodegas', () => {
    expect(etiquetaBodega(bodegas, 12)).toBe('Bodega Antofagasta');
    expect(etiquetaBodega(bodegas, 0)).toBe('Todas las bodegas');
    expect(etiquetaBodega(bodegas, 999)).toBe('Bodega 999');
  });
});
