// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
require('reflect-metadata');
const path = require('path');
const { HttpException, Logger } = require('@nestjs/common');
const { cargaTs } = require('../fuentes/carga-ts');

const { ConsultaPreciosService } = cargaTs(path.join(__dirname, 'consulta.service.ts'));
const { RecuperadorFuentes } = cargaTs(path.join(__dirname, '../fuentes/recuperador.ts'));

Logger.overrideLogger(false);

const AHORA = new Date('2026-10-24T12:00:00Z');
const dias = (n) => new Date(AHORA.getTime() - n * 24 * 3600 * 1000);
const JSON_ = ['dartel', 'dimeiggs', 'solotodo'];

const candidato = (fuente, extra = {}) => ({
  id_externo: `${fuente}-1`, nombre: `Amarra ${fuente}`, marca: null, ean: null, categoria_fuente: null,
  precio_normal: 1990, precio_oferta: null, disponible: true, url: `https://${fuente}.cl/p`, puntaje: 0.8, ...extra,
});
const fila = (fuente, extra = {}) => ({
  publicacion_id: JSON_.indexOf(fuente) + 1, fuente, nombre: `Amarra ${fuente}`, url: `https://${fuente}.cl/p`, estado: 'propuesto',
  puntaje: 0.8, precio_normal: 1990, precio_oferta: null, disponible: true, obtenido_en: dias(1), verificado_en: dias(1), ...extra,
});

/** Arma el servicio con dobles; `filas` es la base en memoria y guardaObservacion la modifica. */
function armar({ filas = [], pausas = [], material = { nombre: 'Amarra plastica' }, marca = null, lectura, procesar, preparar } = {}) {
  const base = [...filas];
  const precios = {
    ultimasObservaciones: jest.fn(async () => base),
    enPausa: jest.fn(async (f) => pausas.includes(f)),
    registraFalla: jest.fn(async () => {}),
    proponeVinculo: jest.fn(async () => {}),
    guardaObservacion: jest.fn(async (pub, obs, ahora) => {
      const nueva = fila(pub.fuente, { nombre: pub.nombre, url: pub.url, precio_normal: obs.precio_normal, parcial: obs.parcial, obtenido_en: ahora, verificado_en: ahora });
      const i = base.findIndex((r) => r.fuente === pub.fuente);
      if (i >= 0) base[i] = nueva;
      else base.push(nueva);
      return { publicacionId: base.length, accion: 'nueva' };
    }),
  };
  const erp = {
    material: jest.fn(async () => material),
    cotizable: jest.fn(async () => marca),
    desactivaNoDevueltas: jest.fn(async () => {}),
  };
  const inteligencia = {
    preparar: preparar ?? jest.fn(async () => ({ termino_busqueda: 'amarra plastica', cotizable: true, motivo: null })),
    procesar: procesar ?? jest.fn(async (_m, fuentes) => fuentes.map((f) => ({ fuente: f.fuente, estado: 'ok', candidatos: [candidato(f.fuente)], invalidos: 0 }))),
  };
  const recuperador = {
    lee: lectura ?? jest.fn(async (fuente, _t, url) => ({ estado: 'ok', fuente, tipo: fuente === 'rhona' || fuente === 'sodimac' ? 'html' : 'json', contenido: ['x'], parcial: false, url: url ?? `https://${fuente}.cl/q`, http: 200 })),
  };
  const svc = new ConsultaPreciosService(precios, erp, inteligencia, recuperador);
  svc.ahora = () => AHORA;
  return { svc, precios, erp, inteligencia, recuperador, base };
}

const fuenteDe = (r, f) => r.fuentes.find((x) => x.fuente === f);
async function codigo(promesa) {
  try {
    await promesa;
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    return [e.getStatus(), e.getResponse()];
  }
  throw new Error('debia fallar');
}
const falla = (motivo) => async (fuente) => ({ estado: 'falla', fuente, causa: motivo, url: `https://${fuente}.cl/q` });

