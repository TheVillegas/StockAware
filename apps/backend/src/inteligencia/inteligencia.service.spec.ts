// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { HttpException } = require('@nestjs/common');

// Jest 29 default-transforms *.ts with babel-jest, which cannot strip types.
// Load the service through TypeScript's transpileModule instead.
function compileTs(filename) {
  return ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      experimentalDecorators: true,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2023,
    },
    fileName: filename,
  }).outputText;
}

// Evaluate in this Jest realm so global.fetch and @nestjs/common match the spec.
const servicePath = path.join(__dirname, 'inteligencia.service.ts');
const compiled = compileTs(servicePath);
const loaded = { exports: {} };
const run = new Function('exports', 'require', 'module', '__filename', '__dirname', compiled);
run(loaded.exports, require, loaded, servicePath, path.dirname(servicePath));
const { IntelligenceService } = loaded.exports;

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
