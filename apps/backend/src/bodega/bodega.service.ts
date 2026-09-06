/**
 * Bodega: carga desde HES y movimientos de material.
 *
 * Réplica de ING_MAT_FUN, Emite_Documento_GR('MATERIAL'), ING_STK_MAT y
 * DEL_MOV_BODEGA del ERP. Las reglas que se conservan a propósito:
 *
 *  - El saldo de `material_bodega` es MUTABLE: se escribe sumando o restando
 *    en cada movimiento y se revierte a mano al eliminarlo. No se deriva.
 *  - Una entrega a persona escribe DOS filas —OUT con el centro de costo de la
 *    bodega, IN con el del funcionario, ambas sobre la MISMA bodega— pero
 *    descuenta el stock UNA sola vez. La fila IN es imputación contable, no
 *    ingreso de material, y nada en la tabla las distingue.
 *  - Al recibir, el precio de la compra PISA `material.tarifa`. El maestro
 *    guarda el último precio, no un historial.
 *  - El código del material se extrae partiendo el texto de la línea por
 *    "/MC_", igual que Material_IN.php.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, type EntityManager } from 'typeorm';

import { Bodega, Material } from '../entities/maestros.entity.js';
import { Documento } from '../entities/documentos.entity.js';
import { MaterialBodega, MovimientoBodega } from '../entities/inventario.entity.js';
import { VMaterialBodega, VMovimientoBodega } from '../entities/vistas.entity.js';
import {
  EstadoBodega,
  EstadoDocumento,
  TipoAccion,
  TipoDocMovimiento,
  TipoDocumento,
  TipoMovimiento,
} from '../entities/tipos.js';
import { AuditoriaService, type ContextoAuditoria } from '../common/auditoria.js';
import { paginar, type PaginacionDto, type RespuestaPaginada } from '../common/paginacion.js';

/** Réplica del `explode('/MC_', $nombre)` de Material_IN.php. */
export const codigoDesdeNombre = (nombre: string): string | null => {
  const i = nombre.indexOf('/MC_');
  if (i < 0) return null;
  const cola = nombre.slice(i + 4).trim();
  return cola ? `MC_${cola}` : null;
};

export interface LineaMovimiento {
  materialId: number;
  cantidad: number;
}

