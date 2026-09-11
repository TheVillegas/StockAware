/**
 * Bodega: carga desde HES, stock, movimientos y ajustes.
 *
 * Traduccion de ING_MAT_FUN, Emite_Documento_GR, AJUSTE_STK_MAT y
 * DEL_MOV_BODEGA. Las rarezas del original que se replican a proposito:
 *
 *  - El codigo del material NO es una llave: viene incrustado en el texto de
 *    la linea de la HES, con el formato "DESCRIPCION/MC_123". Si una linea no
 *    trae el patron, no se puede cargar.
 *  - Cargar una HES a bodega le pone HES = 'MF', y eso es lo que despues
 *    impide eliminarla desde compras.
 *  - Recibir material PISA la tarifa del maestro con el ultimo precio pagado
 *    (UPDATE materiales SET tarifa = precioUni). El historico no se conserva.
 *  - mov_bodega es polimorfica: tipo_vhe dice de que tipo es la cosa movida y
 *    id_vhe guarda su codigo como texto. Material, Vehiculo, Equipo, etc.
 *  - Entregar material a una persona escribe DOS filas (una salida con el
 *    ccosto de la bodega y una entrada con el de la persona) pero descuenta
 *    el stock UNA sola vez: la segunda fila es imputacion de costo.
 */
import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { AuditoriaService } from '../comun/auditoria.service';

interface Ctx { usuario: string; ip: string; idUsuario: number; }

export interface CargarHesDto { numdoc: number; bodega: number; fecha?: string; }
export interface LineaMovDto { id_vhe: string; cantidad: number; tarifa?: number; unidad?: string; }
export interface GrDto {
  /** IN = entra a bodega, OUT = sale, MATERIAL = material fungible. */
  tipoMov: 'IN' | 'OUT' | 'MATERIAL';
  /** Solo para MATERIAL: a otra bodega o a una persona. */
  tipo_Cambio?: 'Bodega' | 'Persona';
  tipo_vhe: string;
  bodega: number;
  bodegaDestino?: number;
  id_responsable?: number;
  ccosto?: string;
  ccosto_ap?: string;
  fecha?: string;
  obs?: string;
  lineas: LineaMovDto[];
}
export interface AjusteDto {
  bodega: number; cod_material: string; stockNuevo: number; motivo: string;
}

/**
 * mov_bodega.cantidad, mov_bodega.tarifa y materiales_x_bodega.stock son
 * ENTEROS, pero las cantidades y precios de la HES son decimales. MySQL
 * truncaba solo; PostgreSQL rechaza el valor. Se redondea al escribir.
 */
const entero = (v: unknown): number => Math.round(Number(v ?? 0));

/** Extrae MC_nnn del texto de una linea, como explode("/MC_") en Material_IN.php. */
export const codigoDesdeNombre = (nombre: string): string | null => {
  const i = (nombre ?? '').indexOf('/MC_');
  if (i < 0) return null;
  const cola = nombre.slice(i + 4).trim();
  return cola ? `MC_${cola}` : null;
};

@Injectable()
export class BodegaService {
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

  /** MATERIAL_X_BODEGA */
  async stock(q: { bodega?: number; buscar?: string; bajoMinimo?: boolean }) {
    const cond: string[] = ['1=1'];
    const par: unknown[] = [];
    if (q.bodega) { par.push(q.bodega); cond.push(`v.id_bodega = $${par.length}`); }
    if (q.buscar?.trim()) {
      par.push(`%${q.buscar.trim().toLowerCase()}%`);
      const i = par.length;
      cond.push(`(lower(v.cod_material) LIKE $${i} OR lower(coalesce(v.nombre,'')) LIKE $${i})`);
    }
    if (q.bajoMinimo) cond.push(`v.stock < coalesce(m.stock_minimo, 0)`);

    return this.db.query(
      `SELECT v.cod_material, v.nombre, v.estado, v.id_bodega, v.bodega,
              v.stock, v.unidad, v.tarifa, coalesce(m.stock_minimo,0) AS stock_minimo
       FROM v_materiales_x_bodega v
       LEFT JOIN materiales m ON m.cod_material = v.cod_material
       WHERE ${cond.join(' AND ')}
       ORDER BY v.bodega, v.cod_material LIMIT 500`, par,
    );
  }

