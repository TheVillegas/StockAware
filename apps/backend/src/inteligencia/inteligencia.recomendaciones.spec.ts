// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
require('reflect-metadata');
const path = require('path');
const { HttpException, Logger } = require('@nestjs/common');
const { cargaTs } = require('../precios/fuentes/carga-ts');

const { IntelligenceService } = cargaTs(path.join(__dirname, 'inteligencia.service.ts'));

Logger.overrideLogger(false);

const config = { get: (c) => (c === 'INTELLIGENCE_SERVICE_URL' ? 'http://intelligence:8000' : undefined) };
const REF = new Date('2026-11-20T12:00:00Z');
const entrada = (cod, extra = {}) => ({
  cod_material: cod, stock: 0, stock_minimo: 5, consumo_diario: 1, consumo_reciente: 1,
  ultimo_precio: null, precio_externo: null, precio_externo_obtenido_en: null, ...extra,
});
const razon = (extra = {}) => ({ factor: 'cobertura_dias', valor: 0, peso: 0.4, texto: 'Cobertura de 0 días', ...extra });
const item = (cod, extra = {}) => ({
  cod_material: cod, puntaje: 0.7, cantidad_sugerida: 30, razones: [razon()], factores_faltantes: ['precio_externo_vigente'], ...extra,
});
const ok = (json) => jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => json });

async function error(promesa) {
  try {
    await promesa;
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    return [e.getStatus(), e.getResponse()];
  }
  throw new Error('debia fallar');
}

describe('IntelligenceService - ranking de recomendaciones', () => {
  const original = global.fetch;
  let svc;
  beforeEach(() => {
    svc = new IntelligenceService(config);
  });
  afterEach(() => {
    global.fetch = original;
    jest.restoreAllMocks();
  });

  it('envia referencia e items a /v1/recomendaciones/ranking y devuelve los items en el orden de FastAPI', async () => {
    global.fetch = ok({ items: [item('M2'), item('M1', { puntaje: 0.1 })] });
    const items = [entrada('M1'), entrada('M2')];
    const r = await svc.ranking(REF, items);
    expect(r.map((i) => i.cod_material)).toEqual(['M2', 'M1']);
    expect(r[0]).toEqual(item('M2'));
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('http://intelligence:8000/v1/recomendaciones/ranking');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ referencia: '2026-11-20T12:00:00.000Z', items });
  });

  it.each([
    ['sin items', {}],
    ['items no es lista', { items: 'x' }],
    ['item nulo', { items: [null, item('M2')] }],
    ['puntaje fuera de 0..1', { items: [item('M1', { puntaje: 1.2 }), item('M2')] }],
    ['puntaje no numerico', { items: [item('M1', { puntaje: '0.5' }), item('M2')] }],
    ['cantidad negativa', { items: [item('M1', { cantidad_sugerida: -1 }), item('M2')] }],
    ['cantidad decimal', { items: [item('M1', { cantidad_sugerida: 1.5 }), item('M2')] }],
    ['razon sin texto', { items: [item('M1', { razones: [razon({ texto: undefined })] }), item('M2')] }],
    ['razon con valor no numerico', { items: [item('M1', { razones: [razon({ valor: 'a' })] }), item('M2')] }],
    ['razones no es lista', { items: [item('M1', { razones: null }), item('M2')] }],
    ['faltantes con no-texto', { items: [item('M1', { factores_faltantes: [3] }), item('M2')] }],
    ['falta un material pedido', { items: [item('M1')] }],
    ['material que no se pidio', { items: [item('M1'), item('M2'), item('M9')] }],
    ['material cambiado', { items: [item('M1'), item('M9')] }],
    ['material repetido', { items: [item('M1'), item('M1')] }],
  ])('respuesta invalida (%s) sale como 502 intelligence_error', async (_n, json) => {
    global.fetch = ok(json);
    expect(await error(svc.ranking(REF, [entrada('M1'), entrada('M2')]))).toEqual([502, { error: 'intelligence_error' }]);
  });

  it('respuesta que no es objeto sale como 502 intelligence_error', async () => {
    global.fetch = ok(null);
    expect(await error(svc.ranking(REF, [entrada('M1')]))).toEqual([502, { error: 'intelligence_error' }]);
  });

  it('un 422 del salto sale como 502 intelligence_error, no como culpa del usuario', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({}) });
    expect(await error(svc.ranking(REF, [entrada('M1')]))).toEqual([502, { error: 'intelligence_error' }]);
  });

  it('sin respuesta sale como 502 intelligence_unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await error(svc.ranking(REF, [entrada('M1')]))).toEqual([502, { error: 'intelligence_unreachable' }]);
  });
});
