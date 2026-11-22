// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
require('reflect-metadata');
const path = require('path');
const { HttpException, Logger } = require('@nestjs/common');
const { cargaTs } = require('../precios/fuentes/carga-ts');

const { RecomendacionesService } = cargaTs(path.join(__dirname, 'recomendaciones.service.ts'));
const { cantidadSugerida, estadoStock, ordenaPorRiesgo } = cargaTs(path.join(__dirname, 'regla-base.ts'));
const { IntelligenceService } = cargaTs(path.join(__dirname, '../inteligencia/inteligencia.service.ts'));

Logger.overrideLogger(false);

const AHORA = new Date('2026-11-20T12:00:00Z');
const USUARIO = 42;
const material = (cod, stock, stock_minimo, consumo_diario, extra = {}) => ({
  cod_material: cod, nombre: `Material ${cod}`, stock, stock_minimo, consumo_diario,
  consumo_reciente: consumo_diario, ultimo_precio: null, ...extra,
});
// Orden de la base de datos (cod_material): M1, M2, M3, M4.
const MATERIALES = [
  material('M1', 10, 5, 1), // ok, cantidad max(0, 30 - 10) = 20
  material('M2', 0, 5, 1), // crit, cantidad max(5, 30) = 30
  material('M3', 3, 5, 0.5), // warn, cantidad max(2, 15 - 3) = 12
  material('M4', 8, 0, 0), // ok, cantidad 0
];
const ORDEN_BASE = ['M2', 'M3', 'M1', 'M4'];

const RAZON_FASTAPI = { factor: 'cobertura_dias', valor: 6, peso: 0.4, texto: 'Cobertura de 6 días' };
const rankItem = (cod, puntaje, cantidad = 99) => ({
  cod_material: cod, puntaje, cantidad_sugerida: cantidad,
  razones: [RAZON_FASTAPI], factores_faltantes: ['precio_externo_vigente'],
});
const itemAdaptativo = (id, cod, puntaje, posicion, posicionBase) => ({
  id, codMaterial: cod, puntaje, posicion, posicionBase, cantidadSugerida: 99,
  razones: [RAZON_FASTAPI], factoresFaltantes: ['precio_externo_vigente'],
});
const itemBase = (id, cod, posicion, cantidad, valor, texto) => ({
  id, codMaterial: cod, puntaje: null, posicion, posicionBase: posicion, cantidadSugerida: cantidad,
  razones: [{ factor: 'estado_stock', valor, peso: 1, texto }], factoresFaltantes: [],
});

function armar({ materiales = MATERIALES, precios = [], ranking, recomendacion } = {}) {
  const repo = {
    materiales: jest.fn(async () => materiales),
    mejoresPreciosExternos: jest.fn(async () => precios),
    guardaLote: jest.fn(async (_meta, filas) => filas.map((f) => ({ id: 100 + f.posicion, posicion: f.posicion }))),
    recomendacion: jest.fn(async () => recomendacion ?? null),
    guardaDecision: jest.fn(async () => ({ id: 55 })),
  };
  const inteligencia = {
    ranking: ranking ?? jest.fn(async () => [rankItem('M1', 0.9), rankItem('M3', 0.5), rankItem('M2', 0.4), rankItem('M4', 0.1)]),
  };
  const svc = new RecomendacionesService(repo, inteligencia);
  svc.ahora = () => AHORA;
  return { svc, repo, inteligencia };
}
async function rechazo(promesa) {
  try {
    await promesa;
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    return [e.getStatus(), e.getResponse()];
  }
  throw new Error('debia fallar');
}
const hop = (estado, error) => jest.fn(async () => {
  throw new HttpException({ error }, estado);
});

