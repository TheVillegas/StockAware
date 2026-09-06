/**
 * Configuración leída del entorno.
 *
 * Las credenciales nunca se escriben en el código: vienen de .env, que no se
 * versiona. Ver .env.example en la raíz del repositorio.
 */
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ENTIDADES } from '../entities/index.js';

const entero = (valor: string | undefined, porDefecto: number): number => {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
};

export const configuracion = () => ({
  puerto: entero(process.env.BACKEND_PORT, 3000),
  entorno: process.env.NODE_ENV ?? 'development',
  jwt: {
    secreto: process.env.JWT_SECRET ?? 'stockaware-dev-secret-cambiar',
    expiraEn: process.env.JWT_EXPIRES_IN ?? '8h',
  },
});

export const opcionesTypeOrm = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: entero(process.env.POSTGRES_PORT, 5432),
  username: process.env.POSTGRES_USER ?? 'stockaware',
  password: process.env.POSTGRES_PASSWORD ?? 'stockaware',
  database: process.env.POSTGRES_DB ?? 'stockaware',
  entities: ENTIDADES,

  // El esquema lo define database/init/01_schema.sql y lo aplica PostgreSQL al
  // crear el volumen. TypeORM solo lo describe: si sincronizara, reescribiría
  // decisiones deliberadas de la réplica (enums, vistas, restricciones).
  synchronize: false,

  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});
