// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
require('reflect-metadata');
const path = require('path');
const { cargaTs } = require('../fuentes/carga-ts');

const { cuentaResultado, reglaIncumplida, contadorVacio, conTasa, cobertura } = cargaTs(path.join(__dirname, 'conteo.ts'));
const { validaCandidato } = cargaTs(path.join(__dirname, '../../inteligencia/precios.dto.ts'));

const bueno = (extra = {}) => ({
  id_externo: '1', nombre: 'Cinta aislante', precio_normal: 1990, precio_oferta: null, disponible: true, url: 'https://www.dartel.cl/p', puntaje: 0.8, ...extra,
});
const crudo = (candidatos, extra = {}) => ({ fuente: 'dartel', estado: 'ok', candidatos, descartados: 0, ...extra });

describe('reglaIncumplida', () => {
  const casos = [
    ['esquema', bueno({ precio_normal: 0 })],
    ['esquema', null],
    ['nombre_vacio', bueno({ nombre: '   ' })],
    ['url_fuera_de_fuente', bueno({ url: 'https://otro.cl/p' })],
    ['url_fuera_de_fuente', bueno({ url: 'http://www.dartel.cl/p' })],
    ['oferta_mayor_normal', bueno({ precio_oferta: 2500 })],
    [null, bueno({ precio_oferta: 1500 })],
  ];
  it.each(casos)('clasifica %s', (regla, candidato) => {
    expect(reglaIncumplida('dartel', candidato)).toBe(regla);
  });

  it('coincide con validaCandidato: valido si y solo si no incumple ninguna regla', () => {
    for (const [regla, candidato] of casos) {
      expect(validaCandidato('dartel', candidato) === null).toBe(regla !== null);
    }
  });
});

describe('cuentaResultado', () => {
  it('cuenta devueltos, validos e invalidos por regla, y suma los descartados de FastAPI', () => {
    const c = contadorVacio();
    const con = cuentaResultado(c, 'dartel', crudo([bueno(), bueno({ nombre: '' }), bueno({ precio_oferta: 9999 }), bueno({ url: 'https://x.cl' })], { descartados: 7 }));
    expect(con).toBe(true);
    expect(c).toMatchObject({ devueltos: 4, validos: 1, descartados_fastapi: 7, materiales_con_precio: 1 });
    expect(c.invalidos).toEqual({ esquema: 1, nombre_vacio: 0, url_fuera_de_fuente: 1, oferta_mayor_normal: 1 });
  });

  it('un material sin candidatos validos no cuenta como con precio', () => {
    const c = contadorVacio();
    expect(cuentaResultado(c, 'dartel', crudo([bueno({ nombre: ' ' })]))).toBe(false);
    expect(c).toMatchObject({ devueltos: 1, validos: 0, materiales_con_precio: 0 });
  });

  it('sin_resultados e invalid_content no suman registros; una fuente ausente es invalid_content', () => {
    const c = contadorVacio();
    cuentaResultado(c, 'dartel', crudo([], { estado: 'sin_resultados', descartados: 3 }));
    cuentaResultado(c, 'dartel', crudo([], { estado: 'invalid_content', descartados: 2 }));
    cuentaResultado(c, 'dartel', undefined);
    expect(c).toMatchObject({ sin_resultados: 1, invalid_content: 2, devueltos: 0, descartados_fastapi: 5 });
  });
});

describe('conTasa', () => {
  it('divide validos entre devueltos y deja null si no hubo registros', () => {
    const c = contadorVacio();
    expect(conTasa(c).tasa_validos).toBeNull();
    cuentaResultado(c, 'dartel', crudo([bueno(), bueno({ nombre: '' }), bueno(), bueno()]));
    expect(conTasa(c).tasa_validos).toBe(0.75);
  });
});

describe('cobertura', () => {
  it('calcula el porcentaje total y por rubro', () => {
    const r = cobertura([
      { rubro: 'Oficina', conPrecio: true }, { rubro: 'Oficina', conPrecio: true },
      { rubro: 'EPP', conPrecio: false }, { rubro: 'EPP', conPrecio: true }, { rubro: 'EPP', conPrecio: false },
    ]);
    expect(r).toMatchObject({ materiales_evaluados: 5, con_precio: 3, porcentaje: 60 });
    expect(r.por_rubro.Oficina).toEqual({ materiales: 2, con_precio: 2, porcentaje: 100 });
    expect(r.por_rubro.EPP.porcentaje).toBe(33.3);
  });

  it('un conjunto vacio no divide por cero', () => {
    expect(cobertura([]).porcentaje).toBeNull();
  });
});
