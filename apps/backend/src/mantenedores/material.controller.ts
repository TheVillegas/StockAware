/**
 * Mantenedor de materiales.
 *
 * El listado sale de la vista `v_material`, que resuelve la categoría — igual
 * que el ERP lista desde `v_materiales`. Las escrituras van contra la tabla.
 */
import {
  Body,
  Controller,
  Get,
  Injectable,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { Material } from '../entities/maestros.entity.js';
import { VMaterial } from '../entities/vistas.entity.js';
import { EstadoMaterial, UnidadMedida } from '../entities/tipos.js';
import { AuditoriaService, Ctx, type ContextoAuditoria } from '../common/auditoria.js';
import { PaginacionDto, paginar, type RespuestaPaginada } from '../common/paginacion.js';
import { MantenedorService } from './mantenedor.service.js';
import { JwtAuthGuard, PermisosGuard, RequierePermiso } from '../common/permisos.js';

export class CrearMaterialDto {
  @ApiProperty({ example: 'MC_011' })
  @IsString()
  @MaxLength(20)
  codMaterial: string;

  @ApiProperty({ example: 'Casco de seguridad amarillo' })
  @IsString()
  @MaxLength(120)
  nombre: string;

  @ApiProperty({ enum: UnidadMedida, example: UnidadMedida.UNI })
  @IsEnum(UnidadMedida)
  unidad: UnidadMedida;

  @ApiPropertyOptional({ enum: EstadoMaterial })
  @IsOptional()
  @IsEnum(EstadoMaterial)
  estado?: EstadoMaterial;

  @ApiPropertyOptional({ description: 'Id de la categoría contable' })
  @IsOptional()
  @IsInt()
  categoriaId?: number;

  @ApiPropertyOptional({ example: 8990, description: 'Último precio conocido' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tarifa?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockMinimo?: number;
}

export class ActualizarMaterialDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) nombre?: string;
  @ApiPropertyOptional({ enum: UnidadMedida }) @IsOptional() @IsEnum(UnidadMedida) unidad?: UnidadMedida;
  @ApiPropertyOptional({ enum: EstadoMaterial }) @IsOptional() @IsEnum(EstadoMaterial) estado?: EstadoMaterial;
  @ApiPropertyOptional() @IsOptional() @IsInt() categoriaId?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) tarifa?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) stockMinimo?: number;
}

@Injectable()
export class MaterialService extends MantenedorService<Material> {
  protected readonly tabla = 'material';
  protected readonly camposBusqueda = ['e.cod_material', 'e.nombre'];
  protected readonly ordenPorDefecto = 'e.cod_material';

  constructor(
    @InjectRepository(Material) repo: Repository<Material>,
    @InjectRepository(VMaterial)
    private readonly vista: Repository<VMaterial>,
    auditoria: AuditoriaService,
  ) {
    super(repo, auditoria);
  }

  protected etiqueta(fila: Material): string {
    return `${fila.codMaterial} ${fila.nombre}`;
  }

  /** Listado del mantenedor: sale de la vista, no de la tabla. */
  async listarVista(q: PaginacionDto): Promise<RespuestaPaginada<VMaterial>> {
    const qb = this.vista.createQueryBuilder('v');

    if (q.buscar) {
      qb.andWhere(
        '(v.cod_material ILIKE :b OR v.nombre ILIKE :b OR v.categoria ILIKE :b)',
        { b: `%${q.buscar}%` },
      );
    }

    const [datos, total] = await qb
      .orderBy('v.cod_material', 'ASC')
      .skip((q.pagina - 1) * q.limite)
      .take(q.limite)
      .getManyAndCount();

    return paginar(datos, total, q);
  }
}

@ApiTags('Mantenedores')
@ApiBearerAuth()
@Controller('mantenedores/materiales')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequierePermiso('Materiales')
export class MaterialController {
  constructor(private readonly servicio: MaterialService) {}

  @Get()
  @ApiOperation({ summary: 'Lista materiales con su categoría resuelta' })
  listar(@Query() q: PaginacionDto): Promise<RespuestaPaginada<VMaterial>> {
    return this.servicio.listarVista(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un material' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<Material> {
    return this.servicio.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un material' })
  crear(
    @Body() dto: CrearMaterialDto,
    @Ctx() ctx: ContextoAuditoria,
  ): Promise<Material> {
    return this.servicio.crear(dto, ctx);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modifica un material' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarMaterialDto,
    @Ctx() ctx: ContextoAuditoria,
  ): Promise<Material> {
    return this.servicio.actualizar(id, dto, ctx);
  }
}