describe('ConsultaPreciosService', () => {
  it('404 material_not_found si el material no existe en el ERP', async () => {
    const { svc, recuperador } = armar({ material: null });
    expect(await codigo(svc.consulta('X'))).toEqual([404, { error: 'material_not_found' }]);
    expect(recuperador.lee).not.toHaveBeenCalled();
  });

  it('con precio vigente responde desde la base sin red ni FastAPI', async () => {
    const { svc, recuperador, inteligencia } = armar({ filas: JSON_.map((f) => fila(f)), });
    const r = await svc.consulta('M1');
    expect(r).toMatchObject({ cotizable: true, desactualizado: false });
    expect(r.fuentes.map((f) => [f.fuente, f.estado])).toEqual([
      ['dartel', 'ok'], ['dimeiggs', 'ok'], ['solotodo', 'ok'], ['rhona', 'sin_datos'], ['sodimac', 'sin_datos'],
    ]);
    expect(fuenteDe(r, 'dartel').publicaciones[0]).toMatchObject({ precio_normal: 1990, vinculo: 'propuesto' });
    expect(recuperador.lee).not.toHaveBeenCalled();
    expect(inteligencia.preparar).not.toHaveBeenCalled();
  });

  it('vencido: consulta, procesa, persiste con IVA y proponer vinculo, y responde ok', async () => {
    const { svc, precios, recuperador, inteligencia } = armar({ filas: JSON_.map((f) => fila(f, { verificado_en: dias(8) })) });
    const r = await svc.consulta('M1');
    expect(recuperador.lee.mock.calls.map((c) => [c[0], c[1]])).toEqual(JSON_.map((f) => [f, 'amarra plastica']));
    expect(inteligencia.procesar.mock.calls[0][2]).toEqual(AHORA);
    const ivas = precios.guardaObservacion.mock.calls.map(([p, o]) => [p.fuente, o.iva_incluido]);
    expect(ivas).toEqual([['dartel', true], ['dimeiggs', true], ['solotodo', null]]);
    expect(precios.proponeVinculo).toHaveBeenCalledTimes(3);
    expect(r.desactualizado).toBe(false);
    expect(r.fuentes.slice(0, 3).every((f) => f.estado === 'ok')).toBe(true);
  });

  it('solo consulta la fuente vencida', async () => {
    const { svc, recuperador } = armar({ filas: [fila('dartel'), fila('dimeiggs', { verificado_en: dias(9) }), fila('solotodo')] });
    await svc.consulta('M1');
    expect(recuperador.lee.mock.calls.map((c) => c[0])).toEqual(['dimeiggs']);
  });

  it('una fuente caida: las demas ok y la caida desactualizada con su motivo y registra la falla', async () => {
    const lectura = jest.fn(async (f, ...r) => (f === 'dimeiggs' ? falla('timeout')(f) : { estado: 'ok', fuente: f, tipo: 'json', contenido: ['x'], parcial: false, url: `https://${f}.cl/q`, http: 200 }));
    const { svc, precios } = armar({ filas: JSON_.map((f) => fila(f, { verificado_en: dias(8), obtenido_en: dias(8) })), lectura });
    const r = await svc.consulta('M1');
    expect(fuenteDe(r, 'dartel').estado).toBe('ok');
    expect(fuenteDe(r, 'dimeiggs')).toMatchObject({ estado: 'desactualizada', motivo: 'timeout', desactualizado: true, obtenido_en: dias(8) });
    expect(r.desactualizado).toBe(true);
    expect(precios.registraFalla).toHaveBeenCalledWith('dimeiggs', 'https://dimeiggs.cl/q', 'timeout', AHORA);
  });

  it('todas caidas con precios guardados: 200 desactualizado, sin inventar nada', async () => {
    const { svc } = armar({ filas: JSON_.map((f) => fila(f, { verificado_en: dias(8) })), lectura: jest.fn(falla('http_error')) });
    const r = await svc.consulta('M1');
    expect(r.desactualizado).toBe(true);
    expect(r.fuentes.slice(0, 3).map((f) => [f.estado, f.motivo])).toEqual(Array(3).fill(['desactualizada', 'http_error']));
    expect(fuenteDe(r, 'dartel').publicaciones[0].precio_normal).toBe(1990);
  });

  it('todas caidas sin nada guardado: 502 sources_unavailable', async () => {
    const { svc } = armar({ lectura: jest.fn(falla('timeout')) });
    expect(await codigo(svc.consulta('M1'))).toEqual([502, { error: 'sources_unavailable' }]);
  });

  it('FastAPI inalcanzable: con datos guardados 200 desactualizado; sin datos 502 intelligence_unreachable', async () => {
    const caido = () => jest.fn(async () => { throw new HttpException({ error: 'intelligence_unreachable' }, 502); });
    const con = armar({ filas: JSON_.map((f) => fila(f, { verificado_en: dias(8) })), preparar: caido() });
    const r = await con.svc.consulta('M1');
    expect(r.desactualizado).toBe(true);
    expect(fuenteDe(r, 'dartel')).toMatchObject({ estado: 'desactualizada', motivo: 'timeout' });
    expect(con.recuperador.lee).not.toHaveBeenCalled();
    expect(con.precios.registraFalla).not.toHaveBeenCalled();
    const sin = armar({ preparar: caido() });
    expect(await codigo(sin.svc.consulta('M1'))).toEqual([502, { error: 'intelligence_unreachable' }]);
  });

  it('respuesta invalida de procesar: intelligence_error sin datos, desactualizado con datos', async () => {
    const malo = jest.fn(async () => { throw new HttpException({ error: 'intelligence_error' }, 502); });
    expect(await codigo(armar({ procesar: malo }).svc.consulta('M1'))).toEqual([502, { error: 'intelligence_error' }]);
    const r = await armar({ filas: JSON_.map((f) => fila(f, { verificado_en: dias(8) })), procesar: malo }).svc.consulta('M1');
    expect(fuenteDe(r, 'solotodo')).toMatchObject({ estado: 'desactualizada', motivo: 'invalid_content' });
  });

  it('fuente invalid_content: registra la falla y queda desactualizada', async () => {
    const procesar = jest.fn(async (_m, fuentes) => fuentes.map((f) => (f.fuente === 'solotodo'
      ? { fuente: 'solotodo', estado: 'invalid_content', candidatos: [], invalidos: 2 }
      : { fuente: f.fuente, estado: 'ok', candidatos: [candidato(f.fuente)], invalidos: 0 })));
    const { svc, precios } = armar({ filas: JSON_.map((f) => fila(f, { verificado_en: dias(8) })), procesar });
    const r = await svc.consulta('M1');
    expect(fuenteDe(r, 'solotodo')).toMatchObject({ estado: 'desactualizada', motivo: 'invalid_content' });
    expect(precios.registraFalla).toHaveBeenCalledWith('solotodo', 'https://solotodo.cl/q', 'invalid_content', AHORA);
  });

  it('en cooldown no consulta la fuente y la marca desactualizada (o sin_datos si no hay nada)', async () => {
    const { svc, recuperador } = armar({ filas: [fila('dartel', { verificado_en: dias(9) })], pausas: ['dartel', 'dimeiggs'] });
    const r = await svc.consulta('M1');
    expect(recuperador.lee.mock.calls.map((c) => c[0])).toEqual(['solotodo']);
    expect(fuenteDe(r, 'dartel')).toMatchObject({ estado: 'desactualizada', motivo: 'cooldown' });
    expect(fuenteDe(r, 'dimeiggs')).toMatchObject({ estado: 'sin_datos', motivo: 'cooldown' });
  });

  it('todas en cooldown y sin datos: 502 sources_unavailable', async () => {
    const { svc } = armar({ pausas: JSON_ });
    expect(await codigo(svc.consulta('M1'))).toEqual([502, { error: 'sources_unavailable' }]);
  });

  it('sin resultados: lo recuerda una semana y no repite la consulta', async () => {
    const procesar = jest.fn(async (_m, fuentes) => fuentes.map((f) => ({ fuente: f.fuente, estado: 'sin_resultados', candidatos: [], invalidos: 0 })));
    const { svc, recuperador, erp } = armar({ procesar });
    const r = await svc.consulta('M1');
    expect(r.fuentes.slice(0, 3).every((f) => f.estado === 'sin_resultados')).toBe(true);
    expect(erp.desactivaNoDevueltas).toHaveBeenCalledTimes(3);
    await svc.consulta('M1');
    expect(recuperador.lee).toHaveBeenCalledTimes(3);
  });

  it('desactiva lo no devuelto solo tras una lectura completa', async () => {
    const parcial = jest.fn(async (fuente) => ({ estado: 'ok', fuente, tipo: 'html', contenido: ['x'], parcial: true, url: 'https://www.sodimac.cl/sodimac-cl/lista/C/x', http: 200 }));
    const marca = { definido_por: 'usuario', cotizable: true, url_sodimac: 'https://www.sodimac.cl/sodimac-cl/lista/C/x' };
    const a = armar({ filas: JSON_.map((f) => fila(f)), marca, lectura: parcial });
    const r = await a.svc.consulta('M1');
    expect(a.erp.desactivaNoDevueltas).not.toHaveBeenCalled();
    expect(fuenteDe(r, 'sodimac')).toMatchObject({ estado: 'ok', parcial: true });
    const b = armar({ filas: JSON_.map((f) => fila(f, { verificado_en: dias(8) })) });
    await b.svc.consulta('M1');
    expect(b.erp.desactivaNoDevueltas).toHaveBeenCalledWith('dartel', 'M1', ['dartel-1']);
  });

  it('Rhona y Sodimac solo se consultan con URL asociada y la usan', async () => {
    const marca = { definido_por: 'usuario', cotizable: true, url_rhona: 'https://rhona.cl/c.html', url_sodimac: null };
    const { svc, recuperador } = armar({ filas: JSON_.map((f) => fila(f)), marca });
    const r = await svc.consulta('M1');
    expect(recuperador.lee.mock.calls).toEqual([['rhona', 'amarra plastica', 'https://rhona.cl/c.html']]);
    expect(fuenteDe(r, 'rhona').estado).toBe('ok');
    expect(fuenteDe(r, 'sodimac').estado).toBe('sin_datos');
  });

  it('no cotizable segun FastAPI: 200 cotizable:false y no consulta fuentes', async () => {
    const preparar = jest.fn(async () => ({ termino_busqueda: 'polera', cotizable: false, motivo: 'personalizado' }));
    const { svc, recuperador } = armar({ preparar });
    expect(await svc.consulta('M1')).toMatchObject({ cotizable: false, motivo: 'personalizado', fuentes: [] });
    expect(recuperador.lee).not.toHaveBeenCalled();
  });

  it('sin termino: cotizable:false sin_termino', async () => {
    const preparar = jest.fn(async () => ({ termino_busqueda: '', cotizable: false, motivo: 'sin_termino' }));
    expect(await armar({ preparar }).svc.consulta('M1')).toMatchObject({ cotizable: false, motivo: 'sin_termino' });
  });

  it('lo que fijo una persona manda: false no llama a FastAPI; true pasa sobre la regla', async () => {
    const no = armar({ marca: { definido_por: 'usuario', cotizable: false, motivo: 'otro' } });
    expect(await no.svc.consulta('M1')).toMatchObject({ cotizable: false, motivo: 'otro' });
    expect(no.inteligencia.preparar).not.toHaveBeenCalled();
    const preparar = jest.fn(async () => ({ termino_busqueda: 'polera logo', cotizable: false, motivo: 'personalizado' }));
    const si = armar({ preparar, marca: { definido_por: 'usuario', cotizable: true } });
    expect((await si.svc.consulta('M1')).cotizable).toBe(true);
    expect(si.recuperador.lee).toHaveBeenCalled();
  });

  it('un vinculo propuesto se rotula y uno confirmado tambien', async () => {
    const { svc } = armar({ filas: [fila('dartel', { estado: 'confirmado' }), fila('dimeiggs'), fila('solotodo')] });
    const r = await svc.consulta('M1');
    expect(fuenteDe(r, 'dartel').publicaciones[0].vinculo).toBe('confirmado');
    expect(fuenteDe(r, 'dimeiggs').publicaciones[0].vinculo).toBe('propuesto');
  });

  it('integrado con el recuperador real: robots.txt prohibe la fuente y queda desactualizada', async () => {
    const original = global.fetch;
    global.fetch = jest.fn(async (url) => (url.endsWith('/robots.txt')
      ? { ok: true, status: 200, headers: new Headers(), text: async () => 'User-agent: *\nDisallow: /' }
      : { ok: true, status: 200, headers: new Headers(), text: async () => '[]' }));
    try {
      const a = armar({ filas: JSON_.map((f) => fila(f, { verificado_en: dias(8) })) });
      a.svc.recuperador = new RecuperadorFuentes();
      const r = await a.svc.consulta('M1');
      expect(r.fuentes.slice(0, 3).map((f) => [f.estado, f.motivo])).toEqual(Array(3).fill(['desactualizada', 'http_error']));
      expect(global.fetch.mock.calls.every(([u]) => u.endsWith('/robots.txt'))).toBe(true);
    } finally {
      global.fetch = original;
    }
  });
});
