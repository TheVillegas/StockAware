/**
 * DOC_DISTRIBUIR: reparte una factura entre centros de costo.
 *
 * Traduccion de ING_DISTR_FACTURA y DEL_DISTR_FACTURA de DLL.php.
 *
 * Como funciona en el ERP, y se replica igual:
 *  - Distribuir NO modifica la factura: crea documentos HIJOS tipo 'D_33' en
 *    docs_recibidos, uno por cada centro de costo, copiando el encabezado del
 *    padre y apuntando a el con ref_num / ref_tipo / ref_fecha.
 *  - El padre queda en estado DISTRIBUIDO.
 *  - Es un ACTO UNICO: si ya tiene hijos no anulados, se rechaza. Para
 *    cambiar el reparto hay que deshacerlo primero.
 *  - Deshacer ANULA los hijos (no los borra) y devuelve el padre a ACEPTADO.
 *  - El IVA de cada hijo se prorratea proporcional al neto, y solo en las
 *    facturas afectas (tipo_doc = '33'). Las exentas van con IVA cero.
 *  - Tanto al distribuir como al deshacer se exige que el UPDATE del padre
 *    afecte exactamente una fila: si otro cambio el estado en el medio, se
 *    aborta todo.
 */
import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { AuditoriaService } from '../comun/auditoria.service';

interface Ctx { usuario: string; ip: string; }

export interface LineaDistribucionDto {
  /** id de la linea de docs_recibidos_detalle del padre. */
  id_detalle: number;
  ccosto: string;
  neto: number;
  /** 'SI' deja la linea sin IVA aunque la factura sea afecta. */
  exento?: 'SI' | 'NO';
}
export interface DistribuirDto { lineas: LineaDistribucionDto[]; }

const num = (v: unknown): number => Number(v ?? 0);
/** Redondeo a N decimales, como mround() del ERP. */
const redondea = (v: number, dec: number): number => {
  const f = Math.pow(10, dec);
  return Math.round(v * f) / f;
};

