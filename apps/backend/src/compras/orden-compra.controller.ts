/**
 * Órdenes de compra.
 *
 * Ciclo replicado del ERP: PENDIENTE → EMITIDO (aprobada) → ELIMINADO (anulada).
 *
 * Dos rarezas del original que se conservan y conviene tener presentes:
 *
 *  - "Anular" una OC la deja en estado ELIMINADO, no ANULADO, aunque la acción
 *    se llame ANULA_OC (DLL.php, caso ANULA_OC). El enumerado tiene los dos
 *    valores y el ERP usa el segundo.
 *  - La precondición para anular es que ningún documento la referencie. En el
 *    ERP se revisan HES, facturas y pagos; aquí, con factura y pagos fuera del
 *    alcance, queda solo la HES.
 */
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, type EntityManager } from 'typeorm';
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
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { Documento, DocumentoDetalle } from '../entities/documentos.entity.js';
import { Parametro } from '../entities/sistema.entity.js';
import {
  EstadoDocumento,
  TipoDocumento,
  TipoMoneda,
} from '../entities/tipos.js';
import { TipoAccion } from '../entities/tipos.js';
import { AuditoriaService, Ctx, type ContextoAuditoria } from '../common/auditoria.js';
import { PaginacionDto, paginar, type RespuestaPaginada } from '../common/paginacion.js';
import { JwtAuthGuard, PermisosGuard, RequierePermiso } from '../common/permisos.js';

// ---------------------------------------------------------------------------
//  DTOs
// ---------------------------------------------------------------------------

export class LineaOcDto {
  @ApiProperty({
    example: 'Guante cabritilla talla 9/MC_002',
    description:
      'Descripción de la línea. El código del material va embebido con el ' +
      'formato "TEXTO/MC_nnn": así lo hace el ERP y así lo lee la carga a bodega.',
  })
  @IsString()
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional({ description: 'Código del producto del proveedor' })
  @IsOptional() @IsString() @MaxLength(20) producto?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(512) descripcion?: string;

  @ApiProperty({ example: 10 })
  @IsNumber() @Min(0.01) cantidad: number;

  @ApiPropertyOptional({ example: 'PAR', default: 'KG' })
  @IsOptional() @IsString() @MaxLength(20) unidad?: string;

  @ApiProperty({ example: 4500 })
  @IsNumber() @Min(0) precioUni: number;

  @ApiPropertyOptional({ example: 0, description: 'Descuento en pesos sobre la línea' })
  @IsOptional() @IsNumber() @Min(0) descuento?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() ccostoId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() categoriaId?: number;
}

export class CrearOcDto {
  @ApiPropertyOptional({
    enum: [TipoDocumento.OC, TipoDocumento.OC_EXENTA],
    default: TipoDocumento.OC,
    description: 'OC_EXENTA no lleva IVA',
  })
  @IsOptional()
  @IsEnum(TipoDocumento)
  tipo?: TipoDocumento.OC | TipoDocumento.OC_EXENTA;

  @ApiProperty({ example: 1 })
  @IsInt() proveedorId: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() ccostoId?: number;

