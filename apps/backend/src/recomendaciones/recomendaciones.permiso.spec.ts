// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
require('reflect-metadata');
const fs = require('fs');
const path = require('path');
const { Logger } = require('@nestjs/common');
const { cargaTs } = require('../precios/fuentes/carga-ts');

const { SEMBRAR_PERMISO, QUITAR_PERMISO, aseguraPermiso, PermisoRecomendaciones } = cargaTs(path.join(__dirname, 'permiso.ts'));
const migracionArchivo = fs.readdirSync(path.join(__dirname, '../migraciones')).find((f) => f.endsWith('-Recomendaciones.ts'));

Logger.overrideLogger(false);

const todo = (sqls) => sqls.join('\n');

describe('SQL del permiso RECOMENDACIONES', () => {
  it('inserta la funcion FUNCION/ACTIVO solo si no existe y despues la concede', () => {
    const sql = todo(SEMBRAR_PERMISO);
    const iFuncion = sql.indexOf('INSERT INTO public.acceso_funciones');
    const iPermiso = sql.indexOf('INSERT INTO public.acceso_permisos');
    expect(iFuncion).toBeGreaterThanOrEqual(0);
    expect(iPermiso).toBeGreaterThan(iFuncion);
    expect(sql).toMatch(/'FUNCION'.*'RECOMENDACIONES'/s);
    // Enum de la replica: sin cast, SELECT resuelve el literal como text y el INSERT falla.
    expect(sql).toContain("'FUNCION'::acceso_funciones_acc_tipo_enum");
    expect(sql).toMatch(/WHERE NOT EXISTS \(SELECT 1 FROM public\.acceso_funciones WHERE acc_glosa = 'RECOMENDACIONES'\)/);
  });

  it('la concesion copia solo a perfiles con MATERIAL_X_BODEGA ACTIVO y no duplica', () => {
    const concede = SEMBRAR_PERMISO.find((s) => s.includes('INSERT INTO public.acceso_permisos'));
    expect(concede).toMatch(/acc_glosa = 'MATERIAL_X_BODEGA'/);
    expect(concede).toMatch(/per_estado = 'ACTIVO'/);
    expect(concede).toMatch(/NOT EXISTS/);
    expect(concede).toContain("'ACTIVO'::acceso_permisos_per_estado_enum");
  });

  it('sincroniza las secuencias antes de insertar (la replica entra por COPY con sus id)', () => {
    const sql = todo(SEMBRAR_PERMISO);
    expect(sql.indexOf("pg_get_serial_sequence('public.acceso_funciones'")).toBeLessThan(sql.indexOf('INSERT INTO public.acceso_funciones'));
    expect(sql.indexOf("pg_get_serial_sequence('public.acceso_permisos'")).toBeLessThan(sql.indexOf('INSERT INTO public.acceso_permisos'));
  });

  it('QUITAR borra primero las concesiones y despues la funcion', () => {
    expect(QUITAR_PERMISO).toHaveLength(2);
    expect(QUITAR_PERMISO[0]).toMatch(/DELETE FROM public\.acceso_permisos/);
    expect(QUITAR_PERMISO[1]).toMatch(/DELETE FROM public\.acceso_funciones WHERE acc_glosa = 'RECOMENDACIONES'/);
  });
});

