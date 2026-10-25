// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
const fs = require('fs');
const path = require('path');
const { cargaTs } = require('../precios/fuentes/carga-ts');

const controllerPath = path.join(__dirname, 'salud.controller.ts');
const { SaludController } = cargaTs(controllerPath);
const { HttpException } = require('@nestjs/common');

describe('SaludController', () => {
  const original = process.env.RENDER_GIT_COMMIT;

  afterEach(() => {
    if (original === undefined) delete process.env.RENDER_GIT_COMMIT;
    else process.env.RENDER_GIT_COMMIT = original;
  });

  it('returns erp health without a JWT guard when postgres answers', async () => {
    const source = fs.readFileSync(controllerPath, 'utf8');
    expect(source).not.toMatch(/UseGuards|JwtAuthGuard|TypeOrm/);
    process.env.RENDER_GIT_COMMIT = 'abc123';
    await expect(new SaludController({ comprobar: async () => true }).salud()).resolves.toEqual({
      estado: 'ok',
      servicio: 'erp-backend',
      postgres: 'ok',
      version: 'abc123',
    });
  });

  it('reports postgres down without the driver message', async () => {
    delete process.env.RENDER_GIT_COMMIT;
    const fallo = new SaludController({
      comprobar: async () => {
        throw new Error('password=secret host=db.internal');
      },
    }).salud();
    await expect(fallo).rejects.toBeInstanceOf(HttpException);
    try {
      await fallo;
    } catch (error) {
      expect(error.getStatus()).toBe(503);
      const cuerpo = error.getResponse();
      expect(cuerpo).toEqual({
        estado: 'error',
        servicio: 'erp-backend',
        postgres: 'error',
        version: 'local',
      });
      expect(JSON.stringify(cuerpo)).not.toContain('secret');
    }
  });
});
