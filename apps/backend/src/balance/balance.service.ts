/**
 * BALANCE_CCOSTO: presupuesto contra gasto real por centro de costo.
 *
 * El gasto no vive en una tabla: es la union de varios origenes, tal como
 * $Q_DETALLE_DOCS_GASTO en init.php. Se replican estos:
 *
 *   RECIBIDOS   facturas de proveedor (docs_recibidos + detalle)
 *   RIN_GASTO   rendiciones de gastos
 *   MOV_BODEGA  acumulado de vehiculos y equipos (tmp_vhe_acum)
 *   INV_BODEGA  consumo de material (mov_bodega)
 *
 * Falta a proposito el quinto, RRHH (rrhh_costos), porque el modulo de
 * Personal quedo fuera de la replica. Su aporte es cero y se informa como
 * tal en vez de esconderlo.
 *
 * Dos reglas que no son obvias y que importan:
 *  - Las facturas con hijos de distribucion vigentes se EXCLUYEN. Si no, se
 *    contarian el padre y los hijos, duplicando el gasto.
 *  - El signo se invierte segun el documento: una nota de credito ('61')
 *    resta, y en bodega una salida resta mientras una entrada suma.
 */
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface RangoDto { fini: string; ffin: string; ccosto?: string; responsable?: number; }

/** Origenes que la replica sabe calcular, y el que falta. */
export const ORIGENES = ['RECIBIDOS', 'RIN_GASTO', 'MOV_BODEGA', 'INV_BODEGA'];
export const ORIGENES_FUERA = ['RRHH'];

