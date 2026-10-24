// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
require('reflect-metadata');
const path = require('path');
const { HttpException } = require('@nestjs/common');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { cargaTs } = require('../fuentes/carga-ts');

const { EscrituraPreciosService } = cargaTs(path.join(__dirname, 'escritura.service.ts'));
const { CambiaVinculoDto, CotizableDto, FuenteUrlDto } = cargaTs(path.join(__dirname, 'escritura.dto.ts'));

const CTX = { usuario: 'jperez', ip: '127.0.0.1' };
const RHONA = 'https://rhona.cl/catalogo/4/materiales-electricos/35/herramientas.html';
const SODIMAC = 'https://www.sodimac.cl/sodimac-cl/category/scat955562/interruptores';

function armar({ material = { nombre: 'Amarra' }, permite = true, vinculo = { id: 7, cod_material: 'M1', estado: 'rechazado' } } = {}) {
  const precios = {
    cambiaEstadoVinculo: jest.fn(async () => vinculo),
    guardaUrlFuente: jest.fn(async () => ({ url_anterior: null })),
    defineCotizable: jest.fn(async (cod, cotizable, motivo) => ({ cod_material: cod, cotizable, motivo, definido_por: 'usuario' })),
  };
  const erp = { material: jest.fn(async () => material) };
  const auditoria = { anotar: jest.fn(async () => {}) };
  const svc = new EscrituraPreciosService(precios, erp, auditoria);
  svc.robots = { permite: jest.fn(async () => permite) };
  return { svc, precios, erp, auditoria };
}
async function rechazo(promesa) {
  try {
    await promesa;
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    return [e.getStatus(), e.getResponse().error];
  }
  throw new Error('debia fallar');
}
const errores = async (Clase, cuerpo) => (await validate(plainToInstance(Clase, cuerpo), { whitelist: true })).map((e) => e.property);