  /** BODEGA_MOVIMIENTOS */
  async movimientos(q: {
    bodega?: number; tipo_vhe?: string; id_vhe?: string;
    pagina?: number; limite?: number;
  }) {
    const limite = Math.min(Math.max(q.limite ?? 50, 1), 200);
    const pagina = Math.max(q.pagina ?? 1, 1);
    const cond: string[] = ['1=1'];
    const par: unknown[] = [];
    if (q.bodega) { par.push(q.bodega); cond.push(`id_bodega = $${par.length}`); }
    if (q.tipo_vhe) { par.push(q.tipo_vhe); cond.push(`tipo_vhe::text = $${par.length}`); }
    if (q.id_vhe) { par.push(q.id_vhe); cond.push(`id_vhe = $${par.length}`); }
    const where = `WHERE ${cond.join(' AND ')}`;

    const [{ n }] = await this.db.query(
      `SELECT COUNT(*)::int n FROM v_mov_bodega ${where}`, par,
    );
    const datos = await this.db.query(
      `SELECT * FROM v_mov_bodega ${where} ORDER BY fecha DESC, id DESC
       LIMIT $${par.length + 1} OFFSET $${par.length + 2}`,
      [...par, limite, (pagina - 1) * limite],
    );
    return { datos, total: n, pagina, paginas: Math.max(Math.ceil(n / limite), 1) };
  }


  // ------------------------------------------------------------- apoyo UI

  /** Bodegas vigentes, para los selectores. */
  async bodegas() {
    return this.db.query(
      `SELECT bodega, descr, ccosto, estado FROM bodega
       WHERE estado::text = 'VIGENTE' ORDER BY descr`,
    );
  }

  /** Los 14 valores de mov_bodega.tipo_vhe, tal como estan en el enum. */
  async tiposVhe(): Promise<string[]> {
    const filas = await this.db.query(
      `SELECT e.enumlabel AS v FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'mov_bodega_tipo_vhe_enum' ORDER BY e.enumsortorder`,
    );
    return filas.map((f: any) => f.v).filter((v: string) => v !== '');
  }

  /**
   * Busca lo que se puede mover. Material sale del maestro de materiales;
   * el resto son equipos y vehiculos, que en mov_bodega van por su codigo.
   */
  async buscarItems(tipo_vhe: string, q: string, bodega?: number) {
    const like = `%${(q ?? '').toLowerCase()}%`;
    if (tipo_vhe === 'Material') {
      return this.db.query(
        // materiales.unidad es un codigo; la glosa vive en tablas_varias.
        `SELECT m.cod_material AS codigo, m.nombre,
                coalesce(tv.glosa, m.unidad::text) AS unidad, m.tarifa,
                coalesce(mb.stock, 0) AS stock
         FROM materiales m
         LEFT JOIN materiales_x_bodega mb
           ON mb.cod_material = m.cod_material AND mb.id_bodega = $2
         LEFT JOIN tablas_varias tv
           ON tv.tipo::text = 'UNIDAD' AND tv.codigo = m.unidad
         WHERE lower(m.cod_material) LIKE $1 OR lower(coalesce(m.nombre,'')) LIKE $1
         ORDER BY m.cod_material LIMIT 25`, [like, bodega ?? 0],
      );
    }
    if (tipo_vhe === 'Vehiculo') {
      return this.db.query(
        `SELECT patente AS codigo, glosa AS nombre, 'UNI' AS unidad,
                tarifa_1 AS tarifa, 0 AS stock
         FROM vehiculos WHERE estado::text <> 'BAJA'
           AND (lower(coalesce(patente,'')) LIKE $1 OR lower(coalesce(glosa,'')) LIKE $1)
         ORDER BY patente LIMIT 25`, [like],
      );
    }
    return this.db.query(
      `SELECT "Cod_equipo" AS codigo, "Nom_equipo" AS nombre, 'UNI' AS unidad,
              tarifa_1 AS tarifa, 0 AS stock
       FROM herramientas
       WHERE lower(coalesce("Cod_equipo",'')) LIKE $1
          OR lower(coalesce("Nom_equipo",'')) LIKE $1
       ORDER BY "Cod_equipo" LIMIT 25`, [like],
    );
  }

