// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
require('reflect-metadata');
const path = require('path');
const { BadRequestException, HttpException, Logger, ValidationPipe } = require('@nestjs/common');
const { cargaTs } = require('../precios/fuentes/carga-ts');

const { RecomendacionesController } = cargaTs(path.join(__dirname, 'recomendaciones.controller.ts'));
const { RecomendacionesService } = cargaTs(path.join(__dirname, 'recomendaciones.service.ts'));
const { ConsultaRecomendacionesDto, DecisionDto } = cargaTs(path.join(__dirname, 'recomendaciones.dto.ts'));
const { JwtAuthGuard, PermisosGuard, PERMISO_CLAVE } = cargaTs(path.join(__dirname, '../comun/permisos.guard.ts'));

Logger.overrideLogger(false);

const AHORA = new Date('2026-11-20T12:00:00Z');
const REQ = { user: { id_usuario: 42, login: 'jperez' } };
const pipe = new ValidationPipe({ whitelist: true, transform: true });

/** Armado real: pipe de validacion + controlador + servicio con repositorio e inteligencia dobles. */
function armar({ recomendacion = { id: 7, cod_material: 'M1', puntaje: 0.9, modo: 'adaptativo' }, materiales = [] } = {}) {
  const repo = {
    materiales: jest.fn(async () => materiales),
    mejoresPreciosExternos: jest.fn(async () => []),
    guardaLote: jest.fn(async (_m, filas) => filas.map((f) => ({ id: 100 + f.posicion, posicion: f.posicion }))),
    recomendacion: jest.fn(async () => recomendacion),
    guardaDecision: jest.fn(async () => ({ id: 55 })),
  };
  const inteligencia = { ranking: jest.fn(async () => []) };
  const svc = new RecomendacionesService(repo, inteligencia);
  svc.ahora = () => AHORA;
  const ctl = new RecomendacionesController(svc);
  return { ctl, repo, inteligencia };
}
const consulta = (q) => pipe.transform(q, { type: 'query', metatype: ConsultaRecomendacionesDto });
const decision = (b) => pipe.transform(b, { type: 'body', metatype: DecisionDto });
async function invalido(promesa) {
  try {
    await promesa;
  } catch (e) {
    expect(e).toBeInstanceOf(BadRequestException);
    return e.getResponse().message;
  }
  throw new Error('debia rechazar');
}

describe('RecomendacionesController - metadatos', () => {
  it('cuelga de /recomendaciones con JWT y permisos', () => {
    expect(Reflect.getMetadata('path', RecomendacionesController)).toBe('recomendaciones');
    expect(Reflect.getMetadata('__guards__', RecomendacionesController)).toEqual([JwtAuthGuard, PermisosGuard]);
  });

  it('GET lista y POST :id/decision exigen el permiso RECOMENDACIONES', () => {
    const lista = RecomendacionesController.prototype.listar;
    expect(Reflect.getMetadata('path', lista)).toBe('/');
    expect(Reflect.getMetadata('method', lista)).toBe(0); // GET
    expect(Reflect.getMetadata(PERMISO_CLAVE, lista)).toBe('RECOMENDACIONES');
    const decide = RecomendacionesController.prototype.decidir;
    expect(Reflect.getMetadata('path', decide)).toBe(':id/decision');
    expect(Reflect.getMetadata('method', decide)).toBe(1); // POST
    expect(Reflect.getMetadata(PERMISO_CLAVE, decide)).toBe('RECOMENDACIONES');
  });

  it('el guard rechaza (403) a un perfil sin RECOMENDACIONES aunque tenga MATERIAL_X_BODEGA', () => {
    const guard = new PermisosGuard({ getAllAndOverride: () => 'RECOMENDACIONES' });
    const ctx = (permisos) => ({
      getHandler: () => null, getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ user: { perfil: 'Bodega', permisos } }) }),
    });
    expect(() => guard.canActivate(ctx(['MATERIAL_X_BODEGA']))).toThrow(HttpException);
    expect(guard.canActivate(ctx(['MATERIAL_X_BODEGA', 'RECOMENDACIONES']))).toBe(true);
  });
});

describe('DTO de consulta (ValidationPipe)', () => {
  it('bodega entera positiva y modo por omision adaptativo', async () => {
    expect(await consulta({ bodega: '7' })).toMatchObject({ bodega: 7, modo: 'adaptativo' });
    expect(await consulta({ bodega: '7', modo: 'base' })).toMatchObject({ bodega: 7, modo: 'base' });
    expect(await consulta({ bodega: '7', modo: 'adaptativo' })).toMatchObject({ modo: 'adaptativo' });
  });

  it.each([[{}], [{ bodega: '' }], [{ bodega: 'abc' }], [{ bodega: '0' }], [{ bodega: '-3' }], [{ bodega: '1.5' }]])(
    'bodega invalida %j se rechaza con 400', async (q) => {
      const mensajes = await invalido(consulta(q));
      expect(mensajes.join(' ')).toMatch(/bodega/);
    },
  );

  it('modo distinto de adaptativo|base se rechaza con 400', async () => {
    const mensajes = await invalido(consulta({ bodega: '7', modo: 'otro' }));
    expect(mensajes.join(' ')).toMatch(/modo/);
  });
});