describe('EscrituraPreciosService', () => {
  it('cambia el estado del vinculo, es idempotente y deja la traza', async () => {
    const { svc, precios, auditoria } = armar();
    const a = await svc.cambiaVinculo(7, { estado: 'rechazado' }, CTX);
    const b = await svc.cambiaVinculo(7, { estado: 'rechazado' }, CTX);
    expect(a).toEqual(b);
    expect(precios.cambiaEstadoVinculo).toHaveBeenCalledWith(7, 'rechazado');
    expect(auditoria.anotar.mock.calls[0][0]).toMatchObject({ usuario: 'jperez', tipo_accion: 'MOD_REG', tabla_accion: 'vinculo_material', id_registro: 7, IP: '127.0.0.1' });
  });

  it('404 vinculo_not_found si no existe o el id no cabe en un integer', async () => {
    const { svc, precios, auditoria } = armar({ vinculo: null });
    expect(await rechazo(svc.cambiaVinculo(99, { estado: 'confirmado' }, CTX))).toEqual([404, 'vinculo_not_found']);
    expect(await rechazo(svc.cambiaVinculo(2 ** 31, { estado: 'confirmado' }, CTX))).toEqual([404, 'vinculo_not_found']);
    expect(await rechazo(svc.cambiaVinculo(-1, { estado: 'confirmado' }, CTX))).toEqual([404, 'vinculo_not_found']);
    expect(precios.cambiaEstadoVinculo).toHaveBeenCalledTimes(1);
    expect(auditoria.anotar).not.toHaveBeenCalled();
  });

  it('asocia la URL de listado de Rhona y de Sodimac tras consultar robots.txt', async () => {
    const { svc, precios, auditoria } = armar();
    await expect(svc.asociaUrl('M1', { fuente: 'rhona', url: ` ${RHONA} ` }, CTX)).resolves.toEqual({ cod_material: 'M1', fuente: 'rhona', url: RHONA, url_anterior: null });
    await svc.asociaUrl('M1', { fuente: 'sodimac', url: SODIMAC }, CTX);
    expect(svc.robots.permite.mock.calls.map((c) => c[0])).toEqual([RHONA, SODIMAC]);
    expect(precios.guardaUrlFuente.mock.calls).toEqual([['M1', 'rhona', RHONA], ['M1', 'sodimac', SODIMAC]]);
    expect(auditoria.anotar).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['no es una URL', 'rhona', 'no-es-url', 'url_invalid'],
    ['es http', 'rhona', RHONA.replace('https', 'http'), 'url_invalid'],
    ['es de otro dominio', 'sodimac', RHONA, 'url_domain_mismatch'],
    ['parece del dominio', 'rhona', 'https://rhona.cl.evil.com/catalogo/1/x.html', 'url_domain_mismatch'],
    ['es un producto de Rhona', 'rhona', 'https://rhona.cl/producto/10408/dobla-conduit-20mm.html', 'url_not_listing'],
    ['es un producto de Sodimac', 'sodimac', 'https://www.sodimac.cl/sodimac-cl/articulo/123/x', 'url_not_listing'],
    ['es el buscador de Sodimac', 'sodimac', 'https://www.sodimac.cl/sodimac-cl/buscar/?Ntt=cable', 'url_not_listing'],
  ])('422 %s', async (_c, fuente, url, codigo) => {
    const { svc, precios } = armar();
    expect(await rechazo(svc.asociaUrl('M1', { fuente, url }, CTX))).toEqual([422, codigo]);
    expect(svc.robots.permite).not.toHaveBeenCalled();
    expect(precios.guardaUrlFuente).not.toHaveBeenCalled();
  });

  it('422 url_blocked_by_robots si robots.txt la prohibe, y no guarda ni anota', async () => {
    const { svc, precios, auditoria } = armar({ permite: false });
    expect(await rechazo(svc.asociaUrl('M1', { fuente: 'rhona', url: RHONA }, CTX))).toEqual([422, 'url_blocked_by_robots']);
    expect(precios.guardaUrlFuente).not.toHaveBeenCalled();
    expect(auditoria.anotar).not.toHaveBeenCalled();
  });

  it('corrige cotizable con definido_por usuario; el motivo vacio queda en null', async () => {
    const { svc, precios, auditoria } = armar();
    await expect(svc.defineCotizable('M1', { cotizable: false, motivo: ' servicio ' }, CTX)).resolves.toMatchObject({ cotizable: false, motivo: 'servicio', definido_por: 'usuario' });
    await svc.defineCotizable('M1', { cotizable: true, motivo: '  ' }, CTX);
    expect(precios.defineCotizable.mock.calls).toEqual([['M1', false, 'servicio'], ['M1', true, null]]);
    expect(auditoria.anotar.mock.calls[0][0]).toMatchObject({ tabla_accion: 'material_cotizable', inf_1: 'PRECIOS_COTIZABLE' });
  });

  it('404 material_not_found en los dos PUT, antes de validar o escribir', async () => {
    const { svc, precios } = armar({ material: null });
    expect(await rechazo(svc.asociaUrl('X', { fuente: 'rhona', url: 'no-es-url' }, CTX))).toEqual([404, 'material_not_found']);
    expect(await rechazo(svc.defineCotizable('X', { cotizable: true }, CTX))).toEqual([404, 'material_not_found']);
    expect(precios.guardaUrlFuente).not.toHaveBeenCalled();
    expect(precios.defineCotizable).not.toHaveBeenCalled();
  });

  it('la traza respeta los largos de registro (tabla 30, IP 15)', async () => {
    const { svc, auditoria } = armar();
    await svc.cambiaVinculo(7, { estado: 'confirmado' }, { usuario: 'jperez', ip: '192.168.100.200' });
    await svc.defineCotizable('M1', { cotizable: true }, CTX);
    for (const [d] of auditoria.anotar.mock.calls) {
      expect(d.tabla_accion.length).toBeLessThanOrEqual(30);
      expect(d.IP.length).toBeLessThanOrEqual(15);
    }
  });
});

describe('DTO de escritura (ValidationPipe)', () => {
  it('estado solo confirmado o rechazado', async () => {
    expect(await errores(CambiaVinculoDto, { estado: 'confirmado' })).toEqual([]);
    expect(await errores(CambiaVinculoDto, { estado: 'propuesto' })).toEqual(['estado']);
    expect(await errores(CambiaVinculoDto, {})).toEqual(['estado']);
  });
  it('fuente solo rhona o sodimac y url texto de hasta 500', async () => {
    expect(await errores(FuenteUrlDto, { fuente: 'rhona', url: RHONA })).toEqual([]);
    expect(await errores(FuenteUrlDto, { fuente: 'dartel', url: RHONA })).toEqual(['fuente']);
    expect(await errores(FuenteUrlDto, { fuente: 'rhona', url: 5 })).toEqual(['url']);
    expect(await errores(FuenteUrlDto, { fuente: 'rhona', url: 'x'.repeat(501) })).toEqual(['url']);
  });
  it('cotizable booleano y motivo opcional de hasta 100', async () => {
    expect(await errores(CotizableDto, { cotizable: false })).toEqual([]);
    expect(await errores(CotizableDto, { cotizable: 'no' })).toEqual(['cotizable']);
    expect(await errores(CotizableDto, { cotizable: true, motivo: 'x'.repeat(101) })).toEqual(['motivo']);
  });
});