@Injectable()
export class DistribucionService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  private async proximoNumero(em: EntityManager, nombre: string): Promise<number> {
    const bruto = await em.query(
      `UPDATE parametros SET valor = valor + 1 WHERE nombre = $1 RETURNING valor`, [nombre],
    );
    const filas = Array.isArray(bruto?.[0]) ? bruto[0] : bruto;
    const valor = filas?.[0]?.valor;
    if (valor === undefined || valor === null) {
      throw new ConflictException(`No existe el contador "${nombre}" en parametros`);
    }
    return Math.round(Number(valor));
  }

  // ---------------------------------------------------------------- consulta

  /** Facturas recibidas, con cuantos hijos de distribucion tiene cada una. */
  async listar(q: { pagina?: number; limite?: number; estado?: string; buscar?: string }) {
    const limite = Math.min(Math.max(q.limite ?? 50, 1), 200);
    const pagina = Math.max(q.pagina ?? 1, 1);

    // Los hijos D_33 no se listan como facturas: son el resultado, no el origen.
    const cond: string[] = [`d.tipo_doc::text <> 'D_33'`];
    const par: unknown[] = [];
    if (q.estado) { par.push(q.estado); cond.push(`d.estado::text = $${par.length}`); }
    if (q.buscar?.trim()) {
      par.push(`%${q.buscar.trim().toLowerCase()}%`);
      const i = par.length;
      cond.push(`(d.numdoc::text LIKE $${i} OR lower(coalesce(c.nombre,'')) LIKE $${i}
                  OR lower(coalesce(d.rut,'')) LIKE $${i})`);
    }
    const where = `WHERE ${cond.join(' AND ')}`;

    const [{ n }] = await this.db.query(
      `SELECT COUNT(*)::int n FROM docs_recibidos d
       LEFT JOIN data_clientes c ON c.codigo = d.cliente ${where}`, par,
    );
    const datos = await this.db.query(
      `SELECT d.id, d.numdoc, d.tipo_doc, d.fecha, d.cliente, d.rut, d.estado,
              d.neto, d.iva, d.total, d.ccosto, coalesce(c.nombre,'') AS proveedor,
              (SELECT COUNT(*)::int FROM docs_recibidos h
                WHERE h.tipo_doc::text = 'D_33' AND h.ref_num = d.numdoc
                  AND h.ref_tipo::text = d.tipo_doc::text AND h.cliente = d.cliente
                  AND h.estado::text <> 'ANULADO') AS hijos
       FROM docs_recibidos d
       LEFT JOIN data_clientes c ON c.codigo = d.cliente
       ${where} ORDER BY d.numdoc DESC LIMIT $${par.length + 1} OFFSET $${par.length + 2}`,
      [...par, limite, (pagina - 1) * limite],
    );
    return { datos, total: n, pagina, paginas: Math.max(Math.ceil(n / limite), 1) };
  }

  async obtener(id: number) {
    const [doc] = await this.db.query(
      `SELECT d.*, coalesce(c.nombre,'') AS proveedor
       FROM docs_recibidos d LEFT JOIN data_clientes c ON c.codigo = d.cliente
       WHERE d.id = $1`, [id],
    );
    if (!doc) throw new NotFoundException(`No existe el documento ${id}`);

    const detalle = await this.db.query(
      `SELECT * FROM docs_recibidos_detalle
       WHERE numdoc = $1 AND tipo_doc::text = $2 AND cliente = $3 ORDER BY id`,
      [doc.numdoc, doc.tipo_doc, doc.cliente],
    );
    const hijos = await this.db.query(
      `SELECT id, numdoc, ccosto, neto, iva, total, estado, usuario, fecha
       FROM docs_recibidos
       WHERE tipo_doc::text = 'D_33' AND ref_num = $1
         AND ref_tipo::text = $2 AND cliente = $3 ORDER BY numdoc`,
      [doc.numdoc, doc.tipo_doc, doc.cliente],
    );
    return { ...doc, detalle, hijos };
  }

  // ------------------------------------------------------------- distribuir

  async distribuir(id: number, dto: DistribuirDto, ctx: Ctx) {
    if (!dto.lineas?.length) throw new BadRequestException('No hay lineas que distribuir');

    const [doc] = await this.db.query(
      `SELECT id, numdoc, tipo_doc, cliente, estado, neto, iva, impto_adic
       FROM docs_recibidos WHERE id = $1`, [id],
    );
    if (!doc) throw new NotFoundException(`No se encontro el documento a distribuir (id ${id})`);

    if (String(doc.estado) !== 'ACEPTADO') {
      throw new ConflictException(
        `Solo se puede distribuir una factura en estado ACEPTADO, y esta esta en ` +
        `${doc.estado}. Si tiene un pago en curso, primero hay que eliminarlo.`,
      );
    }

    const [{ n: yaHijos }] = await this.db.query(
      `SELECT COUNT(*)::int n FROM docs_recibidos
       WHERE tipo_doc::text = 'D_33' AND ref_num = $1 AND ref_tipo::text = $2
         AND cliente = $3 AND estado::text <> 'ANULADO'`,
      [doc.numdoc, doc.tipo_doc, doc.cliente],
    );
    if (yaHijos > 0) {
      throw new ConflictException(
        `Esta factura ya fue distribuida en ${yaHijos} documento(s). La distribucion es ` +
        `un acto unico: para cambiar el reparto hay que deshacer la anterior.`,
      );
    }

    const netoPadre = num(doc.neto);
    const sumaNeto = dto.lineas.reduce((s, l) => s + num(l.neto), 0);
    if (redondea(sumaNeto, 2) > redondea(netoPadre, 2)) {
      throw new BadRequestException(
        `La suma repartida (${sumaNeto}) supera el neto de la factura (${netoPadre})`,
      );
    }

    const esAfecta = String(doc.tipo_doc) === '33';

    const creados = await this.db.transaction(async (em) => {
      const numeros: number[] = [];
      for (const l of dto.lineas) {
        const neto = num(l.neto);
        if (neto <= 0) continue;

        // IVA proporcional al neto, y solo si la factura es afecta.
        let iva = 0;
        let total = neto;
        if (esAfecta) {
          if ((l.exento ?? 'NO') === 'NO' && netoPadre) {
            iva = redondea(num(doc.iva) * (neto / netoPadre), 2);
          }
          total = redondea(neto + iva, 0);
        }
        const imptoAdic = num(doc.impto_adic)
          ? redondea(num(doc.impto_adic) * (neto / (netoPadre || 1)), 2) : 0;

        const numdoc = await this.proximoNumero(em, 'NUM_DOC_DISTRIBUCION');

        await em.query(
          `INSERT INTO docs_recibidos
             (numdoc, tipo_doc, fecha, fecha_ing, cliente, rut, tipo_cli, estado, "FrmPago",
              total, neto, iva, impto_adic, tipo_impto,
              ref_num, ref_tipo, ref_fecha, "OC", "OC_fecha", "HES", "HES_fecha",
              tipo_moneda, tipo_cambio, fecha_moneda, ccosto, usuario, obs)
           SELECT $1, 'D_33', fecha, fecha_ing, cliente, rut, tipo_cli, 'ACEPTADO', "FrmPago",
                  $2::numeric, $3::numeric, $4::numeric, $5::numeric, tipo_impto,
                  numdoc, tipo_doc::text, fecha, "OC", "OC_fecha", "HES", "HES_fecha",
                  tipo_moneda, tipo_cambio, fecha_moneda, $6, $7, obs
           FROM docs_recibidos WHERE id = $8`,
          [numdoc, total, neto, iva, imptoAdic, l.ccosto, ctx.usuario, id],
        );

        await em.query(
          `INSERT INTO docs_recibidos_detalle
             (numdoc, tipo_doc, cliente, producto, cantidad, unidad, precio_uni,
              impto_adic, "IndExe", total, "OC_avance", nombre, descripcion, ccosto, ccosto_ap)
           SELECT $1, 'D_33', cliente, producto, 1, unidad, $2::numeric,
                  $3::numeric, "IndExe", $2::numeric, "OC_avance", nombre, descripcion, $4, ccosto_ap
           FROM docs_recibidos_detalle WHERE id = $5`,
          [numdoc, neto, imptoAdic, l.ccosto, l.id_detalle],
        );
        numeros.push(numdoc);
      }

      if (!numeros.length) {
        throw new BadRequestException('Ninguna linea tenia un monto mayor que cero');
      }

      // Cierre optimista: si otro toco la factura mientras tanto, no se hace nada.
      const r = await em.query(
        `UPDATE docs_recibidos SET estado = 'DISTRIBUIDO'
         WHERE id = $1 AND estado::text = 'ACEPTADO'`, [id],
      );
      const afectadas = Array.isArray(r) && typeof r[1] === 'number' ? r[1] : 1;
      if (afectadas !== 1) {
        throw new ConflictException(
          `La factura cambio de estado mientras se distribuia ` +
          `(se afectaron ${afectadas} filas en vez de 1). No se distribuyo nada.`,
        );
      }
      return numeros;
    });

    await this.auditoria.anotar({
      usuario: ctx.usuario, tipo_accion: 'INS_REG',
      tabla_accion: 'ING_DOC_DISTRIBUCION', id_registro: doc.numdoc,
      inf_1: String(doc.tipo_doc), inf_2: `${creados.length} hijos: ${creados.join(',')}`,
      IP: ctx.ip,
    });
    return {
      mensaje: `Factura ${doc.numdoc} distribuida en ${creados.length} documento(s)`,
      numeros: creados,
    };
  }

  // ---------------------------------------------------------------- deshacer

  async deshacer(id: number, ctx: Ctx) {
    const [doc] = await this.db.query(
      `SELECT id, numdoc, tipo_doc, cliente, estado FROM docs_recibidos WHERE id = $1`, [id],
    );
    if (!doc) throw new NotFoundException(`No existe el documento ${id}`);

    const [{ n: hijos }] = await this.db.query(
      `SELECT COUNT(*)::int n FROM docs_recibidos
       WHERE tipo_doc::text = 'D_33' AND ref_num = $1 AND ref_tipo::text = $2
         AND cliente = $3 AND estado::text <> 'ANULADO'`,
      [doc.numdoc, doc.tipo_doc, doc.cliente],
    );
    if (hijos < 1) {
      throw new ConflictException('Esta factura no tiene una distribucion vigente que deshacer');
    }

    await this.db.transaction(async (em) => {
      // Los hijos se ANULAN, no se borran: queda la traza del reparto anterior.
      await em.query(
        `UPDATE docs_recibidos SET estado = 'ANULADO'
         WHERE tipo_doc::text = 'D_33' AND ref_num = $1 AND ref_tipo::text = $2
           AND cliente = $3 AND estado::text <> 'ANULADO'`,
        [doc.numdoc, doc.tipo_doc, doc.cliente],
      );

      if (String(doc.estado) === 'DISTRIBUIDO') {
        const r = await em.query(
          `UPDATE docs_recibidos SET estado = 'ACEPTADO'
           WHERE id = $1 AND estado::text = 'DISTRIBUIDO'`, [id],
        );
        const afectadas = Array.isArray(r) && typeof r[1] === 'number' ? r[1] : 1;
        if (afectadas !== 1) {
          throw new ConflictException(
            'La factura cambio de estado mientras se deshacia la distribucion. No se deshizo nada.',
          );
        }
      }
    });

    await this.auditoria.anotar({
      usuario: ctx.usuario, tipo_accion: 'DEL_REG',
      tabla_accion: 'DEL_DOC_DISTRIBUCION', id_registro: doc.numdoc,
      inf_1: String(doc.tipo_doc), inf_2: `${hijos} hijos anulados`, IP: ctx.ip,
    });
    return { mensaje: `Distribucion deshecha: ${hijos} documento(s) anulados` };
  }
}