  // ------------------------------------------------------- carga desde HES

  /** Las lineas de una HES, con el codigo de material ya resuelto. */
  async lineasDeHes(numdoc: number) {
    const [hes] = await this.db.query(
      `SELECT numdoc, "HES", ccosto, bodega, estado FROM docs_emitidos
       WHERE numdoc = $1 AND tipo_doc = 'HES'`, [numdoc],
    );
    if (!hes) throw new NotFoundException(`No existe la HES ${numdoc}`);

    const detalle = await this.db.query(
      `SELECT id, nombre, descripcion, cantidad, unidad, precio_uni, total, ccosto, ccosto_ap
       FROM docs_emitidos_detalle WHERE numdoc = $1 AND tipo_doc = 'HES' ORDER BY id`,
      [numdoc],
    );
    return {
      numdoc: hes.numdoc,
      ccosto: hes.ccosto,
      yaCargada: String(hes.HES).trim() === 'MF',
      lineas: detalle.map((l: any) => ({
        ...l,
        cod_material: codigoDesdeNombre(l.nombre),
      })),
    };
  }

  /**
   * ING_MAT_FUN: ingresa a bodega el material de una HES.
   * Si alguna linea no resuelve su codigo, no se carga nada.
   */
  async cargarDesdeHes(dto: CargarHesDto, ctx: Ctx) {
    const hes = await this.lineasDeHes(dto.numdoc);
    if (hes.yaCargada) {
      throw new ConflictException(`La HES ${dto.numdoc} ya fue cargada a bodega`);
    }
    const sinCodigo = hes.lineas.filter((l: any) => !l.cod_material);
    if (sinCodigo.length) {
      throw new BadRequestException(
        `Hay ${sinCodigo.length} linea(s) sin el patron "/MC_" en su descripcion: ` +
        sinCodigo.map((l: any) => l.nombre).join(' | '),
      );
    }

    const [bod] = await this.db.query(
      `SELECT id_responsable, ccosto FROM bodega WHERE bodega = $1`, [dto.bodega],
    );
    if (!bod) throw new NotFoundException(`No existe la bodega ${dto.bodega}`);

    const fecha = dto.fecha ?? new Date().toISOString().slice(0, 10);

    const numdocGr = await this.db.transaction(async (em) => {
      const gr = await this.proximoNumero(em, 'GR');

      for (const l of hes.lineas as any[]) {
        const cod = l.cod_material as string;
        const precio = entero(l.precio_uni);

        // Alta o suma en el saldo de esa bodega.
        const [existe] = await em.query(
          `SELECT id FROM materiales_x_bodega WHERE cod_material = $1 AND id_bodega = $2`,
          [cod, dto.bodega],
        );
        if (existe) {
          await em.query(
            `UPDATE materiales_x_bodega SET stock = stock + $1
             WHERE cod_material = $2 AND id_bodega = $3`, [entero(l.cantidad), cod, dto.bodega],
          );
        } else {
          await em.query(
            `INSERT INTO materiales_x_bodega (cod_material, id_bodega, stock)
             VALUES ($1,$2,$3)`, [cod, dto.bodega, entero(l.cantidad)],
          );
        }

        // El ultimo precio pagado pisa la tarifa del maestro. Es del ERP.
        await em.query(
          `UPDATE materiales SET tarifa = $1 WHERE cod_material = $2`, [precio, cod],
        );

        await em.query(
          `INSERT INTO mov_bodega
             (numdoc, "tipoDoc", id_bodega, id_responsable, tipo_mov, fecha, "fechaFin",
              ccosto, ccosto_ap, tarifa, tipo_vhe, id_vhe, cantidad, unidad, estado)
           VALUES ($1,'GR',$2,$3,'IN',$4::date,$4::date,$5,$6,$7,'Material',$8,$9,$10,'CONFORME')`,
          [gr, dto.bodega, bod.id_responsable ?? 0, fecha,
            l.ccosto ?? hes.ccosto ?? '', l.ccosto_ap ?? '', precio, cod, entero(l.cantidad),
            l.unidad ?? 'UNI'],
        );
      }

      // Marca la HES como procesada: desde aca no se puede eliminar.
      await em.query(
        `UPDATE docs_emitidos SET "HES" = 'MF', "HES_fecha" = $1::date, bodega = $2
         WHERE tipo_doc = 'HES' AND numdoc = $3`, [fecha, dto.bodega, dto.numdoc],
      );
      return gr;
    });

    await this.auditoria.anotar({
      usuario: ctx.usuario, tipo_accion: 'INS_REG', tabla_accion: 'mov_bodega',
      id_registro: numdocGr, inf_1: 'ING_MAT_FUN', inf_2: `HES:${dto.numdoc}`, IP: ctx.ip,
    });
    return {
      mensaje: `HES ${dto.numdoc} cargada a bodega`,
      numdoc: numdocGr, lineas: hes.lineas.length,
    };
  }

