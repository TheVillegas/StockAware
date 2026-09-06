/**
 * HES: recepción conforme contra una orden de compra.
 *
 * Réplica de EMISION_HES y ELIMINA_HES del ERP. Las reglas de cálculo salen de
 * DLL.php y no son las obvias:
 *
 *  - El avance de CADA LÍNEA de la OC sube en el porcentaje recibido de esa
 *    línea:  cantidad_recibida / cantidad_de_la_línea * 100.
 *  - El avance de la CABECERA de la OC sube ponderado por MONTO, no como
 *    promedio de las líneas:  suma(monto recibido) / neto de la OC * 100,
 *    redondeado a 4 decimales. Es la línea
 *    `$avance_tot = round(($avanceTotReg/$totalOC)*100, 4)`.
 *  - No se puede emitir una HES contra una OC cuyo avance ya llegó a 100.
 *  - Eliminar una HES revierte ambos avances con piso en cero (GREATEST(...,0))
 *    y borra el documento FÍSICAMENTE: el ERP no lo deja en estado ANULADO.
 *    La traza queda en `registro`.
 *  - Una HES ya cargada a bodega no se puede eliminar.
 */
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { Documento, DocumentoDetalle } from '../entities/documentos.entity.js';
import { EstadoDocumento, TipoAccion, TipoDocumento } from '../entities/tipos.js';
import { AuditoriaService, Ctx, type ContextoAuditoria } from '../common/auditoria.js';
import { PaginacionDto, paginar, type RespuestaPaginada } from '../common/paginacion.js';
import { JwtAuthGuard, PermisosGuard, RequierePermiso } from '../common/permisos.js';
import { OrdenCompraService } from './orden-compra.controller.js';

export class LineaHesDto {
  @ApiProperty({ description: 'Id de la línea de la OC que se está recibiendo' })
  @IsInt()
  detalleOcId: number;

  @ApiProperty({ example: 3, description: 'Cantidad recibida en esta HES' })
  @IsNumber()
  @Min(0.01)
  cantidad: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) comentario?: string;
}

export class CrearHesDto {
  @ApiProperty({ description: 'Id de la orden de compra que se recibe' })
  @IsInt()
  ocId: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1024) observacion?: string;

  @ApiProperty({ type: [LineaHesDto], description: 'Solo las líneas que se reciben' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaHesDto)
  detalle: LineaHesDto[];
}

