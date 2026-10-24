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
    const ctl = new PreciosController({ consulta });
    await expect(ctl.precios('MC_001')).resolves.toEqual({ cotizable: true });
    expect(consulta).toHaveBeenCalledWith('MC_001');
  });

  it('no expone escrituras en este PR', () => {
    const metodos = Object.getOwnPropertyNames(PreciosController.prototype).filter((m) => m !== 'constructor');
    expect(metodos).toEqual(['precios']);
  });
});
