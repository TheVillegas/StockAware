// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
require('reflect-metadata');
const path = require('path');
const { cargaTs } = require('./fuentes/carga-ts');

const { PreciosController } = cargaTs(path.join(__dirname, 'precios.controller.ts'));
const { JwtAuthGuard, PermisosGuard, PERMISO_CLAVE } = cargaTs(path.join(__dirname, '../comun/permisos.guard.ts'));

describe('PreciosController', () => {
  it('cuelga de /precios con JWT y permisos, y exige MATERIAL_X_BODEGA en el GET', () => {
    expect(Reflect.getMetadata('path', PreciosController)).toBe('precios');
    expect(Reflect.getMetadata('__guards__', PreciosController)).toEqual([JwtAuthGuard, PermisosGuard]);
    const metodo = PreciosController.prototype.precios;
    expect(Reflect.getMetadata('path', metodo)).toBe(':codMaterial');
    expect(Reflect.getMetadata('method', metodo)).toBe(0); // RequestMethod.GET
    expect(Reflect.getMetadata(PERMISO_CLAVE, metodo)).toBe('MATERIAL_X_BODEGA');
  });

  it('delega en el servicio con el codigo del material', async () => {
    const consulta = jest.fn().mockResolvedValue({ cotizable: true });
    const ctl = new PreciosController({ consulta }, {});
    await expect(ctl.precios('MC_001')).resolves.toEqual({ cotizable: true });
    expect(consulta).toHaveBeenCalledWith('MC_001');
  });

  it.each([
    ['vinculo', 'vinculos/:id', 4], // RequestMethod.PATCH
    ['fuenteUrl', ':codMaterial/fuente-url', 2], // PUT
    ['cotizable', ':codMaterial/cotizable', 2],
  ])('%s exige MOD_MATERIALES en %s', (nombre, ruta, metodoHttp) => {
    const metodo = PreciosController.prototype[nombre];
    expect(Reflect.getMetadata('path', metodo)).toBe(ruta);
    expect(Reflect.getMetadata('method', metodo)).toBe(metodoHttp);
    expect(Reflect.getMetadata(PERMISO_CLAVE, metodo)).toBe('MOD_MATERIALES');
  });

  it('las escrituras delegan con el login de req.user y la IP sin prefijo IPv4-mapeado', async () => {
    const escritura = { cambiaVinculo: jest.fn(async () => 'v'), asociaUrl: jest.fn(async () => 'u'), defineCotizable: jest.fn(async () => 'c') };
    const ctl = new PreciosController({}, escritura);
    const req = { user: { login: 'jperez' } };
    const ctx = { usuario: 'jperez', ip: '127.0.0.1' };
    await ctl.vinculo(7, { estado: 'rechazado' }, req, '::ffff:127.0.0.1');
    await ctl.fuenteUrl('M1', { fuente: 'rhona', url: 'u' }, req, '127.0.0.1');
    await ctl.cotizable('M1', { cotizable: false }, req, '127.0.0.1');
    expect(escritura.cambiaVinculo).toHaveBeenCalledWith(7, { estado: 'rechazado' }, ctx);
    expect(escritura.asociaUrl).toHaveBeenCalledWith('M1', { fuente: 'rhona', url: 'u' }, ctx);
    expect(escritura.defineCotizable).toHaveBeenCalledWith('M1', { cotizable: false }, ctx);
  });
});
