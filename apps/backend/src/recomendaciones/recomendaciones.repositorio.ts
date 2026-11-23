import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { Decision, Modo } from './recomendaciones.dto';

/** Maximo de materiales por consulta: igual que el listado de stock (LIMIT 500) y el tope de FastAPI. */
export const MAX_MATERIALES = 500;
const DIAS_CONSUMO = 365;
const DIAS_RECIENTE = 30;

export interface MaterialBodega {
  cod_material: string;
  nombre: string | null;
  stock: number | null;
  stock_minimo: number;
  /** Salidas de los ultimos 365 dias / 365. */
  consumo_diario: number;
  /** Salidas de los ultimos 30 dias / 30. */
  consumo_reciente: number;
  /** materiales.tarifa; null si es 0 o menos. */
  ultimo_precio: number | null;
}

export interface PrecioExterno { cod_material: string; precio: number; verificado_en: Date }

export interface MetaLote { idBodega: number; modo: Modo; degradado: boolean; generadoEn: Date; idUsuario: number }

export interface RazonGuardada { factor: string; valor: number; peso: number; texto: string }

export interface FilaRecomendacion {
  codMaterial: string;
  puntaje: number | null;
  posicion: number;
  posicionBase: number;
  cantidadSugerida: number;
  razones: RazonGuardada[];
  factoresFaltantes: string[];
}

export interface RecomendacionGuardada { id: number; cod_material: string; puntaje: number | null; modo: Modo }

export interface DatosDecision {
  recomendacionId: number;
  idUsuario: number;
  codMaterial: string;
  decision: Decision;
  cantidad: number | null;
  motivo: string | null;
  puntaje: number | null;
  modo: Modo;
}

const numero = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

@Injectable()
export class RecomendacionesRepositorio {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Materiales de una bodega con lo que alimenta la regla: mismo origen y mismo consumo diario que
   * BodegaService.stock, mas el consumo de los ultimos 30 dias. Orden por cod_material (desempate de la regla base).
   */
  async materiales(bodega: number): Promise<MaterialBodega[]> {
    const filas = await this.ds.query(
      `SELECT v.cod_material, v.nombre, v.stock, coalesce(m.stock_minimo, 0) AS stock_minimo,
              round(coalesce(c.salidas, 0) / ${DIAS_CONSUMO}.0, 3) AS consumo_diario,
              round(coalesce(c.salidas_recientes, 0) / ${DIAS_RECIENTE}.0, 3) AS consumo_reciente,
              CASE WHEN m.tarifa > 0 THEN m.tarifa END AS ultimo_precio
         FROM v_materiales_x_bodega v
         LEFT JOIN materiales m ON m.cod_material = v.cod_material
         LEFT JOIN (
           SELECT id_bodega, id_vhe, sum(cantidad) AS salidas,
                  sum(cantidad) FILTER (WHERE fecha >= current_date - ${DIAS_RECIENTE}) AS salidas_recientes
             FROM mov_bodega
            WHERE tipo_vhe::text = 'Material' AND tipo_mov::text = 'OUT'
              AND fecha >= current_date - ${DIAS_CONSUMO}
            GROUP BY id_bodega, id_vhe
         ) c ON c.id_bodega::text = v.id_bodega::text AND c.id_vhe = v.cod_material::text
        WHERE v.id_bodega = $1
        ORDER BY v.cod_material
        LIMIT ${MAX_MATERIALES}`,
      [bodega],
    );
    return filas.map((f: Record<string, unknown>) => ({
      cod_material: String(f.cod_material),
      nombre: (f.nombre as string | null) ?? null,
      stock: numero(f.stock),
      stock_minimo: Number(f.stock_minimo ?? 0),
      consumo_diario: Number(f.consumo_diario ?? 0),
      consumo_reciente: Number(f.consumo_reciente ?? 0),
      ultimo_precio: numero(f.ultimo_precio),
    }));
  }

