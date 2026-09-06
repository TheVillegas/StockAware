/**
 * Pruebas de extremo a extremo del esqueleto.
 *
 * Requieren la base levantada: `docker compose up -d` en la raíz del
 * repositorio. Verifican lo mismo que se comprobó a mano al cerrar la fase 2:
 * salud, login, y que el guard distinga entre no autenticado (401) y
 * autenticado sin permiso (403).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from './../src/app.module.js';

const CLAVE = 'stockaware';

describe('Esqueleto del backend (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['/'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const login = async (username: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password: CLAVE })
      .expect(200);
    return res.body.access_token as string;
  };

  it('informa su salud y la de la base', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(res.body.estado).toBe('ok');
    expect(res.body.base_datos.conectada).toBe(true);
  });

  it('la raíz redirige a la documentación', () =>
    request(app.getHttpServer())
      .get('/')
      .expect(302)
      .expect('Location', '/docs'));

  it('entrega token y permisos al iniciar sesión', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: CLAVE })
      .expect(200);

    expect(res.body.access_token).toBeTruthy();
    expect(res.body.usuario.perfil).toBe('Administrador');
    expect(res.body.usuario.permisos).toContain('Stock por bodega');
  });

  it('rechaza credenciales incorrectas', () =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'incorrecta' })
      .expect(401));

  it('rechaza campos no declarados en el DTO', () =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: CLAVE, rol: 'root' })
      .expect(400));

  it('exige autenticación para consultar el stock', () =>
    request(app.getHttpServer()).get('/api/inventario/stock').expect(401));

  it('deja consultar el stock a quien tiene el permiso', async () => {
    const token = await login('bodega');
    const res = await request(app.getHttpServer())
      .get('/api/inventario/stock')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    // El transformer numérico tiene que devolver números, no strings.
    expect(typeof res.body[0].stock).toBe('number');
  });

  it('niega el stock a un perfil autenticado sin ese permiso', async () => {
    const token = await login('compras');
    const res = await request(app.getHttpServer())
      .get('/api/inventario/stock')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(res.body.message).toContain('Stock por bodega');
  });
});