@Injectable()
export class BalanceService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * El detalle del gasto, como UNION de los origenes.
   * $1 = fecha inicial, $2 = fecha final, $3 = ccosto o null.
   */
  private get sqlDetalle(): string {
    return `
      -- Facturas de proveedor. Se excluyen las ya distribuidas: sus hijos D_33
      -- estan en este mismo conjunto y contarlas dos veces duplica el gasto.
      SELECT 'RECIBIDOS' AS origen, r.fecha::date AS fecha, d.numdoc,
             d.tipo_doc::text AS tipo_doc,
             ROUND(CASE WHEN r.tipo_doc::text IN ('D_33','33','34','39','99')
                        THEN d.total ELSE d.total * -1 END) AS total,
             d.ccosto, d.ccosto_ap,
             concat_ws(' - ', a.glosa, b.glosa, c.glosa) AS glosa,
             d.cliente::text AS cod_cliente, coalesce(p.nombre,'') AS nombre
      FROM docs_recibidos r
      JOIN docs_recibidos_detalle d
        ON d.numdoc = r.numdoc AND d.tipo_doc::text = r.tipo_doc::text AND d.cliente = r.cliente
      LEFT JOIN categorias c ON c.codigo = d.ccosto_ap
      LEFT JOIN categorias b ON c.padre = b.id
      LEFT JOIN categorias a ON b.padre = a.id
      LEFT JOIN data_clientes p ON p.codigo = r.cliente
      WHERE r.tipo_doc::text IN ('D_33','33','34','39','61','99')
        AND r.fecha::date BETWEEN $1::date AND $2::date
        AND coalesce(r.ccosto,'') NOT IN ('','0')
        AND coalesce(d.ccosto,'') <> '0' AND coalesce(d.ccosto_ap,'') <> '0'
        AND r.estado::text NOT IN ('RECHAZADO','ANULADO')
        AND NOT EXISTS (
          SELECT 1 FROM docs_recibidos hd
          WHERE hd.tipo_doc::text = 'D_33' AND hd.ref_num = r.numdoc
            AND hd.ref_tipo::text = r.tipo_doc::text AND hd.cliente = r.cliente
            AND hd.estado::text <> 'ANULADO')
        AND ($3::text IS NULL OR d.ccosto = $3::text)

      UNION ALL

      -- Rendiciones. Se saltan las que son factura (33/34): esas ya entraron arriba.
      SELECT 'RIN_GASTO', d.fecha_gasto::date, d.numdoc, d.cod_tipo_doc::text,
             ROUND(d.total), d.ccosto, d.ccosto_ap,
             coalesce(d.descripcion,''), coalesce(d.rut_proveedor,''), coalesce(p.nombre,'')
      FROM rinde_gastos d
      LEFT JOIN data_clientes p ON p.rut = d.rut_proveedor
      WHERE d.fecha_gasto::date BETWEEN $1::date AND $2::date
        AND coalesce(d.cod_tipo_doc,'') NOT IN ('33','34')
        AND coalesce(d.ccosto,'') NOT IN ('','0')
        AND ($3::text IS NULL OR d.ccosto = $3::text)

      UNION ALL

      -- Acumulado de vehiculos y equipos, que viene por periodo (AAAAMM).
      SELECT 'MOV_BODEGA',
             to_date(d.periodo || '01', 'YYYYMMDD'), 0, d."tipo_Vhe"::text,
             ROUND(d.cost), d.ccosto, d.ccosto_ap,
             concat_ws(' - ', d.gl_1, d.gl_2), coalesce(d."id_Vhe",''),
             coalesce(v.tipo::text, h."Nom_equipo", '')
      FROM tmp_vhe_acum d
      LEFT JOIN herramientas h ON h."Cod_equipo" = d."id_Vhe"
      LEFT JOIN vehiculos v ON v.patente = d."id_Vhe"
      WHERE d.periodo::text BETWEEN to_char($1::date,'YYYYMM') AND to_char($2::date,'YYYYMM')
        AND coalesce(d.ccosto,'') NOT IN ('','0')
        AND ($3::text IS NULL OR d.ccosto = $3::text)

      UNION ALL

      -- Consumo de material: la entrada suma y la salida resta.
      SELECT 'INV_BODEGA', d.fecha::date, d.numdoc, d.tipo_mov::text,
             CASE WHEN d.tipo_mov::text = 'IN' THEN ROUND(d.cantidad * d.tarifa)
                  ELSE -ROUND(d.cantidad * d.tarifa) END,
             d.ccosto, d.ccosto_ap,
             concat_ws(' - ', coalesce(c.glosa,'Sin Cat.'), d.id_vhe), '0',
             coalesce(b.descr,'')
      FROM mov_bodega d
      LEFT JOIN categorias c ON c.codigo = d.ccosto_ap
      LEFT JOIN bodega b ON b.bodega::text = d.id_bodega::text
      WHERE d.tipo_vhe::text = 'Material'
        AND d.fecha::date BETWEEN $1::date AND $2::date
        AND coalesce(d.ccosto,'') <> '' AND coalesce(d.ccosto_ap,'') <> ''
        AND ($3::text IS NULL OR d.ccosto = $3::text)
    `;
  }

  /** Centros de costo vigentes, con su presupuesto. */
  async centrosCosto(soloVigentes = true) {
    return this.db.query(
      `SELECT c.ccosto, c.cliente, c.proyecto, c.fini, c.ffin, c.estado,
              c.presupuesto, c.presupuesto_neto, c.id_responsable,
              coalesce(u.usr_nombre,'') AS responsable
       FROM centro_costo c
       LEFT JOIN usuarios u ON u.usr_id = c.id_responsable
       ${soloVigentes ? "WHERE c.estado::text = 'VIGENTE'" : ''}
       ORDER BY c.ccosto`,
    );
  }

  /** Presupuesto contra gasto, un renglon por centro de costo. */
  async resumen(q: RangoDto) {
    const filas = await this.db.query(
      `WITH gasto AS (${this.sqlDetalle})
       SELECT c.ccosto, c.proyecto, c.estado,
              c.presupuesto, c.presupuesto_neto,
              coalesce(u.usr_nombre,'') AS responsable,
              coalesce(SUM(g.total), 0)::numeric AS gasto,
              COUNT(g.total)::int AS movimientos
       FROM centro_costo c
       LEFT JOIN usuarios u ON u.usr_id = c.id_responsable
       LEFT JOIN gasto g ON g.ccosto = c.ccosto
       ${q.ccosto ? 'WHERE c.ccosto = $3::text' : ''}
       GROUP BY c.ccosto, c.proyecto, c.estado, c.presupuesto,
                c.presupuesto_neto, u.usr_nombre
       HAVING coalesce(SUM(g.total),0) <> 0 OR c.presupuesto <> 0
       ORDER BY c.ccosto`,
      [q.fini, q.ffin, q.ccosto ?? null],
    );
    return {
      desde: q.fini, hasta: q.ffin,
      origenes: ORIGENES, origenesFuera: ORIGENES_FUERA,
      filas,
    };
  }

  /** Gasto agrupado por categoria contable, dentro del rango. */
  async porCategoria(q: RangoDto) {
    return this.db.query(
      `WITH gasto AS (${this.sqlDetalle})
       SELECT g.ccosto_ap,
              coalesce(max(g.glosa), g.ccosto_ap) AS glosa,
              SUM(g.total)::numeric AS total,
              COUNT(*)::int AS movimientos
       FROM gasto g
       GROUP BY g.ccosto_ap
       ORDER BY SUM(g.total) DESC`,
      [q.fini, q.ffin, q.ccosto ?? null],
    );
  }

  /** Aporte de cada origen, para ver de donde sale el gasto. */
  async porOrigen(q: RangoDto) {
    const filas = await this.db.query(
      `WITH gasto AS (${this.sqlDetalle})
       SELECT g.origen, SUM(g.total)::numeric AS total, COUNT(*)::int AS movimientos
       FROM gasto g GROUP BY g.origen ORDER BY g.origen`,
      [q.fini, q.ffin, q.ccosto ?? null],
    );
    // El origen excluido se informa explicitamente, con aporte cero.
    for (const o of ORIGENES_FUERA) {
      filas.push({ origen: o, total: '0', movimientos: 0, excluido: true });
    }
    return filas;
  }

  /** El detalle documento por documento. */
  async detalle(q: RangoDto & { pagina?: number; limite?: number }) {
    const limite = Math.min(Math.max(q.limite ?? 100, 1), 500);
    const pagina = Math.max(q.pagina ?? 1, 1);

    const [{ n }] = await this.db.query(
      `WITH gasto AS (${this.sqlDetalle}) SELECT COUNT(*)::int n FROM gasto`,
      [q.fini, q.ffin, q.ccosto ?? null],
    );
    const datos = await this.db.query(
      `WITH gasto AS (${this.sqlDetalle})
       SELECT * FROM gasto ORDER BY fecha, origen, numdoc
       LIMIT $4 OFFSET $5`,
      [q.fini, q.ffin, q.ccosto ?? null, limite, (pagina - 1) * limite],
    );
    return { datos, total: n, pagina, paginas: Math.max(Math.ceil(n / limite), 1) };
  }
}