describe('DTO de decision (ValidationPipe)', () => {
  it.each(['aceptada', 'rechazada'])('%s no necesita cantidad', async (d) => {
    expect(await decision({ decision: d })).toMatchObject({ decision: d });
    expect(await decision({ decision: d, cantidad: 0, motivo: 'ok' })).toMatchObject({ cantidad: 0, motivo: 'ok' });
  });

  it('ajustada exige cantidad entera >= 0', async () => {
    expect(await decision({ decision: 'ajustada', cantidad: 100 })).toMatchObject({ cantidad: 100 });
    expect(await decision({ decision: 'ajustada', cantidad: 0 })).toMatchObject({ cantidad: 0 });
    expect((await invalido(decision({ decision: 'ajustada' }))).join(' ')).toMatch(/cantidad/);
    expect((await invalido(decision({ decision: 'ajustada', cantidad: null }))).join(' ')).toMatch(/cantidad/);
  });

  it.each([-1, 1.5, '10', 'x'])('cantidad invalida %p se rechaza con 400 en cualquier decision', async (c) => {
    expect((await invalido(decision({ decision: 'ajustada', cantidad: c }))).join(' ')).toMatch(/cantidad/);
    expect((await invalido(decision({ decision: 'aceptada', cantidad: c }))).join(' ')).toMatch(/cantidad/);
  });

  it('decision fuera del enum o ausente se rechaza', async () => {
    expect((await invalido(decision({ decision: 'quizas' }))).join(' ')).toMatch(/decision/);
    expect((await invalido(decision({}))).join(' ')).toMatch(/decision/);
  });

  it('motivo opcional de hasta 500 caracteres', async () => {
    expect(await decision({ decision: 'rechazada', motivo: 'x'.repeat(500) })).toMatchObject({ motivo: 'x'.repeat(500) });
    expect((await invalido(decision({ decision: 'rechazada', motivo: 'x'.repeat(501) }))).join(' ')).toMatch(/motivo/);
    expect((await invalido(decision({ decision: 'rechazada', motivo: 5 }))).join(' ')).toMatch(/motivo/);
  });
});

describe('RecomendacionesController - flujo', () => {
  it('GET con query invalida no llega al servicio: no lee ni escribe', async () => {
    const { ctl, repo, inteligencia } = armar();
    await invalido((async () => ctl.listar(await consulta({ bodega: 'x' }), REQ))());
    expect(repo.materiales).not.toHaveBeenCalled();
    expect(repo.guardaLote).not.toHaveBeenCalled();
    expect(inteligencia.ranking).not.toHaveBeenCalled();
  });

  it('GET de una bodega vacia devuelve items [] con el usuario del token', async () => {
    const { ctl, repo } = armar();
    const r = await ctl.listar(await consulta({ bodega: '7', modo: 'base' }), REQ);
    expect(r).toEqual({ modo: 'base', generadoEn: '2026-11-20T12:00:00.000Z', degradado: false, items: [] });
    expect(repo.materiales).toHaveBeenCalledWith(7);
  });

  it('GET persiste con el id_usuario de req.user', async () => {
    const { ctl, repo } = armar({ materiales: [{ cod_material: 'M1', nombre: 'A', stock: 0, stock_minimo: 5, consumo_diario: 1, consumo_reciente: 1, ultimo_precio: null }] });
    await ctl.listar(await consulta({ bodega: '7', modo: 'base' }), REQ);
    expect(repo.guardaLote.mock.calls[0][0]).toMatchObject({ idBodega: 7, idUsuario: 42 });
  });

  it('POST decision valida: guarda con el usuario del token y responde { id }', async () => {
    const { ctl, repo } = armar();
    const r = await ctl.decidir('rec_7', await decision({ decision: 'ajustada', cantidad: 100, motivo: 'texto' }), REQ);
    expect(r).toEqual({ id: 'dec_55' });
    expect(repo.guardaDecision).toHaveBeenCalledTimes(1);
    expect(repo.guardaDecision).toHaveBeenCalledWith({
      recomendacionId: 7, idUsuario: 42, codMaterial: 'M1', decision: 'ajustada',
      cantidad: 100, motivo: 'texto', puntaje: 0.9, modo: 'adaptativo',
    });
  });

  it('POST decision con recomendacion inexistente: 404 { error: recommendation_not_found }', async () => {
    const { ctl, repo } = armar({ recomendacion: null });
    try {
      await ctl.decidir('rec_999', await decision({ decision: 'aceptada' }), REQ);
      throw new Error('debia fallar');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect([e.getStatus(), e.getResponse()]).toEqual([404, { error: 'recommendation_not_found' }]);
    }
    expect(repo.guardaDecision).not.toHaveBeenCalled();
  });

  it.each([
    ['ajustada sin cantidad', { decision: 'ajustada' }],
    ['cantidad negativa', { decision: 'ajustada', cantidad: -5 }],
    ['motivo de 501 caracteres', { decision: 'rechazada', motivo: 'x'.repeat(501) }],
    ['decision invalida', { decision: 'quizas' }],
  ])('POST decision con %s: 400 y no escribe', async (_n, cuerpo) => {
    const { ctl, repo } = armar();
    await invalido((async () => ctl.decidir('rec_7', await decision(cuerpo), REQ))());
    expect(repo.recomendacion).not.toHaveBeenCalled();
    expect(repo.guardaDecision).not.toHaveBeenCalled();
  });

  it('el POST usa el codigo HTTP 201 por omision de Nest (no hay @HttpCode que lo cambie)', () => {
    expect(Reflect.getMetadata('__httpCode__', RecomendacionesController.prototype.decidir)).toBeUndefined();
  });
});
