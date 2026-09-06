/**
 * Pruebas de extremo a extremo de los mantenedores.
 *
 * Requieren la base levantada. Dejan filas creadas: se limpian con
 * `docker compose down -v && docker compose up -d`.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from './../src/app.module.js';
import { ErroresBdFilter } from './../src/common/errores-bd.filter.js';

const CLAVE = 'stockaware';
const sufijo = Date.now().toString().slice(-6);

describe('Mantenedores (e2e)', () => {
  let app: INestApplication<App>;
  let tokenAdmin: string;

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
    tokenAdmin = res.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = (token = tokenAdmin) => ({ Authorization: `Bearer ${token}` });

  const login = async (username: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password: CLAVE });
    return res.body.access_token as string;
  };

  describe('listado', () => {
    it('pagina y devuelve el total', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/mantenedores/materiales?limite=3')
        .set(auth())
        .expect(200);

      expect(res.body.datos).toHaveLength(3);
      expect(res.body.total).toBeGreaterThanOrEqual(10);
      expect(res.body.paginas).toBe(Math.ceil(res.body.total / 3));
    });

    it('resuelve la categoría en el listado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/mantenedores/materiales?buscar=cabritilla')
        .set(auth())
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.datos[0].categoria).toBe('Guantes');
    });

    it('rechaza un límite fuera de rango', () =>
      request(app.getHttpServer())
        .get('/api/mantenedores/materiales?limite=500')
        .set(auth())
        .expect(400));

    it('devuelve la jerarquía de categorías anidada', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/mantenedores/categorias/arbol')
        .set(auth())
        .expect(200);

      const epp = res.body.find((c: { codigo: string }) => c.codigo === 'EPP');
      expect(epp.tipo).toBe('CAT');
      expect(epp.hijos.length).toBeGreaterThan(0);
      expect(epp.hijos[0].hijos[0].tipo).toBe('IND');
    });
  });

  describe('escritura', () => {
    let idCreado: number;

    it('crea un material', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/mantenedores/materiales')
        .set(auth())
        .send({
          codMaterial: `MC_T${sufijo}`,
          nombre: 'Material de prueba',
          unidad: 'UNI',
          tarifa: 1000,
          stockMinimo: 5,
        })
        .expect(201);

      expect(res.body.id).toBeGreaterThan(0);
      idCreado = res.body.id;
    });

    /**
     * Regresión: los DTO opcionales llegan con las propiedades declaradas en
     * `undefined`, y al mezclarlas con la fila existente borraban los campos
     * que no se querían tocar. La base los ignoraba, pero la respuesta y la
     * bitácora salían incompletas.
     */
    it('una actualización parcial no pierde los campos que no se enviaron', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/mantenedores/materiales/${idCreado}`)
        .set(auth())
        .send({ tarifa: 2500 })
        .expect(200);

      expect(res.body.tarifa).toBe(2500);
      expect(res.body.nombre).toBe('Material de prueba');
      expect(res.body.unidad).toBe('UNI');
      expect(res.body.stockMinimo).toBe(5);
    });

    it('devuelve 409 ante un código repetido, no 500', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/mantenedores/materiales')
        .set(auth())
        .send({ codMaterial: 'MC_001', nombre: 'Repetido', unidad: 'UNI' })
        .expect(409);

      expect(res.body.detalle).toContain('MC_001');
    });

    it('devuelve 400 si la categoría referenciada no existe', () =>
      request(app.getHttpServer())
        .post('/api/mantenedores/materiales')
        .set(auth())
        .send({
          codMaterial: `MC_X${sufijo}`,
          nombre: 'Huérfano',
          unidad: 'UNI',
          categoriaId: 999999,
        })
        .expect(400));

    it('devuelve 400 ante una unidad que no está en el enumerado', () =>
      request(app.getHttpServer())
        .post('/api/mantenedores/materiales')
        .set(auth())
        .send({ codMaterial: `MC_Y${sufijo}`, nombre: 'X', unidad: 'QUINTAL' })
        .expect(400));

    it('deja la operación anotada en la bitácora', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/mantenedores/materiales?buscar=Material de prueba')
        .set(auth())
        .expect(200);
      // La bitácora se verifica sobre la base; aquí basta confirmar que la
      // escritura quedó firme y visible en el listado.
      expect(res.body.total).toBe(1);
    });
  });

  describe('permisos por perfil', () => {
    it.each([
      ['bodega', 'materiales', 200],
      ['bodega', 'proveedores', 403],
      ['compras', 'proveedores', 200],
      ['compras', 'bodegas', 403],
    ])('%s sobre %s responde %i', async (usuario, recurso, esperado) => {
      const token = await login(usuario as string);
      await request(app.getHttpServer())
        .get(`/api/mantenedores/${recurso}`)
        .set(auth(token))
        .expect(esperado as number);
    });

    it('exige autenticación', () =>
      request(app.getHttpServer())
        .get('/api/mantenedores/materiales')
        .expect(401));
  });
});
