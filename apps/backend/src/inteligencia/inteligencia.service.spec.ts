// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
const path = require('path');
const { HttpException } = require('@nestjs/common');
const { cargaTs } = require('../precios/fuentes/carga-ts');

// Jest 29 default-transforms *.ts with babel-jest, which cannot strip types: el servicio
// y sus imports relativos se cargan transpilados con TypeScript.
const { IntelligenceService } = cargaTs(path.join(__dirname, 'inteligencia.service.ts'));

function configCon(url) {
  return { get: (clave) => (clave === 'INTELLIGENCE_SERVICE_URL' ? url : undefined) };
}

function expectHttp(err, status, body) {
  expect(err).toBeInstanceOf(HttpException);
  expect(err.getStatus()).toBe(status);
  expect(err.getResponse()).toEqual(body);
}

describe('IntelligenceService', () => {
  const originalFetch = global.fetch;
  let svc;

  beforeEach(() => {
    svc = new IntelligenceService(configCon('http://intelligence:8000'));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('prefixes a private host:port with http', async () => {
    svc = new IntelligenceService(configCon('stockaware-intelligence:10000'));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });

    await svc.salud();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://stockaware-intelligence:10000/health',
      expect.any(Object),
    );
  });

  it('proxies health JSON on success', async () => {
    const payload = { status: 'ok', service: 'intelligence-service' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    });

    await expect(svc.salud()).resolves.toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://intelligence:8000/health',
      expect.objectContaining({
        method: 'GET',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('proxies echo JSON on success', async () => {
    const payload = { eco: 'hola', servicio: 'intelligence-service' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    });

    await expect(svc.eco('hola')).resolves.toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://intelligence:8000/v1/echo',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: 'hola' }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('proxies description normalization JSON on success', async () => {
    const payload = {
      tokens: ['guantes', 'nitrilo'],
      descripcion_normalizada: 'guantes nitrilo',
      servicio: 'intelligence-service',
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    });

    await expect(svc.normalizar('Guantes de nitrilo, guantes')).resolves.toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://intelligence:8000/v1/materiales/normalizar',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descripcion: 'Guantes de nitrilo, guantes' }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('maps FastAPI 422 to controlled invalid_request', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'invalid_request' }),
    });

    try {
      await svc.eco('hola');
      throw new Error('expected HttpException');
    } catch (err) {
      expectHttp(err, 422, { error: 'invalid_request' });
    }
  });

  it('maps fetch failure to 502 intelligence_unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed'));

    try {
      await svc.salud();
      throw new Error('expected HttpException');
    } catch (err) {
      expectHttp(err, 502, { error: 'intelligence_unreachable' });
    }
  });

  it('maps timeout to 502 intelligence_unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(
      new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
    );

    try {
      await svc.salud();
      throw new Error('expected HttpException');
    } catch (err) {
      expectHttp(err, 502, { error: 'intelligence_unreachable' });
    }
  });

  it('maps FastAPI non-OK to 502 intelligence_error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'internal_error' }),
    });

    try {
      await svc.salud();
      throw new Error('expected HttpException');
    } catch (err) {
      expectHttp(err, 502, { error: 'intelligence_error' });
    }
  });
});