  // ----------------------------------------------------- guia de recepcion

  /**
   * Emite_Documento_GR: una sola operacion con tres modos.
   * MATERIAL descuenta stock; IN y OUT mueven equipos y vehiculos, que no
   * llevan saldo en materiales_x_bodega.
   */
  async emitirGr(dto: GrDto, ctx: Ctx) {
    if (!dto.lineas?.length) throw new BadRequestException('No hay lineas que mover');
    const esMaterial = dto.tipoMov === 'MATERIAL';
    if (esMaterial && !dto.tipo_Cambio) {
      throw new BadRequestException('Para material hay que indicar si va a Bodega o a Persona');
    }
    if (esMaterial && dto.tipo_Cambio === 'Bodega' && !dto.bodegaDestino) {
      throw new BadRequestException('Falta la bodega de destino');
    }

    const fecha = dto.fecha ?? new Date().toISOString().slice(0, 10);
    const [bod] = await this.db.query(
      `SELECT id_responsable, ccosto FROM bodega WHERE bodega = $1`, [dto.bodega],
    );
    if (!bod) throw new NotFoundException(`No existe la bodega ${dto.bodega}`);

    const numdoc = await this.db.transaction(async (em) => {
      const gr = await this.proximoNumero(em, 'GR');

      const inserta = (
        bodega: number, tipoMov: 'IN' | 'OUT', ccosto: string, l: LineaMovDto,
      ) => em.query(
        `INSERT INTO mov_bodega
           (numdoc, "tipoDoc", id_bodega, id_responsable, tipo_mov, fecha, "fechaFin",
            ccosto, ccosto_ap, tarifa, tipo_vhe, id_vhe, cantidad, unidad, estado)
         VALUES ($1,'GR',$2,$3,$4,$5::date,$5::date,$6,$7,$8,$9,$10,$11,$12,'CONFORME')`,
        [gr, bodega, dto.id_responsable ?? bod.id_responsable ?? 0, tipoMov, fecha,
          ccosto, dto.ccosto_ap ?? '', entero(l.tarifa), dto.tipo_vhe,
          l.id_vhe, entero(l.cantidad), l.unidad ?? 'UNI'],
      );

      for (const l of dto.lineas) {
        if (!esMaterial) {
          // Equipos y vehiculos: solo queda la traza del movimiento.
          await inserta(dto.bodega, dto.tipoMov as 'IN' | 'OUT', dto.ccosto ?? bod.ccosto ?? '', l);
          continue;
        }

        const [saldo] = await em.query(
          `SELECT stock FROM materiales_x_bodega WHERE cod_material = $1 AND id_bodega = $2`,
          [l.id_vhe, dto.bodega],
        );
        if (!saldo || Number(saldo.stock) < Number(l.cantidad)) {
          throw new ConflictException(
            `Stock insuficiente de ${l.id_vhe} en la bodega ${dto.bodega} ` +
            `(hay ${saldo ? saldo.stock : 0}, se piden ${l.cantidad})`,
          );
        }

        // Sale de la bodega de origen, siempre.
        await em.query(
          `UPDATE materiales_x_bodega SET stock = stock - $1
           WHERE cod_material = $2 AND id_bodega = $3`, [entero(l.cantidad), l.id_vhe, dto.bodega],
        );
        await inserta(dto.bodega, 'OUT', dto.ccosto ?? bod.ccosto ?? '', l);

        if (dto.tipo_Cambio === 'Bodega') {
          // Traspaso: entra de verdad en la bodega destino.
          const [hay] = await em.query(
            `SELECT id FROM materiales_x_bodega WHERE cod_material = $1 AND id_bodega = $2`,
            [l.id_vhe, dto.bodegaDestino],
          );
          if (hay) {
            await em.query(
              `UPDATE materiales_x_bodega SET stock = stock + $1
               WHERE cod_material = $2 AND id_bodega = $3`,
              [entero(l.cantidad), l.id_vhe, dto.bodegaDestino],
            );
          } else {
            await em.query(
              `INSERT INTO materiales_x_bodega (cod_material, id_bodega, stock)
               VALUES ($1,$2,$3)`, [l.id_vhe, dto.bodegaDestino, entero(l.cantidad)],
            );
          }
          await inserta(dto.bodegaDestino!, 'IN', dto.ccosto ?? '', l);
        } else {
          // Entrega a persona: segunda fila SIN sumar stock. Imputa el costo
          // al centro de costo de quien recibe. El saldo ya bajo una vez.
          await inserta(dto.bodega, 'IN', dto.ccosto ?? '', l);
        }
      }
      return gr;
    });

    await this.auditoria.anotar({
      usuario: ctx.usuario, tipo_accion: 'INS_REG', tabla_accion: 'mov_bodega',
      id_registro: numdoc, inf_1: `GR_${dto.tipoMov}`,
      inf_2: dto.tipo_Cambio ?? dto.tipo_vhe, IP: ctx.ip,
    });
    return { mensaje: `Guia ${numdoc} emitida`, numdoc };
  }

