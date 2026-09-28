/**
 * Ciclo de compras: OC -> HES.
 *
 * Traduccion de los casos ING_DOC_EMI, APRUEBA_OC, ANULA_OC, EMISION_HES y
 * ELIMINA_HES de DLL.php. Las reglas que importan y que NO son obvias:
 *
 *  - El avance de cada LINEA es un porcentaje; el del ENCABEZADO es ponderado
 *    por plata: round((suma de montos avanzados / neto de la OC) * 100, 4).
 *    No es el promedio de las lineas.
 *  - ANULA_OC deja estado 'ELIMINADO', no 'ANULADO', y solo si ningun HES,
 *    factura o pago referencia la OC.
 *  - La OC acumula sus HES en una columna de texto: "8001:8002:8003".
 *  - ELIMINA_HES borra fisicamente, revierte con GREATEST(x - y, 0), y esta
 *    bloqueado si la HES ya se cargo a bodega (HES = 'MF').
 *  - Para revertir, la linea de la HES se aparea con la de la OC por clave
 *    natural (producto, nombre, precio_uni, unidad, descto), no por id.
 *
 * tipo_doc: 801 = OC afecta, 999 = OC exenta, HES = recepcion.
 */
import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { AuditoriaService } from '../comun/auditoria.service';

export const TIPOS_OC = ['801', '999'];

export interface LineaOcDto {
  producto: number;
  nombre: string;
  descripcion?: string;
  cantidad: number;
  unidad: string;
  precio_uni: number;
  descto?: number;
  total: number;
  ccosto?: string;
  ccosto_ap?: string;
}

export interface CrearOcDto {
  tipo_doc: string;
  cliente: number;
  rut: string;
  fecha: string;
  ccosto?: string;
  bodega?: number;
  obs?: string;
  tipo_moneda?: string;
  tipo_cambio?: number;
  lineas: LineaOcDto[];
}

/** Una linea de la OC con la cantidad y el monto que esta HES recibe. */
export interface LineaHesDto {
  /** id de la linea de docs_emitidos_detalle de la OC. */
  id_linea: number;
  cantidad: number;
  /** Porcentaje que avanza esta linea. */
  avance: number;
  /** Monto avanzado de esta linea. */
  monto: number;
  comentario?: string;
  ccosto_ap?: string;
}

export interface EmitirHesDto {
  id_OC: number;
  fecha: string;
  neto: number;
  iva: number;
  total: number;
  obs?: string;
  lineas: LineaHesDto[];
}

interface Ctx { usuario: string; ip: string; }

