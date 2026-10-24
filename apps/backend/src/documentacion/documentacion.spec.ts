// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
require('reflect-metadata');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');

// Jest 29 default-transforms *.ts with babel-jest, which cannot strip types.
// Cargador minimo: transpila con TypeScript cada .ts relativo, con metadata de
// decoradores, que es lo que Swagger lee de los controladores y los DTO.
const cache = new Map();
function cargaTs(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const salida = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2023,
    },
    fileName: file,
  }).outputText;
  const mod = { exports: {} };
  cache.set(file, mod);
  const dir = path.dirname(file);
  const requiere = (id) => {
    if (!id.startsWith('.')) return require(id);
    const base = path.resolve(dir, id);
    return cargaTs(fs.existsSync(`${base}.ts`) ? `${base}.ts` : path.join(base, 'index.ts'));
  };
  new Function('exports', 'require', 'module', '__filename', '__dirname', salida)(
    mod.exports, requiere, mod, file, dir,
  );
  return mod.exports;
}

const src = path.join(__dirname, '..');
const controladores = [
  ['auth/auth.controller.ts', 'AuthController'],
  ['salud/salud.controller.ts', 'SaludController'],
  ['menu/menu.controller.ts', 'MenuController'],
  ['balance/balance.controller.ts', 'BalanceController'],
  ['mantenedores/mantenedores.controller.ts', 'MantenedoresController'],
  ['compras/compras.controller.ts', 'ComprasController'],
  ['bodega/bodega.controller.ts', 'BodegaController'],
  ['distribucion/distribucion.controller.ts', 'DistribucionController'],
  ['inteligencia/inteligencia.controller.ts', 'InteligenciaController'],
].map(([archivo, nombre]) => cargaTs(path.join(src, archivo))[nombre]);

// Cada controlador recibe servicios vacios: el contrato no ejecuta la logica.
const servicios = controladores.flatMap((c) => Reflect.getMetadata('design:paramtypes', c) ?? []);

describe('contrato OpenAPI', () => {
  let app;
  let doc;

  beforeAll(async () => {
    class DocsModule {}
    Module({
      controllers: controladores,
      providers: servicios.map((s) => ({ provide: s, useValue: {} })),
    })(DocsModule);
    app = await NestFactory.create(DocsModule, { logger: false });
    app.setGlobalPrefix('api');
    doc = cargaTs(path.join(__dirname, 'documentacion.ts')).construyeDocumento(app);
  });

  afterAll(() => app.close());

  it('declara el esquema bearer JWT', () => {
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.components.securitySchemes.bearer).toEqual({
      type: 'http', scheme: 'bearer', bearerFormat: 'JWT',
    });
  });

  it('cubre autenticacion, salud y los recursos ya expuestos bajo /api', () => {
    const rutas = Object.keys(doc.paths);
    for (const ruta of [
      '/api/auth/login', '/api/auth/sesion', '/api/auth/salir', '/api/health', '/api/menu',
      '/api/balance/resumen', '/api/mantenedores/{codigo}/{id}', '/api/compras/oc',
      '/api/compras/hes', '/api/bodega/stock', '/api/bodega/ajuste', '/api/distribucion/{id}',
      '/api/inteligencia/eco',
    ]) {
      expect(rutas).toContain(ruta);
    }
    expect(rutas.every((r) => r.startsWith('/api/'))).toBe(true);
  });

  it('separa por tags y marca solo lo protegido con bearer', () => {
    expect(doc.paths['/api/health'].get.tags).toEqual(['health']);
    expect(doc.paths['/api/health'].get.security).toBeUndefined();
    expect(doc.paths['/api/auth/login'].post.security).toBeUndefined();
    expect(doc.paths['/api/auth/sesion'].get.security).toEqual([{ bearer: [] }]);
    expect(doc.paths['/api/bodega/stock'].get.security).toEqual([{ bearer: [] }]);
  });

  it('muestra los cuerpos de los DTO como esquemas', () => {
    const schemas = doc.components.schemas;
    expect(Object.keys(schemas.LoginDto.properties)).toEqual(['user', 'clave']);
    expect(schemas.GrDoc.required).toEqual(
      expect.arrayContaining(['tipoMov', 'tipo_vhe', 'bodega', 'lineas']),
    );
    const cuerpo = doc.paths['/api/bodega/ajuste'].post.requestBody.content['application/json'];
    expect(cuerpo.schema.$ref).toBe('#/components/schemas/AjusteDoc');
  });

  it('no incluye secretos ni datos reales en los ejemplos', () => {
    const texto = JSON.stringify(doc);
    expect(texto).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // JWT
    expect(texto).not.toMatch(/JWT_SECRET|PG_PASSWORD|BEGIN [A-Z ]*PRIVATE KEY/);
    expect(texto).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // correos
    expect(texto).toContain('11.111.111-1');
  });
});
