// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
// Integracion contra PostgreSQL real. Sin PGHOST/PG_HOST la suite se omite (etapa unitaria de CI).
require('reflect-metadata');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// Mismo cargador minimo de documentacion.spec.ts: Jest aqui no transforma TypeScript.
const cache = new Map();
function cargaTs(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const salida = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true, target: ts.ScriptTarget.ES2023 },
    fileName: file,
  }).outputText;
  const mod = { exports: {} };
  cache.set(file, mod);
  const dir = path.dirname(file);
  const requiere = (id) => (id.startsWith('.') ? cargaTs(`${path.resolve(dir, id)}.ts`) : require(id));
  new Function('exports', 'require', 'module', '__filename', '__dirname', salida)(mod.exports, requiere, mod, file, dir);
  return mod.exports;
}

const e = process.env;
const env = (k) => e[`PG_${k}`] ?? e[`PG${k}`];
const conBase = env('HOST') && env('PASSWORD');
const suite = conBase ? describe : describe.skip;
const src = path.join(__dirname, '..');
const PREFIJO = 'ficticio-';
const pub = { fuente: 'dartel', id_externo: `${PREFIJO}001`, url: 'https://www.dartel.cl/ficticio-001/p', nombre: 'Amarra plastica ficticia 20 cm', marca: 'Marca Ficticia', ean: null, categoria_fuente: 'Pruebas' };
const obs = { precio_normal: 1990, precio_oferta: null, disponible: true, iva_incluido: true, parcial: false };

