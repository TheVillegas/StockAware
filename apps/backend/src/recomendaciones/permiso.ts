/**
 * Funcion de acceso RECOMENDACIONES (S3): se siembra en public.acceso_funciones y se concede
 * (ACTIVO) a todo perfil que ya tenga MATERIAL_X_BODEGA activo.
 *
 * Las mismas sentencias las usa la migracion y el aseguramiento de arranque. Hacen falta los dos
 * porque load-replica.mjs puede vaciar las tablas de public (TRUNCATE ... CASCADE, salvo
 * migraciones_typeorm) cuando la replica se recarga; la migracion queda marcada como corrida y no
 * volveria a sembrar el permiso. Es ese caso, y solo ese, el que repara aseguraPermiso.
 */
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const GLOSA = 'RECOMENDACIONES';

/**
 * Los datos de la replica entran por COPY con sus id, sin avanzar la secuencia (ver 04_secuencias.sql):
 * se sincroniza antes de insertar para no chocar con las filas existentes.
 */
const sincroniza = (tabla: string, columna: string) =>
  `SELECT setval(pg_get_serial_sequence('public.${tabla}', '${columna}'),
          GREATEST((SELECT coalesce(max(${columna}), 0) FROM public.${tabla}), 1),
          (SELECT count(*) > 0 FROM public.${tabla}))`;

/** Las tablas de acceso son de la replica: si todavia no estan, no hay nada que sembrar. */
export const HAY_TABLAS_DE_ACCESO =
  `SELECT to_regclass('public.acceso_funciones') IS NOT NULL AND to_regclass('public.acceso_permisos') IS NOT NULL AS tablas`;

/**
 * acc_tipo y per_estado son enums de la replica: los literales llevan cast explicito porque con
 * SELECT DISTINCT Postgres los resuelve como text y el INSERT fallaria.
 * Idempotente: cada sentencia se puede repetir sin duplicar ni pisar decisiones de un administrador. */
export const SEMBRAR_PERMISO: string[] = [
  sincroniza('acceso_funciones', 'acc_id'),
  // FUNCION con padre 0, como EMITE_FACTURA o ANULAR_ORDEN_COMPRA: no aparece en el menu.
  `INSERT INTO public.acceso_funciones (acc_tipo, acc_glosa, acc_padre, acc_fini, acc_ffin, acc_estado, acc_descripcion)
SELECT 'FUNCION'::acceso_funciones_acc_tipo_enum, '${GLOSA}', 0, DATE '2026-01-01', DATE '2099-04-01', 'ACTIVO', 'Recomendaciones de reposicion'
WHERE NOT EXISTS (SELECT 1 FROM public.acceso_funciones WHERE acc_glosa = '${GLOSA}')`,
  sincroniza('acceso_permisos', 'per_id'),
  // Un permiso ya existente (incluso INACTIVO) no se toca: la decision del administrador manda.
  `INSERT INTO public.acceso_permisos (per_perfil, per_func, per_estado, per_fecha)
SELECT DISTINCT p.per_perfil, r.acc_id, 'ACTIVO'::acceso_permisos_per_estado_enum, CURRENT_DATE
FROM public.acceso_permisos p
JOIN public.acceso_funciones m ON m.acc_id = p.per_func AND m.acc_glosa = 'MATERIAL_X_BODEGA'
JOIN public.acceso_funciones r ON r.acc_glosa = '${GLOSA}'
WHERE p.per_estado = 'ACTIVO'
  AND NOT EXISTS (SELECT 1 FROM public.acceso_permisos x WHERE x.per_perfil = p.per_perfil AND x.per_func = r.acc_id)`,
];

/** Concesiones primero, despues el codigo. */
export const QUITAR_PERMISO: string[] = [
  `DELETE FROM public.acceso_permisos WHERE per_func IN (SELECT acc_id FROM public.acceso_funciones WHERE acc_glosa = '${GLOSA}')`,
  `DELETE FROM public.acceso_funciones WHERE acc_glosa = '${GLOSA}'`,
];

type Consulta = Pick<DataSource, 'query' | 'transaction'>;

/**
 * Si las tablas de acceso existen y la funcion no esta (replica recargada tras la migracion), la
 * siembra de nuevo con sus concesiones. Si la funcion existe no escribe nada, asi que no devuelve
 * un permiso que un administrador haya quitado a un perfil.
 * @returns true si sembro.
 */
export async function aseguraPermiso(ds: Consulta): Promise<boolean> {
  const [{ tablas }] = await ds.query(HAY_TABLAS_DE_ACCESO);
  if (!tablas) return false;
  const [{ existe }] = await ds.query(`SELECT EXISTS (SELECT 1 FROM public.acceso_funciones WHERE acc_glosa = '${GLOSA}') AS existe`);
  if (existe) return false;
  await ds.transaction(async (m) => {
    for (const sql of SEMBRAR_PERMISO) await m.query(sql);
  });
  return true;
}

@Injectable()
export class PermisoRecomendaciones implements OnApplicationBootstrap {
  private readonly log = new Logger(PermisoRecomendaciones.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      if (await aseguraPermiso(this.ds)) this.log.warn(`La funcion ${GLOSA} faltaba (replica recargada): se sembro de nuevo`);
    } catch (e) {
      this.log.warn(`No se pudo asegurar la funcion ${GLOSA}: ${(e as Error).message}`);
    }
  }
}
