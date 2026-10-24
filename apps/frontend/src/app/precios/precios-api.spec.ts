// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { of, throwError } = require('rxjs');
const { crearPreciosApi, mensajeError, textoFuente, textoIva } = require('./precios-api');

/** HttpClient double: records each request and answers with `respuesta`. */
const fakeHttp = (respuesta = {}) => {
  const llamadas = [];
  const metodo = (nombre) => (...args) => {
    llamadas.push([nombre, ...args]);
    return respuesta instanceof Error ? throwError(() => respuesta) : of(respuesta);
  };
  return { llamadas, get: metodo('GET'), patch: metodo('PATCH'), put: metodo('PUT') };
};

describe('precios HTTP communication', () => {
  it('queries prices with GET /precios/:codMaterial and returns the body untouched', async () => {
    const cuerpo = { cod_material: 'A/1', nombre: 'Cable', cotizable: true, fuentes: [] };
    const http = fakeHttp(cuerpo);
    await expect(crearPreciosApi(http, '/api').consultar('A/1')).resolves.toBe(cuerpo);
    expect(http.llamadas).toEqual([['GET', '/api/precios/A%2F1']]);
  });

  it('confirms or rejects a link with PATCH /precios/vinculos/:id', async () => {
    const http = fakeHttp({});
    await crearPreciosApi(http, '/api').cambiarVinculo(7, 'rechazado');
    expect(http.llamadas).toEqual([['PATCH', '/api/precios/vinculos/7', { estado: 'rechazado' }]]);
  });

  it('links a listing URL with PUT /precios/:codMaterial/fuente-url', async () => {
    const http = fakeHttp({});
    await crearPreciosApi(http, '/api').asociarUrl('M1', 'rhona', 'https://www.rhona.cl/ferreteria');
    expect(http.llamadas).toEqual([
      ['PUT', '/api/precios/M1/fuente-url', { fuente: 'rhona', url: 'https://www.rhona.cl/ferreteria' }],
    ]);
  });

  it('sends the reason only when there is one', async () => {
    const http = fakeHttp({});
    const api = crearPreciosApi(http, '/api');
    await api.marcarCotizable('M1', false, 'Es a medida');
    await api.marcarCotizable('M1', true, '');
    expect(http.llamadas).toEqual([
      ['PUT', '/api/precios/M1/cotizable', { cotizable: false, motivo: 'Es a medida' }],
      ['PUT', '/api/precios/M1/cotizable', { cotizable: true }],
    ]);
  });

  it('rejects with the original error so the screen can explain it', async () => {
    const falla = Object.assign(new Error('x'), { status: 502, error: { error: 'sources_unavailable' } });
    await expect(crearPreciosApi(fakeHttp(falla), '/api').consultar('M1')).rejects.toBe(falla);
  });
});

describe('precios wording', () => {
  it.each([
    [{ status: 422, error: { error: 'url_not_listing' } }, /listado de categoría/],
    [{ status: 422, error: { error: 'url_blocked_by_robots' } }, /no permite/],
    [{ status: 404, error: { error: 'material_not_found' } }, /ya no existe/],
    [{ status: 502, error: { error: 'intelligence_unreachable' } }, /no responde/],
    [{ status: 403 }, /No tienes permiso/],
    [{ status: 0 }, /No hay conexión/],
  ])('explains %j in Spanish', (e, texto) => {
    expect(mensajeError(e, 'x')).toMatch(texto);
  });

  it('falls back to the default message and never shows backend text', () => {
    expect(mensajeError({ status: 500, error: { message: 'stack trace' } }, 'No se pudo')).toBe('No se pudo');
  });

  it('explains empty and failed sources without inventing data', () => {
    expect(textoFuente({ fuente: 'dartel', estado: 'sin_resultados' })).toMatch(/No se encontraron/);
    expect(textoFuente({ fuente: 'dartel', estado: 'sin_datos', motivo: 'timeout' })).toMatch(/tardó demasiado/);
    expect(textoFuente({ fuente: 'rhona', estado: 'sin_datos' })).toMatch(/necesita la dirección del listado/);
    expect(textoFuente({ fuente: 'dartel', estado: 'sin_datos' })).toMatch(/aún no tiene datos/);
    expect(textoFuente({ fuente: 'dartel', estado: 'desactualizada', obtenido_en: '2026-10-01T10:00:00Z' }, () => '01-10-2026'))
      .toBe('No se pudo actualizar; se muestra lo último guardado. Dato del 01-10-2026.');
    expect(textoFuente({ fuente: 'dartel', estado: 'ok' })).toBe('');
    expect(textoFuente({ fuente: 'dartel', estado: 'ok', parcial: true })).toMatch(/parcial/);
  });

  it('tells whether the price includes IVA', () => {
    expect([true, false, null].map(textoIva)).toEqual(['IVA incluido', 'Sin IVA', 'IVA no informado']);
  });
});

describe('precios panel source', () => {
  const fuente = readFileSync(join(__dirname, 'precios-panel.component.ts'), 'utf8');
  const textos = fuente + readFileSync(join(__dirname, 'precios-api.js'), 'utf8');

  it('gates every write behind MOD_MATERIALES', () => {
    expect(fuente).toMatch(/includes\('MOD_MATERIALES'\)/);
    // toggle, per-candidate actions and the listing URL field
    expect((fuente.match(/puedeEscribir\(\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('has no voseo, long dashes or literal colors', () => {
    expect(textos.toLowerCase()).not.toMatch(/\b(pegá|elegí|podés|tenés|revisá|confirmá|ingresá)\b/);
    expect(textos).not.toMatch(/[\u2013\u2014]/);
    expect(fuente.match(/styles:\s*\[`([\s\S]*?)`\]/)[1]).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
