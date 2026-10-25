// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
require('reflect-metadata');
const path = require('path');
const { HttpException, Logger } = require('@nestjs/common');
const { cargaTs } = require('../precios/fuentes/carga-ts');

const { IntelligenceService } = cargaTs(path.join(__dirname, 'inteligencia.service.ts'));
const { validaCandidato } = cargaTs(path.join(__dirname, 'precios.dto.ts'));

Logger.overrideLogger(false);

const config = { get: (c) => (c === 'INTELLIGENCE_SERVICE_URL' ? 'http://intelligence:8000' : undefined) };
const material = { cod_material: 'M1', nombre: 'Amarra plastica', termino_busqueda: 'amarra plastica' };
const contenido = (...fuentes) => fuentes.map((f) => ({ fuente: f, tipo: 'json', contenido: ['[]'] }));
const candidato = (extra = {}) => ({
  id_externo: '1', nombre: 'Amarra 20 cm', marca: null, ean: null, categoria_fuente: null,
  precio_normal: 1990, precio_oferta: null, disponible: true, url: 'https://www.dartel.cl/amarra/p', puntaje: 0.8, ...extra,
});
const respuesta = (resultados) => ({ resultados, servicio: 'intelligence-service' });
const fuente = (extra = {}) => ({ fuente: 'dartel', estado: 'ok', candidatos: [candidato()], descartados: 0, ...extra });
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

describe('IntelligenceService - precios', () => {
  const original = global.fetch;
  let svc;
  beforeEach(() => {
    svc = new IntelligenceService(config);
  });
  afterEach(() => {
    global.fetch = original;
    jest.restoreAllMocks();
  });

  it('preparar envia el material y devuelve la respuesta validada', async () => {
    global.fetch = ok({ termino_busqueda: 'amarra', cotizable: true, motivo: null });
    await expect(svc.preparar('M1', 'Amarra')).resolves.toMatchObject({ termino_busqueda: 'amarra', cotizable: true });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('http://intelligence:8000/v1/precios/preparar');
    expect(JSON.parse(init.body)).toEqual({ cod_material: 'M1', nombre: 'Amarra' });
  });

  it('preparar acepta cotizable:false con su motivo', async () => {
    global.fetch = ok({ termino_busqueda: 'x', cotizable: false, motivo: 'personalizado' });
    await expect(svc.preparar('M1', 'Polera LOGO')).resolves.toMatchObject({ cotizable: false, motivo: 'personalizado' });
  });

  it('preparar con respuesta de forma invalida es intelligence_error', async () => {
    for (const json of [{ cotizable: 'si' }, { termino_busqueda: '', cotizable: true, motivo: null }, null, []]) {
      global.fetch = ok(json);
      expect(await error(svc.preparar('M1', 'x'))).toEqual([502, { error: 'intelligence_error' }]);
    }
  });

  it('FastAPI caido o lento es intelligence_unreachable; HTTP de error o 422 es intelligence_error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));
    expect(await error(svc.preparar('M1', 'x'))).toEqual([502, { error: 'intelligence_unreachable' }]);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    expect(await error(svc.preparar('M1', 'x'))).toEqual([502, { error: 'intelligence_error' }]);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 422 });
    expect(await error(svc.procesar(material, contenido('dartel'), new Date()))).toEqual([502, { error: 'intelligence_error' }]);
  });

  it('usa timeout de 3 s en preparar y de 5 s en procesar', async () => {
    const espia = jest.spyOn(AbortSignal, 'timeout');
    global.fetch = ok({ termino_busqueda: 'a', cotizable: true, motivo: null });
    await svc.preparar('M1', 'a');
    global.fetch = ok(respuesta([fuente()]));
    await svc.procesar(material, contenido('dartel'), new Date());
    expect(espia.mock.calls.map(([ms]) => ms)).toEqual([3000, 5000]);
  });

  it('procesar envia material, referencia y contenido, y devuelve candidatos validados por fuente', async () => {
    global.fetch = ok(respuesta([fuente(), fuente({ fuente: 'dimeiggs', estado: 'sin_resultados', candidatos: [] })]));
    const ref = new Date('2026-10-24T12:00:00Z');
    const r = await svc.procesar(material, contenido('dartel', 'dimeiggs'), ref);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({ material, referencia: ref.toISOString() });
    expect(r.map((x) => [x.fuente, x.estado, x.candidatos.length])).toEqual([['dartel', 'ok', 1], ['dimeiggs', 'sin_resultados', 0]]);
    expect(r[0].candidatos[0]).toMatchObject({ ean: null, precio_oferta: null, puntaje: 0.8 });
  });

  it('procesar con la respuesta completa invalida es intelligence_error', async () => {
    for (const json of [{}, respuesta([{ fuente: 'otra', estado: 'ok', candidatos: [], descartados: 0 }]), respuesta([fuente({ estado: 'raro' })]), respuesta([fuente({ candidatos: 'x' })])]) {
      global.fetch = ok(json);
      expect(await error(svc.procesar(material, contenido('dartel'), new Date()))).toEqual([502, { error: 'intelligence_error' }]);
    }
  });

  it('descarta el registro invalido y sigue con los demas', async () => {
    global.fetch = ok(respuesta([fuente({ candidatos: [candidato({ precio_normal: 0 }), candidato({ id_externo: '2' })] })]));
    const [r] = await svc.procesar(material, contenido('dartel'), new Date());
    expect(r).toMatchObject({ estado: 'ok', invalidos: 1 });
    expect(r.candidatos.map((c) => c.id_externo)).toEqual(['2']);
  });

  it('si todos los registros de una fuente son invalidos queda invalid_content; una fuente ausente tambien', async () => {
    global.fetch = ok(respuesta([fuente({ candidatos: [candidato({ url: 'https://malo.cl/x' })] })]));
    const r = await svc.procesar(material, contenido('dartel', 'rhona'), new Date());
    expect(r.map((x) => [x.fuente, x.estado])).toEqual([['dartel', 'invalid_content'], ['rhona', 'invalid_content']]);
  });
});

describe('validaCandidato (reglas del ADR)', () => {
  it.each([
    ['nombre vacio', { nombre: '  ' }],
    ['precio_normal decimal', { precio_normal: 1990.5 }],
    ['precio_normal 0', { precio_normal: 0 }],
    ['oferta mayor que el normal', { precio_oferta: 2000 }],
    ['oferta 0', { precio_oferta: 0 }],
    ['disponible ausente', { disponible: undefined }],
    ['url de otro dominio', { url: 'https://www.dimeiggs.cl/p' }],
    ['url http', { url: 'http://www.dartel.cl/p' }],
  ])('descarta: %s', (_, extra) => {
    expect(validaCandidato('dartel', candidato(extra))).toBeNull();
  });

  it('acepta oferta valida y deja el EAN en null si no tiene 8 o 13 digitos', () => {
    expect(validaCandidato('dartel', candidato({ precio_oferta: 1500, ean: '7801234567890' }))).toMatchObject({ precio_oferta: 1500, ean: '7801234567890' });
    expect(validaCandidato('dartel', candidato({ ean: '12345' })).ean).toBeNull();
    expect(validaCandidato('dartel', candidato({ ean: '12345678' })).ean).toBe('12345678');
  });

  it('SoloTodo acepta la url del comercio', () => {
    expect(validaCandidato('solotodo', candidato({ url: 'https://kdtec.cl/p' }))).not.toBeNull();
  });
});