  /**
   * Mejor precio externo por material, en una sola consulta (sin N+1): el menor
   * coalesce(precio_oferta, precio_normal) entre la ultima observacion de cada publicacion activa
   * vinculada y no rechazada (misma regla que PreciosRepositorio.ultimasObservaciones), con su verificado_en.
   * La antiguedad la juzga el motor (7 dias desde la referencia).
   */
  async mejoresPreciosExternos(codigos: string[]): Promise<PrecioExterno[]> {
    if (!codigos.length) return [];
    const filas = await this.ds.query(
      `SELECT DISTINCT ON (u.cod_material) u.cod_material, u.precio, u.verificado_en
         FROM (
           SELECT DISTINCT ON (v.cod_material, p.id)
                  v.cod_material, coalesce(o.precio_oferta, o.precio_normal) AS precio, o.verificado_en
             FROM precios_externos.vinculo_material v
             JOIN precios_externos.publicacion p ON p.id = v.publicacion_id AND p.activa
             JOIN precios_externos.observacion_precio o ON o.publicacion_id = p.id
            WHERE v.cod_material = ANY($1::text[]) AND v.estado <> 'rechazado'
            ORDER BY v.cod_material, p.id, o.obtenido_en DESC, o.id DESC
         ) u
        ORDER BY u.cod_material, u.precio ASC, u.verificado_en DESC`,
      [codigos],
    );
    return filas.map((f: Record<string, unknown>) => ({
      cod_material: String(f.cod_material),
      precio: Number(f.precio),
      verificado_en: new Date(f.verificado_en as string | Date),
    }));
  }

  /** Guarda todos los items de una respuesta en una sentencia; devuelve el id de cada posicion. */
  async guardaLote(meta: MetaLote, filas: FilaRecomendacion[]): Promise<Array<{ id: number; posicion: number }>> {
    const datos = filas.map((f) => ({
      cod_material: f.codMaterial, puntaje: f.puntaje, posicion: f.posicion, posicion_base: f.posicionBase,
      cantidad_sugerida: f.cantidadSugerida, razones: f.razones, factores_faltantes: f.factoresFaltantes,
    }));
    const guardadas = await this.ds.query(
      `INSERT INTO recomendaciones.recomendacion
         (id_bodega, cod_material, modo, degradado, puntaje, posicion, posicion_base, cantidad_sugerida,
          razones, factores_faltantes, generado_en, id_usuario)
       SELECT $1::integer, x.cod_material, $2::text, $3::boolean, x.puntaje, x.posicion, x.posicion_base, x.cantidad_sugerida,
              x.razones, x.factores_faltantes, $4::timestamptz, $5::integer
         FROM jsonb_to_recordset($6::jsonb) AS x(
           cod_material text, puntaje numeric, posicion integer, posicion_base integer,
           cantidad_sugerida integer, razones jsonb, factores_faltantes jsonb)
       RETURNING id, posicion`,
      [meta.idBodega, meta.modo, meta.degradado, meta.generadoEn, meta.idUsuario, JSON.stringify(datos)],
    );
    return guardadas.map((g: { id: number; posicion: number }) => ({ id: Number(g.id), posicion: Number(g.posicion) }));
  }

  async recomendacion(id: number): Promise<RecomendacionGuardada | null> {
    const [fila] = await this.ds.query(
      `SELECT id, cod_material, puntaje, modo FROM recomendaciones.recomendacion WHERE id = $1`, [id],
    );
    return fila
      ? { id: Number(fila.id), cod_material: fila.cod_material, puntaje: numero(fila.puntaje), modo: fila.modo }
      : null;
  }

  async guardaDecision(d: DatosDecision): Promise<{ id: number }> {
    const [fila] = await this.ds.query(
      `INSERT INTO recomendaciones.recomendacion_decision
         (recomendacion_id, id_usuario, cod_material, decision, cantidad, motivo, puntaje, modo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [d.recomendacionId, d.idUsuario, d.codMaterial, d.decision, d.cantidad, d.motivo, d.puntaje, d.modo],
    );
    return { id: Number(fila.id) };
  }
}