suite('precios_externos (PostgreSQL real, fixture ficticio)', () => {
  let ds, repo;
  const limpia = async () => {
    await ds.query(`DELETE FROM precios_externos.vinculo_material WHERE cod_material LIKE '${PREFIJO}%'`);
    await ds.query(`DELETE FROM precios_externos.observacion_precio WHERE publicacion_id IN (SELECT id FROM precios_externos.publicacion WHERE id_externo LIKE '${PREFIJO}%')`);
    await ds.query(`DELETE FROM precios_externos.publicacion WHERE id_externo LIKE '${PREFIJO}%'`);
    await ds.query(`DELETE FROM precios_externos.material_cotizable WHERE cod_material LIKE '${PREFIJO}%'`);
    await ds.query(`DELETE FROM precios_externos.falla_consulta WHERE url LIKE '%ficticio%'`);
  };
  // Tablas base de public que puede haber: las de 01_schema.sql, la de control de
  // TypeORM y los marcadores que crean los scripts de CI.
  const permitidas = new Set([
    ...[...fs.readFileSync(path.join(__dirname, '../../database/init/01_schema.sql'), 'utf8').matchAll(/^CREATE TABLE "(\w+)"/gm)].map((m) => m[1]),
    'migraciones_typeorm', 'ci_migracion', 'ci_seed_marker',
  ]);
  const tablasPublic = async () => (await ds.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`)).map((f) => f.table_name);

  beforeAll(async () => {
    const { DataSource } = require('typeorm');
    // Jest no transforma .ts: la migracion se pasa ya cargada, no por el glob.
    const { opcionesBase } = cargaTs(path.join(src, 'data-source.ts'));
    const { PreciosRepositorio } = cargaTs(path.join(__dirname, 'precios.repositorio.ts'));
    ds = new DataSource({
      ...opcionesBase, migrations: [cargaTs(path.join(src, 'migraciones', '1767225600000-PreciosExternos.ts')).PreciosExternos1767225600000], host: env('HOST'), port: Number(env('PORT') ?? 5432), username: env('USER'), password: env('PASSWORD'), database: env('DATABASE'),
    });
    await ds.initialize();
    await ds.runMigrations();
    repo = new PreciosRepositorio(ds);
    await limpia();
  });
  afterAll(async () => {
    if (!ds) return;
    await limpia();
    await ds.destroy();
  });

  it('consulta el registro y no duplica la publicacion', async () => {
    const a = await repo.guardaObservacion(pub, obs);
    const b = await repo.guardaObservacion(pub, obs);
    expect(b.publicacionId).toBe(a.publicacionId);
    const [{ n }] = await ds.query(`SELECT count(*)::int AS n FROM precios_externos.publicacion WHERE id_externo = $1`, [pub.id_externo]);
    expect(n).toBe(1);
    await repo.proponeVinculo(`${PREFIJO}mat`, a.publicacionId, 0.8);
    const filas = await repo.ultimasObservaciones(`${PREFIJO}mat`);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ fuente: 'dartel', precio_normal: 1990, estado: 'propuesto' });
  });

  it('sin cambios solo actualiza verificado_en; con precio nuevo guarda historial', async () => {
    const consulta = `SELECT o.* FROM precios_externos.observacion_precio o JOIN precios_externos.publicacion p ON p.id = o.publicacion_id WHERE p.id_externo = $1 ORDER BY o.id`;
    const t1 = new Date(Date.now() + 60_000);
    expect((await repo.guardaObservacion(pub, obs, t1)).accion).toBe('verificada');
    let filas = await ds.query(consulta, [pub.id_externo]);
    expect(filas).toHaveLength(1);
    expect(filas[0].verificado_en.getTime()).toBe(t1.getTime());
    expect(filas[0].obtenido_en.getTime()).toBeLessThan(t1.getTime());

    const t2 = new Date(t1.getTime() + 1000);
    expect((await repo.guardaObservacion(pub, { ...obs, precio_normal: 2490 }, t2)).accion).toBe('nueva');
    filas = await ds.query(consulta, [pub.id_externo]);
    expect(filas).toHaveLength(2);
    expect((await repo.ultimasObservaciones(`${PREFIJO}mat`))[0].precio_normal).toBe(2490);
  });

  it('rechaza precios invalidos con CHECK y oculta vinculos rechazados', async () => {
    const otra = { ...pub, id_externo: `${PREFIJO}002` };
    await expect(repo.guardaObservacion(otra, { ...obs, precio_oferta: 5000 })).rejects.toThrow(/ck_observacion_oferta/);
    await expect(repo.guardaObservacion(otra, { ...obs, precio_normal: 0 })).rejects.toThrow(/precio_normal/);
    await ds.query(`UPDATE precios_externos.vinculo_material SET estado = 'rechazado' WHERE cod_material = $1`, [`${PREFIJO}mat`]);
    expect(await repo.ultimasObservaciones(`${PREFIJO}mat`)).toHaveLength(0);
  });

  it('ultimasObservaciones devuelve el vinculo, la marca, el ean, el IVA y si fue parcial', async () => {
    const p = { ...pub, id_externo: `${PREFIJO}campos`, ean: '7800000000001' };
    const { publicacionId } = await repo.guardaObservacion(p, { ...obs, parcial: true });
    await repo.proponeVinculo(`${PREFIJO}campos`, publicacionId, 0.7);
    const [fila] = await repo.ultimasObservaciones(`${PREFIJO}campos`);
    const [{ id }] = await ds.query(`SELECT id FROM precios_externos.vinculo_material WHERE cod_material = $1`, [`${PREFIJO}campos`]);
    expect(fila).toMatchObject({ vinculo_id: id, publicacion_id: publicacionId, marca: 'Marca Ficticia', ean: '7800000000001', iva_incluido: true, parcial: true, estado: 'propuesto', precio_normal: 1990 });
  });

  it('confirma y rechaza un vinculo de forma idempotente; un rechazado no se vuelve a proponer', async () => {
    const cod = `${PREFIJO}vinc`;
    const { publicacionId } = await repo.guardaObservacion({ ...pub, id_externo: `${PREFIJO}vinc` }, obs);
    await repo.proponeVinculo(cod, publicacionId, 0.6);
    const [{ id }] = await ds.query(`SELECT id FROM precios_externos.vinculo_material WHERE cod_material = $1`, [cod]);
    expect(await repo.cambiaEstadoVinculo(id, 'confirmado')).toMatchObject({ id, cod_material: cod, estado: 'confirmado', definido_por: 'usuario' });
    expect(await repo.cambiaEstadoVinculo(id, 'confirmado')).toMatchObject({ estado: 'confirmado' });
    expect(await repo.ultimasObservaciones(cod)).toHaveLength(1);
    expect(await repo.cambiaEstadoVinculo(id, 'rechazado')).toMatchObject({ estado: 'rechazado' });
    await repo.proponeVinculo(cod, publicacionId, 0.9); // la proxima consulta lo vuelve a proponer
    const [v] = await ds.query(`SELECT estado, puntaje::float AS puntaje FROM precios_externos.vinculo_material WHERE id = $1`, [id]);
    expect(v).toEqual({ estado: 'rechazado', puntaje: 0.6 });
    expect(await repo.ultimasObservaciones(cod)).toHaveLength(0);
    expect(await repo.cambiaEstadoVinculo(2147483647, 'confirmado')).toBeNull();
  });

  it('guarda la URL de la fuente y la corrige sin tocar la marca; una URL nueva desactiva solo lo exclusivo', async () => {
    const cod = `${PREFIJO}url`;
    const propia = await repo.guardaObservacion({ ...pub, fuente: 'rhona', id_externo: `${PREFIJO}r1`, url: 'https://rhona.cl/ficticio-1' }, obs);
    const comun = await repo.guardaObservacion({ ...pub, fuente: 'rhona', id_externo: `${PREFIJO}r2`, url: 'https://rhona.cl/ficticio-2' }, obs);
    const sodi = await repo.guardaObservacion({ ...pub, fuente: 'sodimac', id_externo: `${PREFIJO}s1`, url: 'https://www.sodimac.cl/ficticio-1' }, obs);
    for (const p of [propia, comun, sodi]) await repo.proponeVinculo(cod, p.publicacionId, 0.5);
    await repo.proponeVinculo(`${PREFIJO}otro`, comun.publicacionId, 0.5);

    expect(await repo.guardaUrlFuente(cod, 'rhona', 'https://rhona.cl/catalogo/1/a.html')).toEqual({ url_anterior: null });
    const [creada] = await ds.query(`SELECT * FROM precios_externos.material_cotizable WHERE cod_material = $1`, [cod]);
    expect(creada).toMatchObject({ cotizable: true, definido_por: 'regla', url_rhona: 'https://rhona.cl/catalogo/1/a.html', url_sodimac: null });
    expect(await repo.ultimasObservaciones(cod)).toHaveLength(3); // la primera URL no invalida nada

    expect(await repo.guardaUrlFuente(cod, 'rhona', 'https://rhona.cl/catalogo/1/a.html')).toEqual({ url_anterior: 'https://rhona.cl/catalogo/1/a.html' });
    expect(await repo.ultimasObservaciones(cod)).toHaveLength(3); // la misma URL tampoco

    expect(await repo.guardaUrlFuente(cod, 'rhona', 'https://rhona.cl/catalogo/2/b.html')).toEqual({ url_anterior: 'https://rhona.cl/catalogo/1/a.html' });
    const quedan = (await repo.ultimasObservaciones(cod)).map((f) => f.publicacion_id).sort();
    expect(quedan).toEqual([comun.publicacionId, sodi.publicacionId].sort()); // r1 inactiva; r2 es de otro material; Sodimac intacta

    const marca = await repo.defineCotizable(cod, false, 'servicio');
    expect(marca).toEqual({ cod_material: cod, cotizable: false, motivo: 'servicio', definido_por: 'usuario' });
    const [fila] = await ds.query(`SELECT url_rhona FROM precios_externos.material_cotizable WHERE cod_material = $1`, [cod]);
    expect(fila.url_rhona).toBe('https://rhona.cl/catalogo/2/b.html');
    expect(await repo.defineCotizable(`${PREFIJO}nuevo`, true, null)).toMatchObject({ cotizable: true, motivo: null, definido_por: 'usuario' });
  });

  it('deriva la pausa de 30 minutos de la ultima falla', async () => {
    // Fecha fija lejana: una falla real reciente de dartel no altera la prueba.
    const ahora = new Date('2100-01-01T00:00:00Z');
    expect(await repo.enPausa('dartel', ahora)).toBe(false);
    await repo.registraFalla('dartel', 'https://www.dartel.cl/ficticio', 'timeout', ahora);
    expect(await repo.enPausa('dartel', new Date(ahora.getTime() + 29 * 60_000))).toBe(true);
    expect(await repo.enPausa('dartel', new Date(ahora.getTime() + 31 * 60_000))).toBe(false);
    expect((await repo.ultimaFalla('dartel')).causa).toBe('timeout');
  });

  it('la migracion no agrega ni altera tablas de la replica', async () => {
    const extra = (await tablasPublic()).filter((t) => !permitidas.has(t));
    expect(extra).toEqual([]);
    const r = await ds.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('publicacion','observacion_precio','vinculo_material','material_cotizable','falla_consulta')`);
    expect(r[0].n).toBe(0);
  });
});