describe('aseguraPermiso (arranque, tras recargar la replica)', () => {
  const armar = (respuestas) => {
    const consultas = [];
    const tx = { query: jest.fn(async (sql) => { consultas.push(sql); return []; }) };
    const ds = {
      query: jest.fn(async (sql) => respuestas.shift() ?? []),
      transaction: jest.fn(async (fn) => fn(tx)),
    };
    return { ds, tx, consultas };
  };

  it('si la funcion ya existe no escribe nada', async () => {
    const { ds, tx } = armar([[{ tablas: true }], [{ existe: true }]]);
    await expect(aseguraPermiso(ds)).resolves.toBe(false);
    expect(ds.transaction).not.toHaveBeenCalled();
    expect(tx.query).not.toHaveBeenCalled();
  });

  it('si la replica se recargo y la funcion no esta, la siembra completa en una transaccion', async () => {
    const { ds, consultas } = armar([[{ tablas: true }], [{ existe: false }]]);
    await expect(aseguraPermiso(ds)).resolves.toBe(true);
    expect(ds.transaction).toHaveBeenCalledTimes(1);
    expect(consultas).toEqual(SEMBRAR_PERMISO);
  });

  it('si las tablas de acceso todavia no existen no hace nada', async () => {
    const { ds } = armar([[{ tablas: false }]]);
    await expect(aseguraPermiso(ds)).resolves.toBe(false);
    expect(ds.transaction).not.toHaveBeenCalled();
  });

  it('el arranque no se cae si el aseguramiento falla: lo registra', async () => {
    const ds = { query: jest.fn(async () => { throw new Error('db caida'); }), transaction: jest.fn() };
    const arranque = new PermisoRecomendaciones(ds);
    const aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    await expect(arranque.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(aviso).toHaveBeenCalledTimes(1);
    aviso.mockRestore();
  });
});

describe('migracion Recomendaciones', () => {
  const { [Object.keys(cargaTs(path.join(__dirname, '../migraciones', migracionArchivo)))[0]]: Migracion } = cargaTs(path.join(__dirname, '../migraciones', migracionArchivo));
  const corre = async (metodo) => {
    const consultas = [];
    await new Migracion()[metodo]({ query: async (sql) => { consultas.push(sql); return []; } });
    return consultas;
  };

  it('el timestamp es posterior a la migracion de precios', () => {
    expect(Number(migracionArchivo.split('-')[0])).toBeGreaterThan(1767225600000);
    expect(new Migracion().name).toBe(`Recomendaciones${migracionArchivo.split('-')[0]}`);
  });

  it('up crea el esquema, las dos tablas, sus indices y el permiso, sin FK hacia public', async () => {
    const sql = todo(await corre('up'));
    expect(sql).toMatch(/CREATE SCHEMA IF NOT EXISTS recomendaciones/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS recomendaciones\.recomendacion \(/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS recomendaciones\.recomendacion_decision \(/);
    expect(sql).toMatch(/modo text NOT NULL CHECK \(modo IN \('adaptativo','base'\)\)/);
    expect(sql).toMatch(/decision text NOT NULL CHECK \(decision IN \('aceptada','ajustada','rechazada'\)\)/);
    expect(sql).toMatch(/cantidad integer CHECK \(cantidad >= 0\)/);
    expect(sql).toMatch(/motivo varchar\(500\)/);
    expect(sql).toMatch(/REFERENCES recomendaciones\.recomendacion \(id\)/);
    expect(sql).not.toMatch(/REFERENCES public\./);
    for (const idx of [
      /ON recomendaciones\.recomendacion_decision \(cod_material\)/,
      /ON recomendaciones\.recomendacion_decision \(id_usuario\)/,
      /ON recomendaciones\.recomendacion_decision \(creado_en\)/,
      /ON recomendaciones\.recomendacion \(id_bodega, generado_en\)/,
    ]) expect(sql).toMatch(idx);
    expect(sql).toContain(todo(SEMBRAR_PERMISO));
  });

  it('el permiso se siembra despues de crear el esquema', async () => {
    const consultas = await corre('up');
    const iEsquema = consultas.findIndex((s) => s.includes('CREATE SCHEMA'));
    const iPermiso = consultas.findIndex((s) => s.includes('INSERT INTO public.acceso_funciones'));
    expect(iEsquema).toBe(0);
    expect(iPermiso).toBeGreaterThan(iEsquema);
  });

  it('down quita las concesiones, el codigo y el esquema en ese orden', async () => {
    const consultas = await corre('down');
    expect(consultas).toEqual([...QUITAR_PERMISO, 'DROP SCHEMA IF EXISTS recomendaciones CASCADE']);
  });
});