@Injectable()
export class ComprasService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Numeracion, igual que Proximo_Valor() de E_funciones.php: el contador vive
   * en la tabla parametros y se incrementa antes de leerse.
   */
  private async proximoNumero(em: EntityManager, nombre: string): Promise<number> {
    const bruto = await em.query(
      `UPDATE parametros SET valor = valor + 1 WHERE nombre = $1 RETURNING valor`, [nombre],
    );
    // TypeORM devuelve UPDATE ... RETURNING como [filas, cantidad], no como un
    // arreglo plano de filas. Se aceptan las dos formas.
    const filas = Array.isArray(bruto?.[0]) ? bruto[0] : bruto;
    const valor = filas?.[0]?.valor;
    if (valor === undefined || valor === null) {
      throw new ConflictException(`No existe el contador "${nombre}" en parametros`);
    }
    return Math.round(Number(valor));
  }

  // ---------------------------------------------------------------- consulta

  async listarOc(q: { pagina?: number; limite?: number; estado?: string; buscar?: string }) {
    const limite = Math.min(Math.max(q.limite ?? 50, 1), 200);
    const pagina = Math.max(q.pagina ?? 1, 1);
    const cond: string[] = [`d.tipo_doc = ANY($1)`];
    const par: unknown[] = [TIPOS_OC];

    if (q.estado) { par.push(q.estado); cond.push(`d.estado::text = $${par.length}`); }
    if (q.buscar?.trim()) {
      par.push(`%${q.buscar.trim().toLowerCase()}%`);
      const i = par.length;
      cond.push(`(d.numdoc::text LIKE $${i} OR lower(coalesce(c.nombre,'')) LIKE $${i}
                  OR lower(coalesce(d.rut,'')) LIKE $${i})`);
    }
    const where = `WHERE ${cond.join(' AND ')}`;

    const [{ n }] = await this.db.query(
      `SELECT COUNT(*)::int n FROM docs_emitidos d
       LEFT JOIN data_clientes c ON c.codigo = d.cliente ${where}`, par,
    );
    const datos = await this.db.query(
      `SELECT d.id, d.numdoc, d.tipo_doc, d.fecha, d.cliente, d.rut, d.estado,
              d.neto, d.iva, d.total, d."OC_avance", d."HES", d.ccosto, d.obs, d.usuario,
              coalesce(c.nombre,'') AS proveedor
       FROM docs_emitidos d
       LEFT JOIN data_clientes c ON c.codigo = d.cliente
       ${where} ORDER BY d.numdoc DESC LIMIT $${par.length + 1} OFFSET $${par.length + 2}`,
      [...par, limite, (pagina - 1) * limite],
    );
    return { datos, total: n, pagina, paginas: Math.max(Math.ceil(n / limite), 1) };
  }

  async obtenerOc(id: number) {
    const [oc] = await this.db.query(
      `SELECT d.*, coalesce(c.nombre,'') AS proveedor
       FROM docs_emitidos d LEFT JOIN data_clientes c ON c.codigo = d.cliente
       WHERE d.id = $1 AND d.tipo_doc = ANY($2)`, [id, TIPOS_OC],
    );
    if (!oc) throw new NotFoundException(`No existe la OC ${id}`);
    const detalle = await this.db.query(
      `SELECT * FROM docs_emitidos_detalle
       WHERE numdoc = $1 AND tipo_doc = ANY($2) AND cliente = $3 ORDER BY id`,
      [oc.numdoc, TIPOS_OC, oc.cliente],
    );
    return { ...oc, detalle };
  }

  /** Las HES emitidas contra una OC. */
  async hesDeOc(numdoc: number) {
    return this.db.query(
      `SELECT id, numdoc, fecha, estado, neto, iva, total, "OC_avance", "HES", obs, usuario
       FROM docs_emitidos WHERE tipo_doc = 'HES' AND "OC" = $1 ORDER BY numdoc`,
      [String(numdoc)],
    );
  }

  // ------------------------------------------------------------------- OC

  async crearOc(dto: CrearOcDto, ctx: Ctx) {
    if (!dto.lineas?.length) throw new BadRequestException('La OC no tiene lineas');
    if (!TIPOS_OC.includes(dto.tipo_doc)) {
      throw new BadRequestException(`tipo_doc invalido: ${dto.tipo_doc}`);
    }

    const neto = dto.lineas.reduce((s, l) => s + Number(l.total), 0);
    const [{ valor: tasaIva }] = await this.db.query(
      `SELECT valor FROM parametros WHERE nombre = 'IVA'`,
    );
    const iva = dto.tipo_doc === '999' ? 0 : Math.round(neto * Number(tasaIva));

    const numdoc = await this.db.transaction(async (em) => {
      const num = await this.proximoNumero(em, 'ORDEN_COMPRA');
      await em.query(
        `INSERT INTO docs_emitidos
           (numdoc, tipo_doc, fecha, cliente, rut, tipo_cli, estado, neto, iva, total,
            "OC", "OC_fecha", "OC_avance", "HES", ccosto, bodega, obs,
            tipo_moneda, tipo_cambio, usuario, contacto, dir_retiro, factura)
         VALUES ($1,$2,$3::date,$4,$5,'PROVEEDOR','PENDIENTE',$6,$7,$8,
                 $9,$3::date,0,'',$10,$11,$12,$13,$14,$15,'','',0)`,
        [num, dto.tipo_doc, dto.fecha, dto.cliente, dto.rut, neto, iva, neto + iva,
          String(num), dto.ccosto ?? '', dto.bodega ?? 0, dto.obs ?? '',
          dto.tipo_moneda ?? 'CLP', dto.tipo_cambio ?? 1, ctx.usuario],
      );
      for (const l of dto.lineas) {
        await em.query(
          `INSERT INTO docs_emitidos_detalle
             (numdoc, tipo_doc, cliente, producto, cantidad, unidad, precio_uni,
              descto, total, "OC_avance", nombre, descripcion, comentario, ccosto, ccosto_ap)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,'',$12,$13)`,
          [num, dto.tipo_doc, dto.cliente, l.producto, l.cantidad, l.unidad,
            l.precio_uni, l.descto ?? 0, l.total, l.nombre, l.descripcion ?? '',
            l.ccosto ?? dto.ccosto ?? '', l.ccosto_ap ?? ''],
        );
      }
      return num;
    });

    await this.auditoria.anotar({
      usuario: ctx.usuario, tipo_accion: 'INS_REG', tabla_accion: 'docs_emitidos',
      id_registro: numdoc, inf_1: 'ORDEN COMPRA', inf_2: dto.tipo_doc, IP: ctx.ip,
    });

    const [creada] = await this.db.query(
      `SELECT id FROM docs_emitidos WHERE numdoc = $1 AND tipo_doc = $2`,
      [numdoc, dto.tipo_doc],
    );
    return this.obtenerOc(creada.id);
  }

  /** APRUEBA_OC: solo mueve PENDIENTE -> EMITIDO. */
  async aprobarOc(numdoc: number, ctx: Ctx) {
    const filas = await this.db.query(
      `UPDATE docs_emitidos SET estado = 'EMITIDO'
       WHERE numdoc = $1 AND tipo_doc = ANY($2) AND estado::text = 'PENDIENTE'
       RETURNING id`, [numdoc, TIPOS_OC],
    );
    if (!filas.length) {
      throw new ConflictException(
        `La OC ${numdoc} no esta en estado PENDIENTE, o no existe`,
      );
    }
    await this.auditoria.anotar({
      usuario: ctx.usuario, tipo_accion: 'MOD_REG', tabla_accion: 'APRUEBA_OC',
      id_registro: numdoc, inf_1: 'ORDEN COMPRA', IP: ctx.ip,
    });
    return this.obtenerOc(filas[0].id);
  }

  /**
   * ANULA_OC: deja estado ELIMINADO, y solo si nada la referencia.
   * Las tres precondiciones son las mismas tres consultas del ERP.
   */
  async anularOc(numdoc: number, cliente: number, ctx: Ctx) {
    const [{ n: conHes }] = await this.db.query(
      `SELECT COUNT(*)::int n FROM docs_emitidos WHERE tipo_doc = 'HES' AND "OC" = $1`,
      [String(numdoc)],
    );
    const [{ n: conFac }] = await this.db.query(
      `SELECT COUNT(*)::int n FROM docs_recibidos WHERE tipo_doc::text = '33' AND "OC" = $1`,
      [String(numdoc)],
    );
    const [{ n: conPago }] = await this.db.query(
      `SELECT COUNT(*)::int n FROM docs_pagos
       WHERE tipo::text = 'EMITIDO' AND numdoc = $1 AND cliente = $2`,
      [String(numdoc), cliente],
    );
    const total = conHes + conFac + conPago;
    if (total > 0) {
      throw new ConflictException(
        `No se pudo anular la OC. Existen documentos que la referencian ` +
        `(HES: ${conHes}, facturas: ${conFac}, pagos: ${conPago})`,
      );
    }

    const filas = await this.db.query(
      `UPDATE docs_emitidos SET estado = 'ELIMINADO'
       WHERE numdoc = $1 AND tipo_doc = ANY($2) RETURNING id`, [numdoc, TIPOS_OC],
    );
    if (!filas.length) throw new NotFoundException(`No existe la OC ${numdoc}`);

    await this.auditoria.anotar({
      usuario: ctx.usuario, tipo_accion: 'MOD_REG', tabla_accion: 'ANULA_OC',
      id_registro: numdoc, inf_1: 'ORDEN COMPRA', IP: ctx.ip,
    });
    return { mensaje: `OC ${numdoc} eliminada`, id: filas[0].id };
  }

  // ------------------------------------------------------------------ HES

  async emitirHes(dto: EmitirHesDto, ctx: Ctx) {
    const oc = await this.obtenerOc(dto.id_OC);
    if (Number(oc.OC_avance) >= 100) {
      throw new ConflictException('OC completada: no admite mas recepciones');
    }
    const lineas = (dto.lineas ?? []).filter((l) => Number(l.avance) > 0);
    if (!lineas.length) throw new BadRequestException('La HES no tiene lineas con avance');

    const tipoCambio = Number(oc.tipo_cambio) || 1;
    const totalOC = Number(oc.neto) / tipoCambio;
    if (!totalOC) throw new ConflictException('La OC tiene neto cero: no se puede prorratear');

    // Avance del encabezado, ponderado por plata (no promedio de lineas).
    const avanceTotReg = lineas.reduce((s, l) => s + Number(l.monto), 0);
    const avanceTot = Math.round((avanceTotReg / totalOC) * 100 * 10000) / 10000;

    const numdoc = await this.db.transaction(async (em) => {
      const num = await this.proximoNumero(em, 'HES');

      for (const l of lineas) {
        // La linea de la HES se copia desde la de la OC, igual que el ERP.
        await em.query(
          `INSERT INTO docs_emitidos_detalle
             (numdoc, tipo_doc, cliente, producto, cantidad, unidad, precio_uni,
              descto, total, "OC_avance", nombre, descripcion, comentario, ccosto, ccosto_ap)
           SELECT $1, 'HES', cliente, producto, $2, unidad, precio_uni,
                  descto, $3, $4, nombre, descripcion, $5, ccosto, $6
           FROM docs_emitidos_detalle WHERE id = $7`,
          [num, l.cantidad, l.monto, l.avance, l.comentario ?? '',
            l.ccosto_ap ?? '', l.id_linea],
        );
        await em.query(
          `UPDATE docs_emitidos_detalle SET "OC_avance" = "OC_avance" + $1 WHERE id = $2`,
          [l.avance, l.id_linea],
        );
      }

      // El encabezado de la HES se copia del de la OC.
      await em.query(
        `INSERT INTO docs_emitidos
           (numdoc, tipo_doc, "tipo_NC", fecha, cliente, rut, tipo_cli, estado, "FrmPago",
            tipo_moneda, tipo_cambio, fecha_moneda, neto, iva, total,
            ref_num, ref_tipo, ref_fecha, contacto, dir_retiro, dat_ref, obs,
            "OC", "OC_fecha", bodega, ccosto, "OC_avance", "HES", usuario, factura)
         SELECT $1, 'HES', "tipo_NC", $2::date, cliente, rut, tipo_cli, 'EMITIDO', "FrmPago",
                tipo_moneda, tipo_cambio, fecha_moneda, $3, $4, $5,
                ref_num, ref_tipo, ref_fecha, contacto, dir_retiro, dat_ref, $6,
                $7, $2::date, bodega, ccosto, $8, '', $9, 0
         FROM docs_emitidos WHERE id = $10`,
        [num, dto.fecha, dto.neto, dto.iva, dto.total, dto.obs ?? '',
          String(oc.numdoc), avanceTot, ctx.usuario, dto.id_OC],
      );

      // La OC acumula el avance y anota el numero de HES en una lista.
      await em.query(
        `UPDATE docs_emitidos
         SET "OC_avance" = "OC_avance" + $1,
             "HES" = CASE WHEN coalesce("HES",'') = '' THEN $2::text
                          ELSE "HES" || ':' || $2::text END
         WHERE id = $3`,
        [avanceTot, String(num), dto.id_OC],
      );
      return num;
    });

    await this.auditoria.anotar({
      usuario: ctx.usuario, tipo_accion: 'INS_REG', tabla_accion: 'docs_emitidos',
      id_registro: numdoc, inf_1: 'HES', inf_2: `OC:${oc.numdoc}`, IP: ctx.ip,
    });
    return { mensaje: `HES ${numdoc} emitida`, numdoc, avance: avanceTot };
  }

  /**
   * ELIMINA_HES: revierte el avance y borra fisicamente.
   * Cada linea de la HES se aparea con la de la OC por clave natural.
   */
  async eliminarHes(numdoc: number, ctx: Ctx) {
    const [hes] = await this.db.query(
      `SELECT id, estado, "HES", "OC", "OC_avance" FROM docs_emitidos
       WHERE numdoc = $1 AND tipo_doc = 'HES'`, [numdoc],
    );
    if (!hes) throw new NotFoundException('No se encontro la HES indicada');
    if (String(hes.HES).trim() === 'MF') {
      throw new ConflictException(
        'No se puede eliminar una HES ya procesada a Material Fungible',
      );
    }

    const ocNumdoc = String(hes.OC ?? '').trim();
    const avanceHes = Number(hes.OC_avance) || 0;

    await this.db.transaction(async (em) => {
      if (ocNumdoc !== '') {
        const [oc] = await em.query(
          `SELECT id, "OC_avance" FROM docs_emitidos
           WHERE numdoc = $1 AND tipo_doc = ANY($2)`, [ocNumdoc, TIPOS_OC],
        );
        if (!oc) throw new ConflictException('No se pudo leer la OC asociada a la HES');

        const detalle = await em.query(
          `SELECT producto, unidad, precio_uni, descto, nombre, "OC_avance"
           FROM docs_emitidos_detalle WHERE numdoc = $1 AND tipo_doc = 'HES' ORDER BY id`,
          [numdoc],
        );

        // Un id de la OC no se usa dos veces, igual que el ERP con oc_det_usados.
        const usados: number[] = [];
        for (const d of detalle) {
          const [linea] = await em.query(
            `SELECT id FROM docs_emitidos_detalle
             WHERE numdoc = $1 AND tipo_doc = ANY($2)
               AND producto = $3 AND nombre = $4 AND precio_uni = $5
               AND unidad = $6 AND descto = $7
               AND ($8::int[] IS NULL OR NOT (id = ANY($8)))
             ORDER BY id LIMIT 1`,
            [ocNumdoc, TIPOS_OC, d.producto, d.nombre, d.precio_uni, d.unidad,
              d.descto, usados.length ? usados : null],
          );
          if (!linea) {
            throw new ConflictException(
              'No se pudo ubicar el detalle de la OC asociado a la HES',
            );
          }
          usados.push(linea.id);
          await em.query(
            `UPDATE docs_emitidos_detalle
             SET "OC_avance" = GREATEST("OC_avance" - $1, 0) WHERE id = $2`,
            [Number(d.OC_avance) || 0, linea.id],
          );
        }

        const nuevoAvance = Math.max(Number(oc.OC_avance) - avanceHes, 0);
        await em.query(
          `UPDATE docs_emitidos
           SET "OC_avance" = $1,
               "HES" = NULLIF(array_to_string(
                 array_remove(string_to_array(coalesce("HES",''), ':'), $2::text), ':'), '')
           WHERE id = $3`,
          [nuevoAvance, String(numdoc), oc.id],
        );
      }

      await em.query(
        `DELETE FROM docs_emitidos_detalle WHERE numdoc = $1 AND tipo_doc = 'HES'`, [numdoc],
      );
      await em.query(
        `DELETE FROM docs_emitidos WHERE numdoc = $1 AND tipo_doc = 'HES'`, [numdoc],
      );
    });

    await this.auditoria.anotar({
      usuario: ctx.usuario, tipo_accion: 'DEL_REG', tabla_accion: 'ELIMINA_HES',
      id_registro: numdoc, inf_1: 'HES', inf_2: `OC:${ocNumdoc}`, IP: ctx.ip,
    });
    return { mensaje: `HES ${numdoc} eliminada`, ocRevertida: ocNumdoc };
  }
}