describe('regla base (S7, igual que shared/consulta.js)', () => {
  it.each([
    [0, 5, 1, 30],
    [10, 50, 1, 40],
    [0, 0, 0.11, 4],
    [10, 5, 0, 0],
    [10, null, null, 0],
    [null, 5, 1, 30],
  ])('cantidadSugerida(%p, %p, %p) = %p', (stock, minimo, uso, esperada) => {
    expect(cantidadSugerida(stock, minimo, uso)).toBe(esperada);
  });

  it('estadoStock: crit sin stock, warn bajo el minimo, ok el resto', () => {
    expect(estadoStock(0, 5)).toBe('crit');
    expect(estadoStock(-2, 0)).toBe('crit');
    expect(estadoStock(3, 5)).toBe('warn');
    expect(estadoStock(5, 5)).toBe('ok');
    expect(estadoStock(null, 5)).toBe('ok');
  });

  it('ordenaPorRiesgo es estable respecto del orden de entrada y no muta la lista', () => {
    const lista = [material('A', 9, 1, 0), material('B', 0, 1, 0), material('C', 9, 1, 0), material('D', 0, 1, 0), material('E', 1, 5, 0)];
    expect(ordenaPorRiesgo(lista).map((m) => m.cod_material)).toEqual(['B', 'D', 'E', 'A', 'C']);
    expect(lista.map((m) => m.cod_material)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});

describe('RecomendacionesService.listar - modo base', () => {
  it('ordena por riesgo, sin llamar a FastAPI, con la cantidad de la regla base y razon estado_stock', async () => {
    const { svc, repo, inteligencia } = armar();
    const r = await svc.listar({ bodega: 7, modo: 'base' }, USUARIO);
    expect(inteligencia.ranking).not.toHaveBeenCalled();
    expect(repo.mejoresPreciosExternos).not.toHaveBeenCalled();
    expect(repo.materiales).toHaveBeenCalledWith(7);
    expect(r).toEqual({
      modo: 'base',
      generadoEn: '2026-11-20T12:00:00.000Z',
      degradado: false,
      items: [
        itemBase('rec_101', 'M2', 1, 30, 0, 'Sin stock'),
        itemBase('rec_102', 'M3', 2, 12, 3, 'Stock bajo el mínimo'),
        itemBase('rec_103', 'M1', 3, 20, 10, 'Stock sobre el mínimo'),
        itemBase('rec_104', 'M4', 4, 0, 8, 'Stock sobre el mínimo'),
      ],
    });
  });

  it('persiste cada item en el orden devuelto, con modo base y degradado false', async () => {
    const { svc, repo } = armar();
    await svc.listar({ bodega: 7, modo: 'base' }, USUARIO);
    expect(repo.guardaLote).toHaveBeenCalledTimes(1);
    const [meta, filas] = repo.guardaLote.mock.calls[0];
    expect(meta).toEqual({ idBodega: 7, modo: 'base', degradado: false, generadoEn: AHORA, idUsuario: USUARIO });
    expect(filas.map((f) => [f.codMaterial, f.puntaje, f.posicion, f.posicionBase, f.cantidadSugerida])).toEqual([
      ['M2', null, 1, 1, 30], ['M3', null, 2, 2, 12], ['M1', null, 3, 3, 20], ['M4', null, 4, 4, 0],
    ]);
    expect(filas[0].razones).toEqual([{ factor: 'estado_stock', valor: 0, peso: 1, texto: 'Sin stock' }]);
    expect(filas[0].factoresFaltantes).toEqual([]);
  });
});

describe('RecomendacionesService.listar - modo adaptativo', () => {
  it('manda a FastAPI un item por material con la referencia fija y mapea posicion y posicionBase', async () => {
    const precios = [{ cod_material: 'M1', precio: 1500, verificado_en: new Date('2026-11-19T10:00:00Z') }];
    const mats = MATERIALES.map((m) => (m.cod_material === 'M1' ? { ...m, ultimo_precio: 1800, consumo_reciente: 2 } : m));
    const { svc, inteligencia } = armar({ materiales: mats, precios });
    const r = await svc.listar({ bodega: 7, modo: 'adaptativo' }, USUARIO);

    expect(inteligencia.ranking).toHaveBeenCalledWith(AHORA, [
      { cod_material: 'M1', stock: 10, stock_minimo: 5, consumo_diario: 1, consumo_reciente: 2, ultimo_precio: 1800,
        precio_externo: 1500, precio_externo_obtenido_en: '2026-11-19T10:00:00.000Z' },
      { cod_material: 'M2', stock: 0, stock_minimo: 5, consumo_diario: 1, consumo_reciente: 1, ultimo_precio: null,
        precio_externo: null, precio_externo_obtenido_en: null },
      { cod_material: 'M3', stock: 3, stock_minimo: 5, consumo_diario: 0.5, consumo_reciente: 0.5, ultimo_precio: null,
        precio_externo: null, precio_externo_obtenido_en: null },
      { cod_material: 'M4', stock: 8, stock_minimo: 0, consumo_diario: 0, consumo_reciente: 0, ultimo_precio: null,
        precio_externo: null, precio_externo_obtenido_en: null },
    ]);
    expect(r).toEqual({
      modo: 'adaptativo',
      generadoEn: '2026-11-20T12:00:00.000Z',
      degradado: false,
      items: [
        itemAdaptativo('rec_101', 'M1', 0.9, 1, 3),
        itemAdaptativo('rec_102', 'M3', 0.5, 2, 2),
        itemAdaptativo('rec_103', 'M2', 0.4, 3, 1),
        itemAdaptativo('rec_104', 'M4', 0.1, 4, 4),
      ],
    });
  });

  it('pide los precios externos de todos los materiales en una sola consulta', async () => {
    const { svc, repo } = armar();
    await svc.listar({ bodega: 7, modo: 'adaptativo' }, USUARIO);
    expect(repo.mejoresPreciosExternos).toHaveBeenCalledTimes(1);
    expect(repo.mejoresPreciosExternos).toHaveBeenCalledWith(['M1', 'M2', 'M3', 'M4']);
  });

  it('persiste el lote con modo adaptativo, puntajes y posiciones', async () => {
    const { svc, repo } = armar();
    await svc.listar({ bodega: 7, modo: 'adaptativo' }, USUARIO);
    expect(repo.guardaLote).toHaveBeenCalledTimes(1);
    const [meta, filas] = repo.guardaLote.mock.calls[0];
    expect(meta).toEqual({ idBodega: 7, modo: 'adaptativo', degradado: false, generadoEn: AHORA, idUsuario: USUARIO });
    expect(filas.map((f) => [f.codMaterial, f.puntaje, f.posicion, f.posicionBase, f.cantidadSugerida])).toEqual([
      ['M1', 0.9, 1, 3, 99], ['M3', 0.5, 2, 2, 99], ['M2', 0.4, 3, 1, 99], ['M4', 0.1, 4, 4, 99],
    ]);
    expect(filas[0].razones).toEqual([RAZON_FASTAPI]);
    expect(filas[0].factoresFaltantes).toEqual(['precio_externo_vigente']);
  });

  it('modo por omision es adaptativo', async () => {
    const { svc, inteligencia } = armar();
    const r = await svc.listar({ bodega: 7 }, USUARIO);
    expect(r.modo).toBe('adaptativo');
    expect(inteligencia.ranking).toHaveBeenCalledTimes(1);
  });
});

describe('RecomendacionesService.listar - degradacion (S4)', () => {
  it.each([
    ['FastAPI no responde', () => hop(502, 'intelligence_unreachable')],
    ['FastAPI responde con error', () => hop(502, 'intelligence_error')],
  ])('%s: 200 con degradado true, orden base e items base', async (_n, falla) => {
    const { svc, repo } = armar({ ranking: falla() });
    const r = await svc.listar({ bodega: 7, modo: 'adaptativo' }, USUARIO);
    expect(r).toEqual({
      modo: 'adaptativo',
      generadoEn: '2026-11-20T12:00:00.000Z',
      degradado: true,
      items: [
        itemBase('rec_101', 'M2', 1, 30, 0, 'Sin stock'),
        itemBase('rec_102', 'M3', 2, 12, 3, 'Stock bajo el mínimo'),
        itemBase('rec_103', 'M1', 3, 20, 10, 'Stock sobre el mínimo'),
        itemBase('rec_104', 'M4', 4, 0, 8, 'Stock sobre el mínimo'),
      ],
    });
    const [meta] = repo.guardaLote.mock.calls[0];
    expect(meta).toEqual({ idBodega: 7, modo: 'adaptativo', degradado: true, generadoEn: AHORA, idUsuario: USUARIO });
  });

  it('respuesta mal formada de FastAPI (validador real): degrada con el orden base', async () => {
    const original = global.fetch;
    try {
      // Devuelve un material de mas: no coincide con los pedidos.
      global.fetch = jest.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ items: [rankItem('M1', 0.9), rankItem('M2', 0.4), rankItem('M3', 0.3), rankItem('M4', 0.2), rankItem('M9', 0.1)] }),
      });
      const real = new IntelligenceService({ get: () => 'http://intelligence:8000' });
      const { svc, repo } = armar({ ranking: (...a) => real.ranking(...a) });
      const r = await svc.listar({ bodega: 7, modo: 'adaptativo' }, USUARIO);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(r.degradado).toBe(true);
      expect(r.items.map((i) => i.codMaterial)).toEqual(ORDEN_BASE);
      expect(repo.guardaLote.mock.calls[0][0].degradado).toBe(true);
    } finally {
      global.fetch = original;
    }
  });

  it('un error que no es del salto (bug) no se esconde ni persiste nada', async () => {
    const { svc, repo } = armar({ ranking: jest.fn(async () => { throw new TypeError('bug'); }) });
    await expect(svc.listar({ bodega: 7, modo: 'adaptativo' }, USUARIO)).rejects.toThrow(TypeError);
    expect(repo.guardaLote).not.toHaveBeenCalled();
  });
});

