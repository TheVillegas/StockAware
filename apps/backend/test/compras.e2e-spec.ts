/**
 * Pruebas de extremo a extremo del ciclo OC → HES.
 *
 * Lo que se está fijando aquí son las reglas de cálculo del ERP, que no son
 * las obvias. Si alguien "simplifica" el avance de la cabecera a un promedio
 * de las líneas, estas pruebas lo detienen.
 *
 * Requieren la base levantada.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from './../src/app.module.js';
import { ErroresBdFilter } from './../src/common/errores-bd.filter.js';

const CLAVE = 'stockaware';

describe('Compras: OC → HES (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['/'] });
    app.useGlobalFilters(new ErroresBdFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: CLAVE });
    token = res.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = (t = token) => ({ Authorization: `Bearer ${t}` });

  /** OC de dos líneas: 10 × 4.500 = 45.000 y 5 × 8.990 = 44.950. Neto 89.950. */
  const crearOc = async () => {
    const res = await request(app.getHttpServer())
      .post('/api/compras/ordenes')
      .set(auth())
      .send({
        proveedorId: 1,
        ccostoId: 1,
        detalle: [
          { nombre: 'Guante cabritilla talla 9/MC_002', cantidad: 10, unidad: 'PAR', precioUni: 4500 },
          { nombre: 'Casco de seguridad blanco/MC_001', cantidad: 5, unidad: 'UNI', precioUni: 8990 },
        ],
      })
      .expect(201);
    return res.body;
  };

  const aprobar = (id: number) =>
    request(app.getHttpServer())
      .post(`/api/compras/ordenes/${id}/aprobar`)
      .set(auth())
      .expect(201);

  it('crea la OC en PENDIENTE y calcula neto, IVA y total', async () => {
    const oc = await crearOc();
    expect(oc.estado).toBe('PENDIENTE');
    expect(oc.neto).toBe(89950);
    expect(oc.iva).toBe(17091); // 89.950 × 0,19 redondeado
    expect(oc.total).toBe(107041);
    expect(oc.numdoc).toBeGreaterThanOrEqual(12000);
    expect(oc.detalle).toHaveLength(2);
  });

  it('no deja recibir contra una OC que no está EMITIDO', async () => {
    const oc = await crearOc();
    await request(app.getHttpServer())
      .post('/api/compras/hes')
      .set(auth())
      .send({ ocId: oc.id, detalle: [{ detalleOcId: oc.detalle[0].id, cantidad: 1 }] })
      .expect(409);
  });

  it('aprueba la OC: PENDIENTE pasa a EMITIDO', async () => {
    const oc = await crearOc();
    const res = await aprobar(oc.id);
    expect(res.body.estado).toBe('EMITIDO');
  });

  it('no aprueba dos veces', async () => {
    const oc = await crearOc();
    await aprobar(oc.id);
    await request(app.getHttpServer())
      .post(`/api/compras/ordenes/${oc.id}/aprobar`)
      .set(auth())
      .expect(409);
  });

  describe('avance de una recepción parcial', () => {
    it('la línea sube por cantidad y la cabecera por MONTO, no por promedio', async () => {
      const oc = await crearOc();
      await aprobar(oc.id);

      // Se reciben 3 de las 10 unidades de la primera línea: 13.500 de 89.950.
      const hes = await request(app.getHttpServer())
        .post('/api/compras/hes')
        .set(auth())
        .send({ ocId: oc.id, detalle: [{ detalleOcId: oc.detalle[0].id, cantidad: 3 }] })
        .expect(201);

      expect(hes.body.neto).toBe(13500);
      // 13500 / 89950 × 100 = 15,0083…  NO 30 (la línea) ni 15 (el promedio).
      expect(hes.body.ocAvance).toBeCloseTo(15.0083, 4);

      const vista = await request(app.getHttpServer())
        .get(`/api/compras/ordenes/${oc.id}`)
        .set(auth())
        .expect(200);

      expect(vista.body.ocAvance).toBeCloseTo(15.0083, 4);
      expect(vista.body.detalle[0].ocAvance).toBe(30);
      expect(vista.body.detalle[1].ocAvance).toBe(0);
    });

    it('rechaza recibir más de lo pendiente', async () => {
      const oc = await crearOc();
      await aprobar(oc.id);
      await request(app.getHttpServer())
        .post('/api/compras/hes')
        .set(auth())
        .send({ ocId: oc.id, detalle: [{ detalleOcId: oc.detalle[0].id, cantidad: 3 }] })
        .expect(201);

      // Quedaban 7; pedir 8 debe fallar.
      const res = await request(app.getHttpServer())
        .post('/api/compras/hes')
        .set(auth())
        .send({ ocId: oc.id, detalle: [{ detalleOcId: oc.detalle[0].id, cantidad: 8 }] })
        .expect(409);

      expect(res.body.message).toContain('pendiente');
    });

    it('rechaza una línea que no pertenece a la OC', async () => {
      const oc = await crearOc();
      const otra = await crearOc();
      await aprobar(oc.id);

      await request(app.getHttpServer())
        .post('/api/compras/hes')
        .set(auth())
        .send({ ocId: oc.id, detalle: [{ detalleOcId: otra.detalle[0].id, cantidad: 1 }] })
        .expect(400);
    });
  });

  describe('anulación y reversa', () => {
    it('no anula una OC referenciada por una HES', async () => {
      const oc = await crearOc();
      await aprobar(oc.id);
      await request(app.getHttpServer())
        .post('/api/compras/hes')
        .set(auth())
        .send({ ocId: oc.id, detalle: [{ detalleOcId: oc.detalle[0].id, cantidad: 2 }] })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/api/compras/ordenes/${oc.id}/anular`)
        .set(auth())
        .expect(409);

      expect(res.body.message).toContain('HES');
    });

    it('eliminar la HES devuelve los avances a cero y deja anular la OC', async () => {
      const oc = await crearOc();
      await aprobar(oc.id);

      const hes = await request(app.getHttpServer())
        .post('/api/compras/hes')
        .set(auth())
        .send({ ocId: oc.id, detalle: [{ detalleOcId: oc.detalle[0].id, cantidad: 4 }] })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/compras/hes/${hes.body.id}`)
        .set(auth())
        .expect(200);

      const vista = await request(app.getHttpServer())
        .get(`/api/compras/ordenes/${oc.id}`)
        .set(auth())
        .expect(200);

      expect(Number(vista.body.ocAvance)).toBe(0);
      expect(Number(vista.body.detalle[0].ocAvance)).toBe(0);

      // Réplica del ERP: "anular" deja la OC en ELIMINADO, no en ANULADO.
      const anulada = await request(app.getHttpServer())
        .post(`/api/compras/ordenes/${oc.id}/anular`)
        .set(auth())
        .expect(201);
      expect(anulada.body.estado).toBe('ELIMINADO');
    });
  });

  it('exige el permiso "Aprueba OC"', async () => {
    const oc = await crearOc();
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'bodega', password: CLAVE });

    await request(app.getHttpServer())
      .post(`/api/compras/ordenes/${oc.id}/aprobar`)
      .set(auth(res.body.access_token))
      .expect(403);
  });
});