  // ----------------------------------------------------------------- ajuste

  /** AJUSTE_STK_MAT: deja el saldo en el valor indicado y deja la traza. */
  async ajustar(dto: AjusteDto, ctx: Ctx) {
    if (!dto.motivo?.trim()) throw new BadRequestException('El ajuste necesita un motivo');

    const [saldo] = await this.db.query(
      `SELECT stock FROM materiales_x_bodega WHERE cod_material = $1 AND id_bodega = $2`,
      [dto.cod_material, dto.bodega],
    );
    const anterior = saldo ? Number(saldo.stock) : 0;
    const diferencia = Number(dto.stockNuevo) - anterior;
    if (diferencia === 0) {
      return { mensaje: 'El stock ya tenia ese valor', anterior, nuevo: anterior };
    }

    const [bod] = await this.db.query(
      `SELECT id_responsable, ccosto FROM bodega WHERE bodega = $1`, [dto.bodega],
    );
    if (!bod) throw new NotFoundException(`No existe la bodega ${dto.bodega}`);
    const [mat] = await this.db.query(
      `SELECT unidad, tarifa FROM materiales WHERE cod_material = $1`, [dto.cod_material],
    );

    const numdoc = await this.db.transaction(async (em) => {
      const gr = await this.proximoNumero(em, 'GR');
      if (saldo) {
        await em.query(
          `UPDATE materiales_x_bodega SET stock = $1
           WHERE cod_material = $2 AND id_bodega = $3`,
          [entero(dto.stockNuevo), dto.cod_material, dto.bodega],
        );
      } else {
        await em.query(
          `INSERT INTO materiales_x_bodega (cod_material, id_bodega, stock)
           VALUES ($1,$2,$3)`, [dto.cod_material, dto.bodega, entero(dto.stockNuevo)],
        );
      }
      await em.query(
        `INSERT INTO mov_bodega
           (numdoc, "tipoDoc", id_bodega, id_responsable, tipo_mov, fecha, "fechaFin",
            ccosto, ccosto_ap, tarifa, tipo_vhe, id_vhe, cantidad, unidad, estado)
         VALUES ($1,'GR',$2,$3,$4,CURRENT_DATE,CURRENT_DATE,$5,'',$6,'Material',$7,$8,$9,'CONFORME')`,
        [gr, dto.bodega, 0, diferencia > 0 ? 'IN' : 'OUT', bod.ccosto ?? '',
          entero(mat?.tarifa), dto.cod_material, Math.abs(entero(diferencia)),
          mat?.unidad ?? 'UNI'],
      );
      return gr;
    });

    await this.auditoria.anotar({
      usuario: ctx.usuario, tipo_accion: 'MOD_REG', tabla_accion: 'materiales_x_bodega',
      id_registro: numdoc, inf_1: 'AJUSTE_STK_MAT',
      inf_2: `${dto.cod_material}: ${anterior} -> ${dto.stockNuevo} (${dto.motivo})`,
      IP: ctx.ip,
    });
    return { mensaje: 'Stock ajustado', anterior, nuevo: Number(dto.stockNuevo), numdoc };
  }

