/** Mantenedor de proveedores. */
import {
  Body, Controller, Get, Injectable, Param, ParseIntPipe, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type SelectQueryBuilder } from 'typeorm';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsEmail, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';

import { Proveedor } from '../entities/maestros.entity.js';
import { EstadoGenerico } from '../entities/tipos.js';
import { AuditoriaService, Ctx, type ContextoAuditoria } from '../common/auditoria.js';
import { PaginacionDto, type RespuestaPaginada } from '../common/paginacion.js';
import { MantenedorService } from './mantenedor.service.js';
import { JwtAuthGuard, PermisosGuard, RequierePermiso } from '../common/permisos.js';

export class CrearProveedorDto {
  @ApiProperty({ example: '76000003-5', description: 'RUT con guion y dígito verificador' })
  @IsString() @MaxLength(15) rut: string;

  @ApiProperty({ example: 'Ferretería Ejemplo' })
  @IsString() @MaxLength(50) nombre: string;

  @ApiPropertyOptional({ example: 'SpA', description: 'Razón social o segundo apellido' })
  @IsOptional() @IsString() @MaxLength(50) apellido?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) direccion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) comuna?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) ciudad?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) fono?: string;

  @ApiPropertyOptional({ example: 'ventas@proveedor.local' })
  @IsOptional() @IsEmail() @MaxLength(80) email?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) contacto?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() categoriaId?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional() @IsInt() @Min(0) @Max(365) diasPlazoPago?: number;
}

export class ActualizarProveedorDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) nombre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) apellido?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) direccion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) comuna?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) ciudad?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) fono?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(80) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) contacto?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() categoriaId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(365) diasPlazoPago?: number;
  @ApiPropertyOptional({ enum: EstadoGenerico }) @IsOptional() @IsEnum(EstadoGenerico) estado?: EstadoGenerico;
}

@Injectable()
export class ProveedorService extends MantenedorService<Proveedor> {
  protected readonly tabla = 'proveedor';
  protected readonly camposBusqueda = ['e.rut', 'e.nombre', 'e.apellido', 'e.email'];
  protected readonly ordenPorDefecto = 'e.nombre';

  constructor(
    @InjectRepository(Proveedor) repo: Repository<Proveedor>,
    auditoria: AuditoriaService,
  ) {
    super(repo, auditoria);
  }

  protected etiqueta(fila: Proveedor): string {
    return `${fila.rut} ${fila.nombre}`;
  }

  protected prepararConsulta(qb: SelectQueryBuilder<Proveedor>): SelectQueryBuilder<Proveedor> {
    return qb.leftJoinAndSelect('e.categoria', 'categoria');
  }
}

@ApiTags('Mantenedores')
@ApiBearerAuth()
@Controller('mantenedores/proveedores')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequierePermiso('Proveedores')
export class ProveedorController {
  constructor(private readonly servicio: ProveedorService) {}

  @Get()
  @ApiOperation({ summary: 'Lista proveedores' })
  listar(@Query() q: PaginacionDto): Promise<RespuestaPaginada<Proveedor>> {
    return this.servicio.listar(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un proveedor' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<Proveedor> {
    return this.servicio.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un proveedor' })
  crear(@Body() dto: CrearProveedorDto, @Ctx() ctx: ContextoAuditoria): Promise<Proveedor> {
    return this.servicio.crear(dto, ctx);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modifica un proveedor' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarProveedorDto,
    @Ctx() ctx: ContextoAuditoria,
  ): Promise<Proveedor> {
    return this.servicio.actualizar(id, dto, ctx);
  }
}
