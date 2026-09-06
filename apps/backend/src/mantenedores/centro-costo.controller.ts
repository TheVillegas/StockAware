/** Mantenedor de centros de costo. */
import {
  Body, Controller, Get, Injectable, Param, ParseIntPipe, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type SelectQueryBuilder } from 'typeorm';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min,
} from 'class-validator';

import { CentroCosto } from '../entities/maestros.entity.js';
import { EstadoCcosto } from '../entities/tipos.js';
import { AuditoriaService, Ctx, type ContextoAuditoria } from '../common/auditoria.js';
import { PaginacionDto, type RespuestaPaginada } from '../common/paginacion.js';
import { MantenedorService } from './mantenedor.service.js';
import { JwtAuthGuard, PermisosGuard, RequierePermiso } from '../common/permisos.js';

export class CrearCentroCostoDto {
  @ApiProperty({ example: 'CC-OBRA-02', description: 'Código único' })
  @IsString() @MaxLength(50) ccosto: string;

  @ApiPropertyOptional({ example: 'Ampliación planta' })
  @IsOptional() @IsString() @MaxLength(50) proyecto?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional() @IsDateString() fechaInicio?: string;

  @ApiPropertyOptional({ example: '2027-03-01' })
  @IsOptional() @IsDateString() fechaFin?: string;

  @ApiPropertyOptional({ example: 8000000 })
  @IsOptional() @IsNumber() @Min(0) presupuesto?: number;

  @ApiPropertyOptional({ example: 6722689 })
  @IsOptional() @IsNumber() @Min(0) presupuestoNeto?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() responsableId?: number;
}

export class ActualizarCentroCostoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) proyecto?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() fechaInicio?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() fechaFin?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) presupuesto?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) presupuestoNeto?: number;
  @ApiPropertyOptional({ enum: EstadoCcosto }) @IsOptional() @IsEnum(EstadoCcosto) estado?: EstadoCcosto;
  @ApiPropertyOptional() @IsOptional() @IsInt() responsableId?: number;
}

@Injectable()
export class CentroCostoService extends MantenedorService<CentroCosto> {
  protected readonly tabla = 'centro_costo';
  protected readonly camposBusqueda = ['e.ccosto', 'e.proyecto'];
  protected readonly ordenPorDefecto = 'e.ccosto';

  constructor(
    @InjectRepository(CentroCosto) repo: Repository<CentroCosto>,
    auditoria: AuditoriaService,
  ) {
    super(repo, auditoria);
  }

  protected etiqueta(fila: CentroCosto): string {
    return `${fila.ccosto} ${fila.proyecto}`.trim();
  }

  protected prepararConsulta(qb: SelectQueryBuilder<CentroCosto>): SelectQueryBuilder<CentroCosto> {
    return qb.leftJoinAndSelect('e.responsable', 'responsable');
  }
}

@ApiTags('Mantenedores')
@ApiBearerAuth()
@Controller('mantenedores/centros-costo')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequierePermiso('Centros de costo')
export class CentroCostoController {
  constructor(private readonly servicio: CentroCostoService) {}

  @Get()
  @ApiOperation({ summary: 'Lista centros de costo' })
  listar(@Query() q: PaginacionDto): Promise<RespuestaPaginada<CentroCosto>> {
    return this.servicio.listar(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un centro de costo' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<CentroCosto> {
    return this.servicio.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un centro de costo' })
  crear(@Body() dto: CrearCentroCostoDto, @Ctx() ctx: ContextoAuditoria): Promise<CentroCosto> {
    return this.servicio.crear(dto, ctx);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modifica un centro de costo' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCentroCostoDto,
    @Ctx() ctx: ContextoAuditoria,
  ): Promise<CentroCosto> {
    return this.servicio.actualizar(id, dto, ctx);
  }
}