describe('RecomendacionesService.listar - bodega vacia', () => {
  it.each(['adaptativo', 'base'])('modo %s: items [] sin llamar a FastAPI ni persistir', async (modo) => {
    const { svc, repo, inteligencia } = armar({ materiales: [] });
    const r = await svc.listar({ bodega: 9, modo }, USUARIO);
    expect(r).toEqual({ modo, generadoEn: '2026-11-20T12:00:00.000Z', degradado: false, items: [] });
    expect(inteligencia.ranking).not.toHaveBeenCalled();
    expect(repo.mejoresPreciosExternos).not.toHaveBeenCalled();
    expect(repo.guardaLote).not.toHaveBeenCalled();
  });
});

describe('RecomendacionesService.decidir', () => {
  const REC = { id: 7, cod_material: 'M1', puntaje: 0.9, modo: 'adaptativo' };

  it('guarda la decision con el usuario del token y material, puntaje y modo copiados de la recomendacion', async () => {
    const { svc, repo } = armar({ recomendacion: REC });
    const r = await svc.decidir('rec_7', { decision: 'ajustada', cantidad: 100, motivo: 'pedido grande' }, USUARIO);
    expect(r).toEqual({ id: 'dec_55' });
    expect(repo.recomendacion).toHaveBeenCalledWith(7);
    expect(repo.guardaDecision).toHaveBeenCalledWith({
      recomendacionId: 7, idUsuario: USUARIO, codMaterial: 'M1', decision: 'ajustada',
      cantidad: 100, motivo: 'pedido grande', puntaje: 0.9, modo: 'adaptativo',
    });
  });

  it('cantidad y motivo ausentes se guardan como null; puntaje null del modo base se conserva', async () => {
    const { svc, repo } = armar({ recomendacion: { ...REC, puntaje: null, modo: 'base' } });
    await svc.decidir('rec_7', { decision: 'rechazada' }, USUARIO);
    expect(repo.guardaDecision).toHaveBeenCalledWith({
      recomendacionId: 7, idUsuario: USUARIO, codMaterial: 'M1', decision: 'rechazada',
      cantidad: null, motivo: null, puntaje: null, modo: 'base',
    });
  });

  it('recomendacion inexistente: 404 recommendation_not_found y nada se guarda', async () => {
    const { svc, repo } = armar({ recomendacion: null });
    expect(await rechazo(svc.decidir('rec_999', { decision: 'aceptada' }, USUARIO))).toEqual([404, { error: 'recommendation_not_found' }]);
    expect(repo.recomendacion).toHaveBeenCalledWith(999);
    expect(repo.guardaDecision).not.toHaveBeenCalled();
  });

  it.each(['7', 'abc', 'rec_', 'rec_0', 'rec_-1', 'rec_1x', 'rec_1.5', 'REC_1', 'rec_99999999999'])(
    'id mal formado %p: 404 sin tocar la base', async (id) => {
      const { svc, repo } = armar({ recomendacion: REC });
      expect(await rechazo(svc.decidir(id, { decision: 'aceptada' }, USUARIO))).toEqual([404, { error: 'recommendation_not_found' }]);
      expect(repo.recomendacion).not.toHaveBeenCalled();
      expect(repo.guardaDecision).not.toHaveBeenCalled();
    },
  );
});