@Injectable()
export class BodegaService {
  constructor(
    @InjectRepository(VMaterialBodega)
    private readonly vStock: Repository<VMaterialBodega>,
    @InjectRepository(VMovimientoBodega)
    private readonly vMovimientos: Repository<VMovimientoBodega>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  // -------------------------------------------------------------------------
  //  Utilidades internas
  // -------------------------------------------------------------------------

  private async siguienteNumdoc(m: EntityManager): Promise<number> {
    const [{ nextval }] = await m.query<[{ nextval: string }]>(
      `SELECT nextval('seq_numdoc_movimiento')`,
    );
    return Number(nextval);
  }

  private async bodegaVigente(m: EntityManager, id: number): Promise<Bodega> {
    const b = await m.findOne(Bodega, { where: { id } });
    if (!b) throw new NotFoundException(`No existe la bodega con id ${id}`);
    if (b.estado !== EstadoBodega.VIGENTE) {
      throw new ConflictException(`La bodega ${b.descripcion} no está vigente`);
    }
    return b;
  }

  /** Suma al saldo, creando la fila si el material aún no estuvo en esa bodega. */
  private async sumarStock(
    m: EntityManager,
    materialId: number,
    bodegaId: number,
    cantidad: number,
  ): Promise<void> {
    // El UNIQUE(material_id, bodega_id) —que el ERP no tiene— permite resolver
    // esto en una sentencia en vez de SELECT COUNT + INSERT/UPDATE.
    await m.query(
      `INSERT INTO material_bodega (material_id, bodega_id, stock)
            VALUES ($1, $2, $3)
       ON CONFLICT (material_id, bodega_id)
       DO UPDATE SET stock = material_bodega.stock + EXCLUDED.stock`,
      [materialId, bodegaId, cantidad],
    );
  }

  private async saldoDe(
    m: EntityManager,
    materialId: number,
    bodegaId: number,
  ): Promise<number> {
    const fila = await m.findOne(MaterialBodega, { where: { materialId, bodegaId } });
    return fila ? Number(fila.stock) : 0;
  }

  private async escribirMovimiento(
    m: EntityManager,
    datos: Partial<MovimientoBodega>,
  ): Promise<MovimientoBodega> {
    return m.save(m.create(MovimientoBodega, datos));
  }

  // -------------------------------------------------------------------------
  //  Carga a bodega desde una HES  (ING_MAT_FUN)
  // -------------------------------------------------------------------------

  async cargarDesdeHes(
    hesId: number,
    bodegaId: number,
    ctx: ContextoAuditoria,
  ): Promise<{ mensaje: string; movimientos: number }> {
    const resumen = await this.ds.transaction(async (m) => {
      const hes = await m.findOne(Documento, {
        where: { id: hesId, tipo: TipoDocumento.HES },
        relations: { detalle: true },
      });
      if (!hes) throw new NotFoundException(`No existe una HES con id ${hesId}`);

      if (hes.cargadaABodega) {
        throw new ConflictException(
          `La HES ${hes.numdoc} ya fue cargada a bodega el ${hes.fechaCarga}`,
        );
      }
      if (hes.estado !== EstadoDocumento.EMITIDO) {
        throw new ConflictException(
          `La HES ${hes.numdoc} está en estado ${hes.estado}; solo se carga una HES EMITIDO`,
        );
      }

      const bodega = await this.bodegaVigente(m, bodegaId);

      // Se resuelven TODAS las líneas antes de escribir nada: si alguna no
      // tiene código o el código no existe en el maestro, la carga completa se
      // rechaza. Una carga parcial dejaría la HES marcada como cargada con
      // material que nunca entró.
      const resueltas: Array<{
        material: Material;
        cantidad: number;
        precioUni: number;
        categoriaId: number | null;
      }> = [];
      const problemas: string[] = [];

      for (const linea of hes.detalle) {
        const codigo = codigoDesdeNombre(linea.nombre);
        if (!codigo) {
          problemas.push(`"${linea.nombre}" no trae código con el formato /MC_nnn`);
          continue;
        }
        const material = await m.findOne(Material, { where: { codMaterial: codigo } });
        if (!material) {
          problemas.push(`"${linea.nombre}" apunta a ${codigo}, que no existe en el maestro`);
          continue;
        }
        resueltas.push({
          material,
          cantidad: Number(linea.cantidad),
          precioUni: Number(linea.precioUni),
          categoriaId: linea.categoriaId,
        });
      }

      if (problemas.length > 0) {
        throw new ConflictException(
          `No se puede cargar la HES ${hes.numdoc}. ${problemas.join('; ')}`,
        );
      }

      const numdoc = await this.siguienteNumdoc(m);

      for (const r of resueltas) {
        await this.sumarStock(m, r.material.id, bodega.id, r.cantidad);

        // REPLICADO: el precio de esta compra pisa el del maestro.
        await m.update(Material, { id: r.material.id }, { tarifa: r.precioUni });

        await this.escribirMovimiento(m, {
          numdoc,
          tipoDoc: TipoDocMovimiento.GR,
          tipoMov: TipoMovimiento.IN,
          bodegaId: bodega.id,
          materialId: r.material.id,
          cantidad: r.cantidad,
          unidad: r.material.unidad,
          tarifa: r.precioUni,
          ccostoId: hes.ccostoId,
          categoriaId: r.categoriaId ?? r.material.categoriaId,
          responsableId: bodega.responsableId,
          documentoId: hes.id,
          observacion: `Carga a bodega desde HES ${hes.numdoc}`,
        });
      }

      await m.update(
        Documento,
        { id: hes.id },
        {
          cargadaABodega: true,
          fechaCarga: new Date().toISOString().slice(0, 10),
          bodegaId: bodega.id,
        },
      );

      await this.auditoria.anotar(
        TipoAccion.INS_REG,
        'movimiento_bodega',
        numdoc,
        ctx,
        `Carga HES ${hes.numdoc} a ${bodega.descripcion}`,
        `${resueltas.length} línea(s)`,
      );

      return { numdoc, lineas: resueltas.length, hes: hes.numdoc, bodega: bodega.descripcion };
    });

    return {
      mensaje: `HES ${resumen.hes} cargada a ${resumen.bodega}`,
      movimientos: resumen.lineas,
    };
  }

  // -------------------------------------------------------------------------
  //  Entrega a una persona  (GR, tipo_Cambio = 'Persona')
  // -------------------------------------------------------------------------

  async entregar(
    datos: {
      bodegaId: number;
      ccostoDestinoId: number;
      responsableId?: number | null;
      observacion?: string;
      lineas: LineaMovimiento[];
    },
    ctx: ContextoAuditoria,
  ): Promise<{ mensaje: string; numdoc: number }> {
    return this.ds.transaction(async (m) => {
      const bodega = await this.bodegaVigente(m, datos.bodegaId);
      const numdoc = await this.siguienteNumdoc(m);
      const nota = datos.observacion?.trim() || 'Entrega de material';

      for (const l of datos.lineas) {
        const material = await m.findOne(Material, { where: { id: l.materialId } });
        if (!material) {
          throw new NotFoundException(`No existe el material con id ${l.materialId}`);
        }

        const saldo = await this.saldoDe(m, material.id, bodega.id);
        if (l.cantidad > saldo) {
          throw new ConflictException(
            `${material.codMaterial} tiene ${saldo} en ${bodega.descripcion} y se intentan entregar ${l.cantidad}`,
          );
        }

        // REPLICADO: dos filas, un solo descuento. La fila IN imputa el costo
        // al centro de costo de quien recibe, sobre la misma bodega, y NO es
        // un ingreso de material.
        await this.escribirMovimiento(m, {
          numdoc, tipoDoc: TipoDocMovimiento.GR, tipoMov: TipoMovimiento.OUT,
          bodegaId: bodega.id, materialId: material.id, cantidad: l.cantidad,
          unidad: material.unidad, tarifa: material.tarifa,
          ccostoId: bodega.ccostoId, categoriaId: material.categoriaId,
          responsableId: datos.responsableId ?? bodega.responsableId,
          observacion: nota,
        });

        await this.escribirMovimiento(m, {
          numdoc, tipoDoc: TipoDocMovimiento.GR, tipoMov: TipoMovimiento.IN,
          bodegaId: bodega.id, materialId: material.id, cantidad: l.cantidad,
          unidad: material.unidad, tarifa: material.tarifa,
          ccostoId: datos.ccostoDestinoId, categoriaId: material.categoriaId,
          responsableId: datos.responsableId ?? bodega.responsableId,
          observacion: `${nota} | imputación de costo`,
        });

        await this.sumarStock(m, material.id, bodega.id, -l.cantidad);
      }

      await this.auditoria.anotar(
        TipoAccion.INS_REG, 'movimiento_bodega', numdoc, ctx,
        `Entrega desde ${bodega.descripcion}`, `${datos.lineas.length} línea(s)`,
      );

      return { mensaje: `Entrega registrada con el documento ${numdoc}`, numdoc };
    });
  }

  // -------------------------------------------------------------------------
  //  Traspaso entre bodegas  (GR, tipo_Cambio = 'Bodega')
  // -------------------------------------------------------------------------

  async traspasar(
    datos: {
      bodegaOrigenId: number;
      bodegaDestinoId: number;
      observacion?: string;
      lineas: LineaMovimiento[];
    },
    ctx: ContextoAuditoria,
  ): Promise<{ mensaje: string; numdoc: number }> {
    if (datos.bodegaOrigenId === datos.bodegaDestinoId) {
      throw new BadRequestException('La bodega de origen y la de destino son la misma');
    }

    return this.ds.transaction(async (m) => {
      const origen = await this.bodegaVigente(m, datos.bodegaOrigenId);
      const destino = await this.bodegaVigente(m, datos.bodegaDestinoId);
      const numdoc = await this.siguienteNumdoc(m);
      const nota = datos.observacion?.trim() || `Traspaso ${origen.descripcion} → ${destino.descripcion}`;

      for (const l of datos.lineas) {
        const material = await m.findOne(Material, { where: { id: l.materialId } });
        if (!material) {
          throw new NotFoundException(`No existe el material con id ${l.materialId}`);
        }

        const saldo = await this.saldoDe(m, material.id, origen.id);
        if (l.cantidad > saldo) {
          throw new ConflictException(
            `${material.codMaterial} tiene ${saldo} en ${origen.descripcion} y se intentan traspasar ${l.cantidad}`,
          );
        }

        await this.escribirMovimiento(m, {
          numdoc, tipoDoc: TipoDocMovimiento.GR, tipoMov: TipoMovimiento.OUT,
          bodegaId: origen.id, materialId: material.id, cantidad: l.cantidad,
          unidad: material.unidad, tarifa: material.tarifa,
          ccostoId: origen.ccostoId, categoriaId: material.categoriaId,
          responsableId: origen.responsableId, observacion: nota,
        });
        await this.escribirMovimiento(m, {
          numdoc, tipoDoc: TipoDocMovimiento.GR, tipoMov: TipoMovimiento.IN,
          bodegaId: destino.id, materialId: material.id, cantidad: l.cantidad,
          unidad: material.unidad, tarifa: material.tarifa,
          ccostoId: destino.ccostoId, categoriaId: material.categoriaId,
          responsableId: destino.responsableId, observacion: nota,
        });

        await this.sumarStock(m, material.id, origen.id, -l.cantidad);
        await this.sumarStock(m, material.id, destino.id, l.cantidad);
      }

      await this.auditoria.anotar(
        TipoAccion.INS_REG, 'movimiento_bodega', numdoc, ctx,
        `Traspaso ${origen.descripcion} → ${destino.descripcion}`,
        `${datos.lineas.length} línea(s)`,
      );

      return { mensaje: `Traspaso registrado con el documento ${numdoc}`, numdoc };
    });
  }

  // -------------------------------------------------------------------------
  //  Ajuste de stock  (ING_STK_MAT)
  // -------------------------------------------------------------------------

  async ajustar(
    datos: { bodegaId: number; materialId: number; nuevoStock: number; motivo: string },
    ctx: ContextoAuditoria,
  ): Promise<{ mensaje: string; anterior: number; nuevo: number }> {
    return this.ds.transaction(async (m) => {
      const bodega = await this.bodegaVigente(m, datos.bodegaId);
      const material = await m.findOne(Material, { where: { id: datos.materialId } });
      if (!material) {
        throw new NotFoundException(`No existe el material con id ${datos.materialId}`);
      }

      const anterior = await this.saldoDe(m, material.id, bodega.id);
      const delta = Math.round((datos.nuevoStock - anterior) * 100) / 100;

      if (delta === 0) {
        throw new ConflictException('El stock indicado es igual al actual: no hay ajuste que registrar');
      }

      await this.escribirMovimiento(m, {
        numdoc: await this.siguienteNumdoc(m),
        tipoDoc: TipoDocMovimiento.AJUSTE,
        tipoMov: delta > 0 ? TipoMovimiento.IN : TipoMovimiento.OUT,
        bodegaId: bodega.id,
        materialId: material.id,
        cantidad: Math.abs(delta),
        unidad: material.unidad,
        tarifa: material.tarifa,
        ccostoId: bodega.ccostoId,
        categoriaId: material.categoriaId,
        responsableId: bodega.responsableId,
        observacion: `Ajuste: ${datos.motivo}`,
      });

      await this.sumarStock(m, material.id, bodega.id, delta);

      await this.auditoria.anotar(
        TipoAccion.MOD_REG, 'material_bodega', material.id, ctx,
        `Ajuste ${material.codMaterial} en ${bodega.descripcion}: ${anterior} → ${datos.nuevoStock}`,
        datos.motivo,
      );

      return {
        mensaje: `Stock ajustado de ${anterior} a ${datos.nuevoStock}`,
        anterior,
        nuevo: datos.nuevoStock,
      };
    });
  }

  // -------------------------------------------------------------------------
  //  Consulta y eliminación
  // -------------------------------------------------------------------------

  async movimientos(
    q: PaginacionDto & { bodega?: string; material?: string },
  ): Promise<RespuestaPaginada<VMovimientoBodega>> {
    const qb = this.vMovimientos.createQueryBuilder('v');

    if (q.bodega) qb.andWhere('v.bodega_codigo = :b', { b: Number(q.bodega) });
    if (q.material) qb.andWhere('v.cod_material = :m', { m: q.material });
    if (q.buscar) {
      qb.andWhere(
        '(v.cod_material ILIKE :t OR v.material ILIKE :t OR v.observacion ILIKE :t OR CAST(v.numdoc AS TEXT) ILIKE :t)',
        { t: `%${q.buscar}%` },
      );
    }

    const [datos, total] = await qb
      .orderBy('v.id', 'DESC')
      .skip((q.pagina - 1) * q.limite)
      .take(q.limite)
      .getManyAndCount();

    return paginar(datos, total, q);
  }

  stock(bodega?: string, soloBajoMinimo?: boolean): Promise<VMaterialBodega[]> {
    const qb = this.vStock.createQueryBuilder('v');
    if (bodega) qb.andWhere('v.bodega_codigo = :b', { b: Number(bodega) });
    if (soloBajoMinimo) qb.andWhere('v.bajo_minimo = true');
    return qb.orderBy('v.cod_material', 'ASC').getMany();
  }

  /**
   * Réplica de DEL_MOV_BODEGA: revierte el saldo según el tipo de la fila y
   * borra el movimiento.
   *
   * ATENCIÓN — se replica un defecto conocido del ERP. La reversa mira solo
   * `tipo_mov`, y en una entrega a persona la fila IN es imputación de costo,
   * no ingreso de material. Eliminar esa fila suelta descuenta stock que nunca
   * volvió a entrar. El ERP no tiene forma de distinguirlas y aquí tampoco,
   * porque no se agregó la columna que lo haría.
   */
  async eliminarMovimiento(
    id: number,
    ctx: ContextoAuditoria,
  ): Promise<{ mensaje: string }> {
    return this.ds.transaction(async (m) => {
      const mov = await m.findOne(MovimientoBodega, { where: { id } });
      if (!mov) throw new NotFoundException(`No existe el movimiento con id ${id}`);

      if (mov.documentoId) {
        throw new ConflictException(
          'Este movimiento vino de una carga desde HES. Para revertirlo hay que ' +
            'trabajar sobre el documento, no sobre el movimiento suelto.',
        );
      }

      const delta =
        mov.tipoMov === TipoMovimiento.IN ? -Number(mov.cantidad) : Number(mov.cantidad);
      await this.sumarStock(m, mov.materialId, mov.bodegaId, delta);
      await m.delete(MovimientoBodega, { id });

      await this.auditoria.anotar(
        TipoAccion.DEL_REG, 'movimiento_bodega', id, ctx,
        `Elimina movimiento ${mov.numdoc} (${mov.tipoMov})`,
        `revierte ${delta} en la bodega ${mov.bodegaId}`,
      );

      return { mensaje: `Movimiento ${mov.numdoc} eliminado y saldo revertido` };
    });
  }
}