  // ------------------------------------------------------------ eliminacion

  /**
   * DEL_MOV_BODEGA: borra el movimiento y devuelve el saldo.
   * La reversa mira SOLO el tipo del movimiento, igual que el ERP. En una
   * entrega a persona eso significa que borrar la fila de imputacion de costo
   * suma stock que nunca habia entrado. Se replica el defecto.
   */
  async eliminarMovimiento(id: number, ctx: Ctx) {
    const [mov] = await this.db.query(`SELECT * FROM mov_bodega WHERE id = $1`, [id]);
    if (!mov) throw new NotFoundException(`No existe el movimiento ${id}`);

    await this.db.transaction(async (em) => {
      if (String(mov.tipo_vhe) === 'Material') {
        const signo = String(mov.tipo_mov) === 'IN' ? -1 : 1;
        await em.query(
          `UPDATE materiales_x_bodega SET stock = GREATEST(stock + $1, 0)
           WHERE cod_material = $2 AND id_bodega = $3`,
          [signo * entero(mov.cantidad), mov.id_vhe, mov.id_bodega],
        );
      }
      await em.query(`DELETE FROM mov_bodega WHERE id = $1`, [id]);
    });

    await this.auditoria.anotar({
      usuario: ctx.usuario, tipo_accion: 'DEL_REG', tabla_accion: 'mov_bodega',
      id_registro: id, inf_1: 'DEL_MOV_BODEGA',
      inf_2: `${mov.tipo_vhe}:${mov.id_vhe} ${mov.tipo_mov} ${mov.cantidad}`, IP: ctx.ip,
    });
    return { mensaje: `Movimiento ${id} eliminado` };
  }
}
