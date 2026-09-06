/** Mantenedor de bodegas. */
import {
  Body, Controller, Get, Injectable, Param, ParseIntPipe, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type SelectQueryBuilder } from 'typeorm';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { Bodega } from '../entities/maestros.entity.js';
import { EstadoBodega } from '../entities/tipos.js';
import { AuditoriaService, Ctx, type ContextoAuditoria } from '../common/auditoria.js';
import { PaginacionDto, type RespuestaPaginada } from '../common/paginacion.js';
import { MantenedorService } from './mantenedor.service.js';
import { JwtAuthGuard, PermisosGuard, RequierePermiso } from '../common/permisos.js';

export class CrearBodegaDto {
  @ApiProperty({ example: 3, description: 'Código numérico, único' })
  @IsInt() @Min(1) codigo: number;

  @ApiProperty({ example: 'Bodega Norte' })
  @IsString() @MaxLength(60) descripcion: string;

  @ApiPropertyOptional({ enum: EstadoBodega })
  @IsOptional() @IsEnum(EstadoBodega) estado?: EstadoBodega;

  @ApiPropertyOptional({ description: 'Centro de costo al que imputa' })
  @IsOptional() @IsInt() ccostoId?: number;

  @ApiPropertyOptional({ description: 'Usuario responsable' })
  @IsOptional() @IsInt() responsableId?: number;
}

export class ActualizarBodegaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) descripcion?: string;
  @ApiPropertyOptional({ enum: EstadoBodega }) @IsOptional() @IsEnum(EstadoBodega) estado?: EstadoBodega;
  @ApiPropertyOptional() @IsOptional() @IsInt() ccostoId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() responsableId?: number;
}

@Injectable()
export class BodegaService extends MantenedorService<Bodega> {
  protected readonly tabla = 'bodega';
  protected readonly camposBusqueda = ['e.descripcion', 'e.codigo'];
  protected readonly ordenPorDefecto = 'e.codigo';

  constructor(
    @InjectRepository(Bodega) repo: Repository<Bodega>,
    auditoria: AuditoriaService,
  ) {
    super(repo, auditoria);
  }

  protected etiqueta(fila: Bodega): string {
    return `${fila.codigo} ${fila.descripcion}`;
  }

  /** El listado trae resueltos el centro de costo y el responsable. */
  protected prepararConsulta(qb: SelectQueryBuilder<Bodega>): SelectQueryBuilder<Bodega> {
    return qb
      .leftJoinAndSelect('e.ccosto', 'ccosto')
      .leftJoinAndSelect('e.responsable', 'responsable');
  }
}

@ApiTags('Mantenedores')
@ApiBearerAuth()
@Controller('mantenedores/bodegas')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequierePermiso('Bodegas')
export class BodegaController {
  constructor(private readonly servicio: BodegaService) {}

  @Get()
  @ApiOperation({ summary: 'Lista bodegas' })
  listar(@Query() q: PaginacionDto): Promise<RespuestaPaginada<Bodega>> {
    return this.servicio.listar(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene una bodega' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<Bodega> {
    return this.servicio.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea una bodega' })
  crear(@Body() dto: CrearBodegaDto, @Ctx() ctx: ContextoAuditoria): Promise<Bodega> {
    return this.servicio.crear(dto, ctx);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modifica una bodega' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarBodegaDto,
    @Ctx() ctx: ContextoAuditoria,
  ): Promise<Bodega> {
    return this.servicio.actualizar(id, dto, ctx);
  }
}
