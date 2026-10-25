// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
const path = require('path');
const { cargaTs } = require('../precios/fuentes/carga-ts');

const { registrarFallaFuente, registro } = cargaTs(path.join(__dirname, 'registro.ts'));
const { entrarCorrelacion } = cargaTs(path.join(__dirname, 'correlacion.ts'));

function leerLinea(fn) {
  const trozos = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk) => {
    trozos.push(String(chunk));
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = original;
  }
  return JSON.parse(trozos.join('').trim());
}

describe('registro estructurado', () => {
  it('drops secret fields and query tokens', () => {
    const linea = leerLinea(() => registro({
      evento: 'peticion',
      path: '/api/health',
      authorization: 'Bearer secreto',
      password: 'clave',
      detalle: 'https://fuente.example/item?token=abc&page=1',
    }));
    expect(linea.authorization).toBeUndefined();
    expect(linea.password).toBeUndefined();
    expect(linea.detalle).toBe('https://fuente.example/item?token=redacted&page=1');
    expect(JSON.stringify(linea)).not.toContain('secreto');
    expect(JSON.stringify(linea)).not.toContain('clave');
    expect(JSON.stringify(linea)).not.toContain('token=abc');
  });

  it('records an external source error with the correlation id and the host only', () => {
    const linea = entrarCorrelacion('corr-1234', () => leerLinea(() => registrarFallaFuente({
      fuente: 'sodimac',
      causa: 'timeout',
      url: 'https://www.sodimac.cl/buscar?token=abc',
    })));
    expect(linea.evento).toBe('fuente_externa');
    expect(linea.correlation_id).toBe('corr-1234');
    expect(linea.fuente).toBe('sodimac');
    expect(linea.causa).toBe('timeout');
    expect(linea.host).toBe('www.sodimac.cl');
    expect(JSON.stringify(linea)).not.toContain('token');
    expect(JSON.stringify(linea)).not.toContain('/buscar');
  });
});
