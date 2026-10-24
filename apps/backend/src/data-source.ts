import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';

import * as entidades from './entidades/acceso.entity';
import * as preciosEntidades from './precios/precios.entity';

/** PG_* es lo del backend; PG* es lo que usa CI. Sin dotenv: las variables llegan por el entorno. */
const env = (k: string) => process.env[`PG_${k}`] ?? process.env[`PG${k}`];

export const opcionesBase = {
  type: 'postgres' as const,
  entities: [...Object.values(entidades), ...Object.values(preciosEntidades)].filter((e) => typeof e === 'function'),
  migrations: [join(__dirname, 'migraciones', '*.{js,ts}')],
  // Tabla de control de TypeORM: la unica que va en public; no toca ninguna tabla de la replica.
  migrationsTableName: 'migraciones_typeorm',
  // Jamas: el esquema de la replica lo manda 01_schema.sql.
  synchronize: false,
};

/** DataSource del CLI: npm run migracion:ejecutar (compilado, desde dist/). */
export default new DataSource({
  ...opcionesBase,
  host: env('HOST'),
  port: Number(env('PORT') ?? 5432),
  username: env('USER'),
  password: env('PASSWORD'),
  database: env('DATABASE'),
});