  @ApiPropertyOptional({ enum: TipoMoneda, default: TipoMoneda.CLP })
  @IsOptional() @IsEnum(TipoMoneda) tipoMoneda?: TipoMoneda;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @IsNumber() @Min(0.0001) tipoCambio?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1024) observacion?: string;

  @ApiProperty({ type: [LineaOcDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaOcDto)
  detalle: LineaOcDto[];
}

export class FiltroOcDto extends PaginacionDto {
  @ApiPropertyOptional({ enum: EstadoDocumento })
  @IsOptional() @IsEnum(EstadoDocumento) estado?: EstadoDocumento;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() proveedorId?: number;
}

// ---------------------------------------------------------------------------
//  Servicio
// ---------------------------------------------------------------------------

@Injectable()
export class OrdenCompraService {
  constructor(
    @InjectRepository(Documento) private readonly docs: Repository<Documento>,
    @InjectRepository(Parametro) private readonly parametros: Repository<Parametro>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** El neto de una línea ya descontado. Es la base de todos los cálculos. */
  static netoLinea(cantidad: number, precioUni: number, descuento = 0): number {
    return Math.round((cantidad * precioUni - descuento) * 100) / 100;
  }

  private async tasaIva(manager: EntityManager): Promise<number> {
    const p = await manager.findOne(Parametro, { where: { nombre: 'IVA' } });
    return p ? Number(p.valor) : 0.19;
  }

  private async siguienteNumdoc(
    manager: EntityManager,
    tipo: TipoDocumento,
  ): Promise<number> {
    const secuencia =
      tipo === TipoDocumento.OC_EXENTA ? 'seq_numdoc_oc_exenta' : 'seq_numdoc_oc';
    const [{ nextval }] = await manager.query<[{ nextval: string }]>(
      `SELECT nextval('${secuencia}')`,
    );
    return Number(nextval);
  }

  async crear(dto: CrearOcDto, ctx: ContextoAuditoria): Promise<Documento> {
    const tipo = dto.tipo ?? TipoDocumento.OC;

    // La lectura final va FUERA de la transacción: obtener() usa el repositorio
    // por defecto, que es otra conexión y no ve lo que aún no se confirmó.
    const id = await this.ds.transaction(async (manager) => {
      const neto = dto.detalle.reduce(
        (acc, l) =>
          acc + OrdenCompraService.netoLinea(l.cantidad, l.precioUni, l.descuento ?? 0),
        0,
      );
      const iva =
        tipo === TipoDocumento.OC_EXENTA
          ? 0
          : Math.round(neto * (await this.tasaIva(manager)));

      const oc = manager.create(Documento, {
        tipo,
        numdoc: await this.siguienteNumdoc(manager, tipo),
        proveedorId: dto.proveedorId,
        estado: EstadoDocumento.PENDIENTE,
        ccostoId: dto.ccostoId ?? null,
        tipoMoneda: dto.tipoMoneda ?? TipoMoneda.CLP,
        tipoCambio: dto.tipoCambio ?? 1,
        observacion: dto.observacion ?? null,
        usuarioId: ctx.usuarioId ?? null,
        neto: Math.round(neto * 100) / 100,
        iva,
        total: Math.round((neto + iva) * 100) / 100,
      });
      const guardada = await manager.save(oc);

      for (const l of dto.detalle) {
        await manager.save(
          manager.create(DocumentoDetalle, {
            documentoId: guardada.id,
            nombre: l.nombre,
            producto: l.producto ?? null,
            descripcion: l.descripcion ?? '',
            cantidad: l.cantidad,
            unidad: l.unidad ?? 'KG',
            precioUni: l.precioUni,
            descuento: l.descuento ?? 0,
            total: OrdenCompraService.netoLinea(l.cantidad, l.precioUni, l.descuento ?? 0),
            ccostoId: l.ccostoId ?? null,
            categoriaId: l.categoriaId ?? null,
          }),
        );
      }

      await this.auditoria.anotar(
        TipoAccion.INS_REG,
        'documento',
        guardada.id,
        ctx,
        `${tipo} ${guardada.numdoc} - ${dto.detalle.length} líneas`,
      );

      return guardada.id;
    });

    return this.obtener(id);
  }

  async listar(q: FiltroOcDto): Promise<RespuestaPaginada<Documento>> {
    const qb = this.docs
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.proveedor', 'proveedor')
      .leftJoinAndSelect('d.ccosto', 'ccosto')
      .where('d.tipo IN (:...tipos)', {
        tipos: [TipoDocumento.OC, TipoDocumento.OC_EXENTA],
      });

    if (q.estado) qb.andWhere('d.estado = :estado', { estado: q.estado });
    if (q.proveedorId) qb.andWhere('d.proveedor_id = :p', { p: q.proveedorId });
    if (q.buscar) {
      qb.andWhere(
        '(CAST(d.numdoc AS TEXT) ILIKE :b OR proveedor.nombre ILIKE :b)',
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
    const oc = await this.docs.findOne({
      where: { id },
      relations: { proveedor: true, ccosto: true, detalle: true, usuario: true },
      order: { detalle: { id: 'ASC' } },
    });

    if (!oc || (oc.tipo !== TipoDocumento.OC && oc.tipo !== TipoDocumento.OC_EXENTA)) {
      throw new NotFoundException(`No existe una orden de compra con id ${id}`);
    }
    return oc;
  }

  /** Las HES emitidas contra esta OC. */
  async hesDe(id: number): Promise<Documento[]> {
    await this.obtener(id);
    return this.docs.find({
      where: { ocId: id, tipo: TipoDocumento.HES },
      order: { numdoc: 'ASC' },
    });
  }

  /** PENDIENTE → EMITIDO. Réplica de APRUEBA_OC. */
  async aprobar(id: number, ctx: ContextoAuditoria): Promise<Documento> {
    const oc = await this.obtener(id);

    if (oc.estado !== EstadoDocumento.PENDIENTE) {
      throw new ConflictException(
        `Solo se aprueba una OC en estado PENDIENTE; esta está en ${oc.estado}`,
      );
    }

    await this.docs.update(id, { estado: EstadoDocumento.EMITIDO });
    await this.auditoria.anotar(
      TipoAccion.MOD_REG,
      'documento',
      id,
      ctx,
      `Aprueba OC ${oc.numdoc}`,
      'PENDIENTE -> EMITIDO',
    );
    return this.obtener(id);
  }

  /**
   * Réplica de ANULA_OC: solo si ningún documento la referencia, y el estado
   * resultante es ELIMINADO.
   */
  async anular(id: number, ctx: ContextoAuditoria): Promise<Documento> {
    const oc = await this.obtener(id);

    if (oc.estado === EstadoDocumento.ELIMINADO) {
      throw new ConflictException('La OC ya está anulada');
    }

    const hes = await this.docs.count({
      where: { ocId: id, tipo: TipoDocumento.HES },
    });
    if (hes > 0) {
      throw new ConflictException(
        `No se puede anular la OC ${oc.numdoc}: existen ${hes} HES que la referencian`,
      );
    }

    await this.docs.update(id, { estado: EstadoDocumento.ELIMINADO });
    await this.auditoria.anotar(
      TipoAccion.MOD_REG,
      'documento',
      id,
      ctx,
      `Anula OC ${oc.numdoc}`,
      `${oc.estado} -> ELIMINADO`,
    );
    return this.obtener(id);
  }
}

// ---------------------------------------------------------------------------
//  Controlador
// ---------------------------------------------------------------------------

@ApiTags('Compras')
@ApiBearerAuth()
@Controller('compras/ordenes')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class OrdenCompraController {
  constructor(private readonly servicio: OrdenCompraService) {}

  @Get()
  @RequierePermiso('Órdenes de compra')
  @ApiOperation({ summary: 'Lista órdenes de compra' })
  listar(@Query() q: FiltroOcDto): Promise<RespuestaPaginada<Documento>> {
    return this.servicio.listar(q);
  }

  @Get(':id')
  @RequierePermiso('Órdenes de compra')
  @ApiOperation({ summary: 'Obtiene una OC con su detalle' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<Documento> {
    return this.servicio.obtener(id);
  }

  @Get(':id/hes')
  @RequierePermiso('Órdenes de compra')
  @ApiOperation({ summary: 'Lista las HES emitidas contra esta OC' })
  hes(@Param('id', ParseIntPipe) id: number): Promise<Documento[]> {
    return this.servicio.hesDe(id);
  }

  @Post()
  @RequierePermiso('Órdenes de compra')
  @ApiOperation({ summary: 'Crea una OC en estado PENDIENTE' })
  crear(@Body() dto: CrearOcDto, @Ctx() ctx: ContextoAuditoria): Promise<Documento> {
    return this.servicio.crear(dto, ctx);
  }

  @Post(':id/aprobar')
  @RequierePermiso('Aprueba OC')
  @ApiOperation({ summary: 'Aprueba la OC: PENDIENTE pasa a EMITIDO' })
  aprobar(
    @Param('id', ParseIntPipe) id: number,
    @Ctx() ctx: ContextoAuditoria,
  ): Promise<Documento> {
    return this.servicio.aprobar(id, ctx);
  }

  @Post(':id/anular')
  @RequierePermiso('Anula OC')
  @ApiOperation({
    summary: 'Anula la OC. Falla si alguna HES la referencia.',
  })
  anular(
    @Param('id', ParseIntPipe) id: number,
    @Ctx() ctx: ContextoAuditoria,
  ): Promise<Documento> {
    return this.servicio.anular(id, ctx);
  }
}
