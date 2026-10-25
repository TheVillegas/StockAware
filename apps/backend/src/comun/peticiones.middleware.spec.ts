// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
const path = require('path');
const { cargaTs } = require('../precios/fuentes/carga-ts');

const { PeticionesMiddleware } = cargaTs(path.join(__dirname, 'peticiones.middleware.ts'));

function peticion(url) {
  const req = {
    method: 'GET',
    originalUrl: url,
    path: url.split('?')[0],
    header: (nombre) => (nombre === 'x-request-id' ? 'req-123456' : undefined),
  };
  let finish;
  const res = {
    statusCode: 200,
    setHeader: jest.fn(),
    on: (evento, fn) => {
      if (evento === 'finish') finish = fn;
    },
  };
  return { req, res, terminar: () => finish() };
}

describe('PeticionesMiddleware', () => {
  it('logs the path, status, and duration under the incoming correlation id', () => {
    const trozos = [];
    const original = process.stdout.write;
    process.stdout.write = (chunk) => {
      trozos.push(String(chunk));
      return true;
    };
    const { req, res, terminar } = peticion('/api/health?token=abc');
    try {
      new PeticionesMiddleware().use(req, res, () => {});
      terminar();
    } finally {
      process.stdout.write = original;
    }
    const linea = JSON.parse(trozos.join('').trim());
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'req-123456');
    expect(linea.evento).toBe('peticion');
    expect(linea.correlation_id).toBe('req-123456');
    expect(linea.method).toBe('GET');
    expect(linea.path).toBe('/api/health');
    expect(linea.status).toBe(200);
    expect(linea.duration_ms).toEqual(expect.any(Number));
    expect(JSON.stringify(linea)).not.toContain('token');
  });
});
