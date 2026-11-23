// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
const path = require('path');
const { HttpException } = require('@nestjs/common');
const { cargaTs } = require('../precios/fuentes/carga-ts');

// Jest 29 default-transforms *.ts with babel-jest, which cannot strip types: el servicio
// y sus imports relativos se cargan transpilados con TypeScript.
const { IntelligenceService } = cargaTs(path.join(__dirname, 'inteligencia.service.ts'));
const { entrarCorrelacion } = cargaTs(path.join(__dirname, '../comun/correlacion.ts'));

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

  describe('service token (BE-03)', () => {
    const ok = () => jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ eco: 'x' }) });
    const conToken = (token) => ({
      get: (clave) => ({ INTELLIGENCE_SERVICE_URL: 'http://intelligence:8000', INTELLIGENCE_SERVICE_TOKEN: token })[clave],
    });

    it('sends X-Service-Token on every call, keeping the JSON headers', async () => {
      svc = new IntelligenceService(conToken('secreto-ficticio'));
      global.fetch = ok();
      await svc.eco('hola');
      await svc.salud();
      for (const [, init] of global.fetch.mock.calls) {
        expect(init.headers['X-Service-Token']).toBe('secreto-ficticio');
      }
      expect(global.fetch.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
    });

    it('keeps the token alongside the correlation id', async () => {
      svc = new IntelligenceService(conToken('secreto-ficticio'));
      global.fetch = ok();
      await entrarCorrelacion('corr-token-1', () => svc.eco('hola'));
      const { headers } = global.fetch.mock.calls[0][1];
      expect(headers).toMatchObject({ 'X-Service-Token': 'secreto-ficticio', 'x-request-id': 'corr-token-1' });
    });

    it('sends no token header when none is configured', async () => {
      global.fetch = ok();
      await svc.eco('hola');
      expect(global.fetch.mock.calls[0][1].headers).not.toHaveProperty('X-Service-Token');
    });

    it('maps a 401 from FastAPI to 502 without exposing it', async () => {
      svc = new IntelligenceService(conToken('malo'));
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) });
      const err = await svc.eco('hola').catch((e) => e);
      expectHttp(err, 502, { error: 'intelligence_error' });
    });
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

  it('forwards the request correlation id to FastAPI', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ eco: 'hola', servicio: 'intelligence-service' }),
    });

    await entrarCorrelacion('corr-1234', () => svc.eco('hola'));

    expect(global.fetch).toHaveBeenCalledWith(
      'http://intelligence:8000/v1/echo',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json', 'x-request-id': 'corr-1234' },
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

  describe('bounded retries (BE-04)', () => {
    const resp = (status, body = { eco: 'x' }) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
    let esperas;
    let avisos;
    beforeEach(() => {
      esperas = [];
      svc.espera = async (ms) => { esperas.push(ms); };
      svc.azar = () => 0.5;
      avisos = [];
      svc.log = { warn: (m) => avisos.push(m), log: () => {} };
    });

    it('retries once after a network error and returns the second answer', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(resp(200));
      await expect(entrarCorrelacion('corr-retry-1', () => svc.eco('hola'))).resolves.toEqual({ eco: 'x' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(esperas).toEqual([200]);
      expect(avisos).toHaveLength(1);
      expect(avisos[0]).toContain('corr-retry-1');
      expect(avisos[0]).toContain('/v1/echo');
    });

    it.each([502, 503, 504])('retries a %s and succeeds', async (status) => {
      global.fetch = jest.fn().mockResolvedValueOnce(resp(status)).mockResolvedValueOnce(resp(200));
      await expect(svc.eco('hola')).resolves.toEqual({ eco: 'x' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('gives up after 2 retries (3 attempts) with 502 and backoff 200/600 ms', async () => {
      global.fetch = jest.fn().mockResolvedValue(resp(503));
      const err = await svc.eco('hola').catch((e) => e);
      expectHttp(err, 502, { error: 'intelligence_error' });
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(esperas).toEqual([200, 600]);
      expect(avisos).toHaveLength(2);
    });

    it('three network failures end in 502 intelligence_unreachable', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
      const err = await svc.eco('hola').catch((e) => e);
      expectHttp(err, 502, { error: 'intelligence_unreachable' });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('applies jitter of +-20% to the backoff', async () => {
      svc.azar = () => 1;
      global.fetch = jest.fn().mockResolvedValue(resp(502));
      await svc.eco('hola').catch(() => {});
      expect(esperas).toEqual([240, 720]);
    });

    it.each([400, 401, 422, 500])('does not retry a %s', async (status) => {
      global.fetch = jest.fn().mockResolvedValue(resp(status));
      await svc.eco('hola').catch(() => {});
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(esperas).toEqual([]);
    });

    it('does not retry when the time budget is exhausted (timeout)', async () => {
      let t = 0;
      svc.ahora = () => t;
      global.fetch = jest.fn().mockImplementation(async () => { t += 3_000; throw new DOMException('timeout', 'TimeoutError'); });
      const err = await svc.eco('hola').catch((e) => e);
      expectHttp(err, 502, { error: 'intelligence_unreachable' });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('each attempt only gets the remaining budget so the total stays under the limit', async () => {
      let t = 0;
      svc.ahora = () => t;
      const timeouts = [];
      const original = AbortSignal.timeout;
      AbortSignal.timeout = (ms) => { timeouts.push(ms); return original.call(AbortSignal, ms); };
      try {
        global.fetch = jest.fn().mockImplementation(async () => { t += 1_000; return resp(503); });
        svc.espera = async (ms) => { t += ms; };
        await svc.eco('hola').catch(() => {});
      } finally {
        AbortSignal.timeout = original;
      }
      expect(timeouts[0]).toBe(3_000);
      expect(timeouts[1]).toBe(1_800);
      expect(timeouts.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(3_000 + 1_800 + 200);
      expect(t).toBeLessThanOrEqual(3_000);
    });
  });
});