@Injectable()
export class HesService {
  constructor(
    @InjectRepository(Documento) private readonly docs: Repository<Documento>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  async emitir(dto: CrearHesDto, ctx: ContextoAuditoria): Promise<Documento> {
    // La lectura final va FUERA de la transacción: obtener() usa el repositorio
    // por defecto, que es otra conexión y no ve lo que aún no se confirmó.
    const id = await this.ds.transaction(async (manager) => {
      const oc = await manager.findOne(Documento, {
        where: { id: dto.ocId },
        relations: { detalle: true },
      });

      if (!oc || (oc.tipo !== TipoDocumento.OC && oc.tipo !== TipoDocumento.OC_EXENTA)) {
        throw new NotFoundException(`No existe una OC con id ${dto.ocId}`);
      }

      // El ERP solo controla el avance. La validación del estado se agrega
      // aquí: recibir contra una OC no aprobada o anulada no tiene sentido.
      if (oc.estado !== EstadoDocumento.EMITIDO) {
        throw new ConflictException(
          `La OC ${oc.numdoc} está en estado ${oc.estado}; solo se recibe contra una OC EMITIDO`,
        );
      }
      if (Number(oc.ocAvance) >= 100) {
        throw new ConflictException(`La OC ${oc.numdoc} ya está completa`);
      }

      const porId = new Map(oc.detalle.map((d) => [d.id, d]));
      let montoTotal = 0;
      const lineas: Array<{ origen: DocumentoDetalle; cantidad: number; monto: number; avance: number; comentario: string | null }> = [];

      for (const l of dto.detalle) {
        const origen = porId.get(l.detalleOcId);
        if (!origen) {
          throw new BadRequestException(
            `La línea ${l.detalleOcId} no pertenece a la OC ${oc.numdoc}`,
          );
        }

        const cantidadOc = Number(origen.cantidad);
        const avanceActual = Number(origen.ocAvance);
        const pendiente =
          Math.round(cantidadOc * ((100 - avanceActual) / 100) * 100) / 100;

        if (l.cantidad > pendiente + 1e-9) {
          throw new ConflictException(
            `La línea "${origen.nombre}" tiene ${pendiente} pendiente y se intentan recibir ${l.cantidad}`,
          );
        }

        // Neto unitario ya descontado: preserva la economía de la OC cuando la
        // línea trae descuento, y se reduce a precioUni cuando no lo trae.
        const netoUnitario =
          OrdenCompraService.netoLinea(
            cantidadOc,
            Number(origen.precioUni),
            Number(origen.descuento),
          ) / cantidadOc;

        const monto = Math.round(l.cantidad * netoUnitario * 100) / 100;
        const avance = Math.round((l.cantidad / cantidadOc) * 100 * 10000) / 10000;

        montoTotal += monto;
        lineas.push({ origen, cantidad: l.cantidad, monto, avance, comentario: l.comentario ?? null });
      }

      const netoOc = Number(oc.neto);
      const avanceTot =
        netoOc > 0 ? Math.round((montoTotal / netoOc) * 100 * 10000) / 10000 : 0;

      const [{ nextval }] = await manager.query<[{ nextval: string }]>(
        `SELECT nextval('seq_numdoc_hes')`,
      );

      const hes = await manager.save(
        manager.create(Documento, {
          tipo: TipoDocumento.HES,
          numdoc: Number(nextval),
          proveedorId: oc.proveedorId,
          estado: EstadoDocumento.EMITIDO,
          ocId: oc.id,
          ocAvance: avanceTot,
          ccostoId: oc.ccostoId,
          tipoMoneda: oc.tipoMoneda,
          tipoCambio: oc.tipoCambio,
          neto: Math.round(montoTotal * 100) / 100,
          iva: 0,
          total: Math.round(montoTotal * 100) / 100,
          observacion: dto.observacion ?? null,
          usuarioId: ctx.usuarioId ?? null,
        }),
      );

      for (const l of lineas) {
        await manager.save(
          manager.create(DocumentoDetalle, {
            documentoId: hes.id,
            origenDetalleId: l.origen.id,
            nombre: l.origen.nombre,
            producto: l.origen.producto,
            descripcion: l.origen.descripcion,
            comentario: l.comentario,
            cantidad: l.cantidad,
            unidad: l.origen.unidad,
            precioUni: l.origen.precioUni,
            descuento: 0,
            total: l.monto,
            ocAvance: l.avance,
            ccostoId: l.origen.ccostoId,
            categoriaId: l.origen.categoriaId,
          }),
        );

        // El avance de la línea de la OC sube en el porcentaje recibido.
        await manager.increment(
          DocumentoDetalle,
          { id: l.origen.id },
          'ocAvance',
          l.avance,
        );
      }

      // El de la cabecera sube ponderado por monto.
      await manager.increment(Documento, { id: oc.id }, 'ocAvance', avanceTot);

      await this.auditoria.anotar(
        TipoAccion.INS_REG,
        'documento',
        hes.id,
        ctx,
        `HES ${hes.numdoc} contra OC ${oc.numdoc}`,
        `avance +${avanceTot}%`,
      );

      return hes.id;
    });

    return this.obtener(id);
  }

  async listar(q: PaginacionDto): Promise<RespuestaPaginada<Documento>> {
    const qb = this.docs
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.proveedor', 'proveedor')
      .leftJoinAndSelect('d.oc', 'oc')
      .where('d.tipo = :tipo', { tipo: TipoDocumento.HES });

    if (q.buscar) {
      qb.andWhere(
        '(CAST(d.numdoc AS TEXT) ILIKE :b OR CAST(oc.numdoc AS TEXT) ILIKE :b OR proveedor.nombre ILIKE :b)',
        { b: `%${q.buscar}%` },
      );
    }

    const [datos, total] = await qb
      .orderBy('d.numdoc', 'DESC')
      .skip((q.pagina - 1) * q.limite)
      .take(q.limite)
      .getManyAndCount();

    return paginar(datos, total, q);
  }

  async obtener(id: number): Promise<Documento> {
    const hes = await this.docs.findOne({
      where: { id, tipo: TipoDocumento.HES },
      relations: { proveedor: true, ccosto: true, detalle: true, oc: true },
      order: { detalle: { id: 'ASC' } },
    });
    if (!hes) throw new NotFoundException(`No existe una HES con id ${id}`);
    return hes;
  }

  /**
   * Réplica de ELIMINA_HES: revierte los avances con piso en cero y borra el
   * documento físicamente. La traza queda en `registro`.
   */
  async eliminar(id: number, ctx: ContextoAuditoria): Promise<{ mensaje: string }> {
    return this.ds.transaction(async (manager) => {
      const hes = await manager.findOne(Documento, {
        where: { id, tipo: TipoDocumento.HES },
        relations: { detalle: true },
      });
      if (!hes) throw new NotFoundException(`No existe una HES con id ${id}`);

      if (hes.cargadaABodega) {
        throw new ConflictException(
          'No se puede eliminar una HES que ya fue cargada a bodega',
        );
      }

      for (const linea of hes.detalle) {
        if (!linea.origenDetalleId) continue;
        await manager.query(
          `UPDATE documento_detalle
              SET oc_avance = GREATEST(oc_avance - $1, 0)
            WHERE id = $2`,
          [linea.ocAvance, linea.origenDetalleId],
        );
      }

      if (hes.ocId) {
        await manager.query(
          `UPDATE documento
              SET oc_avance = GREATEST(oc_avance - $1, 0)
            WHERE id = $2`,
          [hes.ocAvance, hes.ocId],
        );
      }

      // El detalle cae por ON DELETE CASCADE.
      await manager.delete(Documento, { id });

      await this.auditoria.anotar(
        TipoAccion.DEL_REG,
        'documento',
        id,
        ctx,
        `Elimina HES ${hes.numdoc}`,
        `revierte ${hes.ocAvance}% de la OC`,
      );

      return { mensaje: `HES ${hes.numdoc} eliminada y avance revertido` };
    });
  }
}

@ApiTags('Compras')
@ApiBearerAuth()
@Controller('compras/hes')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class HesController {
  constructor(private readonly servicio: HesService) {}

  @Get()
  @RequierePermiso('Recepciones (HES)')
  @ApiOperation({ summary: 'Lista las HES emitidas' })
  listar(@Query() q: PaginacionDto): Promise<RespuestaPaginada<Documento>> {
    return this.servicio.listar(q);
  }

  @Get(':id')
  @RequierePermiso('Recepciones (HES)')
  @ApiOperation({ summary: 'Obtiene una HES con su detalle' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<Documento> {
    return this.servicio.obtener(id);
  }

  @Post()
  @RequierePermiso('Recepciones (HES)')
  @ApiOperation({
    summary: 'Emite una HES contra una OC, total o parcial',
    description:
      'Sube el avance de cada línea recibida y, en la cabecera de la OC, ' +
      'el avance ponderado por monto.',
  })
  emitir(@Body() dto: CrearHesDto, @Ctx() ctx: ContextoAuditoria): Promise<Documento> {
    return this.servicio.emitir(dto, ctx);
  }

  @Delete(':id')
  @HttpCode(200)
  @RequierePermiso('Anula HES')
  @ApiOperation({
    summary: 'Elimina una HES y revierte el avance de la OC',
    description:
      'Borrado físico, como en el ERP. No se permite si la HES ya fue ' +
      'cargada a bodega.',
  })
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @Ctx() ctx: ContextoAuditoria,
  ): Promise<{ mensaje: string }> {
    return this.servicio.eliminar(id, ctx);
  }
}
