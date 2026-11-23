// @ts-nocheck — loaded through the repository's TypeScript test helper.
require('reflect-metadata');
const path = require('path');
const { Module } = require('@nestjs/common');
const passport = require('passport');
const { NestFactory, Reflector } = require('@nestjs/core');
const { cargaTs } = require('./fuentes/carga-ts');
const { PreciosController } = cargaTs(path.join(__dirname, 'precios.controller.ts'));
const { ConsultaPreciosService } = cargaTs(path.join(__dirname, 'consulta/consulta.service.ts'));
const { EscrituraPreciosService } = cargaTs(path.join(__dirname, 'escritura/escritura.service.ts'));
const { JwtAuthGuard, PermisosGuard } = cargaTs(path.join(__dirname, '../comun/permisos.guard.ts'));

const now = new Date('2026-10-24T12:00:00.000Z');
const fresh = { publicacion_id: 1, fuente: 'dartel', estado: 'propuesto', nombre: 'Oferta', url: 'https://example.org/p', puntaje: 0.8, precio_normal: 100, precio_oferta: null, disponible: true, obtenido_en: now, verificado_en: now };
const sourceNames = ['dartel', 'dimeiggs', 'solotodo', 'rhona', 'sodimac'];

describe('HTTP precios observations contract', () => {
  let app, base, rows, prices, erp, intelligence, fetcher, service;
  beforeAll(async () => {
    rows = [];
    prices = { ultimasObservaciones: jest.fn(async () => rows), enPausa: jest.fn(async () => false), registraFalla: jest.fn(), guardaObservacion: jest.fn(), proponeVinculo: jest.fn() };
    erp = { material: jest.fn(async (code) => code === 'missing' ? null : { nombre: 'Material' }), cotizable: jest.fn(async () => null), desactivaNoDevueltas: jest.fn() };
    intelligence = { preparar: jest.fn(async () => ({ termino_busqueda: 'item', cotizable: true })), procesar: jest.fn(async () => []) };
    fetcher = { lee: jest.fn(async (fuente) => ({ fuente, estado: 'falla', causa: 'timeout', url: 'fixture' })) };
    service = new ConsultaPreciosService(prices, erp, intelligence, fetcher);
    service.ahora = () => now;
    passport.use('jwt', { authenticate(req) { if (!req.headers.authorization) return this.fail(401); this.success({ perfil: 'fixture', permisos: req.headers.authorization === 'Bearer allowed' ? ['MATERIAL_X_BODEGA'] : [] }); } });
    class TestModule {}
    Module({ controllers: [PreciosController], providers: [Reflector, PermisosGuard, JwtAuthGuard, { provide: ConsultaPreciosService, useValue: service }, { provide: EscrituraPreciosService, useValue: {} }] })(TestModule);
    app = await NestFactory.create(TestModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterAll(async () => { await app?.close(); passport.unuse('jwt'); });
  const get = async (url, authorization) => { const r = await fetch(`${base}${url}`, { headers: authorization ? { authorization } : {} }); return [r.status, await r.json()]; };
  const expected = (publications = []) => ({ cod_material: 'M1', nombre: 'Material', cotizable: true, desactualizado: false, fuentes: sourceNames.map((fuente) => ({ fuente, estado: fuente === 'dartel' && publications.length ? 'ok' : 'sin_datos', publicaciones: fuente === 'dartel' ? publications : [] })) });
  it('enforces authentication and actual permission guard', async () => {
    expect(await get('/precios/M1/observaciones')).toEqual([401, { message: 'Unauthorized', statusCode: 401 }]);
    expect(await get('/precios/M1/observaciones', 'Bearer denied')).toEqual([403, { message: 'El perfil "fixture" no tiene la funcion MATERIAL_X_BODEGA', error: 'Forbidden', statusCode: 403 }]);
  });
  it('returns exact missing, absent, stale and fresh bodies without refresh or writes', async () => {
    const auth = 'Bearer allowed';
    expect(await get('/precios/missing/observaciones', auth)).toEqual([404, { error: 'material_not_found' }]);
    rows = [];
    expect(await get('/precios/M1/observaciones', auth)).toEqual([200, expected()]);
    rows = [{ ...fresh, verificado_en: new Date(now.getTime() - 7 * 86400000) }];
    expect(await get('/precios/M1/observaciones', auth)).toEqual([200, expected()]);
    rows = [fresh];
    const { fuente, estado, ...publication } = fresh;
    expect(await get('/precios/M1/observaciones', auth)).toEqual([200, expected([{ ...publication, obtenido_en: now.toISOString(), verificado_en: now.toISOString(), vinculo: estado }])]);
    for (const fn of [prices.enPausa, prices.registraFalla, prices.guardaObservacion, prices.proponeVinculo, erp.desactivaNoDevueltas, intelligence.preparar, intelligence.procesar, fetcher.lee]) expect(fn).not.toHaveBeenCalled();
  });
  it('preserves the legacy route refresh and response', async () => {
    rows = [];
    expect(await get('/precios/M1', 'Bearer allowed')).toEqual([502, { error: 'sources_unavailable' }]);
    expect(intelligence.preparar).toHaveBeenCalledTimes(1);
    expect(fetcher.lee).toHaveBeenCalledTimes(3);
    expect(prices.registraFalla).toHaveBeenCalledTimes(3);
  });
});
