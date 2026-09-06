/**
 * Mantenedor de categorías.
 *
 * Jerarquía de tres niveles: CAT → SUB → IND, encadenada por `padreId`. El
 * endpoint /arbol la devuelve anidada, que es como la necesita un selector en
 * cascada.
 */
import {
  Body, Controller, Get, Injectable, Param, ParseIntPipe, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type SelectQueryBuilder } from 'typeorm';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

import { Categoria } from '../entities/maestros.entity.js';
import { TipoCategoria } from '../entities/tipos.js';
import { AuditoriaService, Ctx, type ContextoAuditoria } from '../common/auditoria.js';
import { PaginacionDto, type RespuestaPaginada } from '../common/paginacion.js';
import { MantenedorService } from './mantenedor.service.js';
import { JwtAuthGuard, PermisosGuard, RequierePermiso } from '../common/permisos.js';

export class CrearCategoriaDto {
  @ApiProperty({ enum: TipoCategoria, description: 'Nivel: CAT, SUB o IND' })
  @IsEnum(TipoCategoria) tipo: TipoCategoria;

  @ApiProperty({ example: 'EPP-PIE' })
  @IsString() @MaxLength(15) codigo: string;

  @ApiProperty({ example: 'Protección de pies' })
  @IsString() @MaxLength(60) glosa: string;

  @ApiPropertyOptional({ description: 'Categoría padre. Las CAT no llevan.' })
  @IsOptional() @IsInt() padreId?: number;
}

export class ActualizarCategoriaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) glosa?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() padreId?: number;
  @ApiPropertyOptional({ description: 'Dar de baja sin borrar' })
  @IsOptional() @IsBoolean() activa?: boolean;
}

export interface NodoCategoria {
  id: number;
  tipo: TipoCategoria;
  codigo: string;
  glosa: string;
  activa: boolean;
  hijos: NodoCategoria[];
}

@Injectable()
export class CategoriaService extends MantenedorService<Categoria> {
  protected readonly tabla = 'categoria';
  protected readonly camposBusqueda = ['e.codigo', 'e.glosa'];
  protected readonly ordenPorDefecto = 'e.codigo';

  constructor(
    @InjectRepository(Categoria) repo: Repository<Categoria>,
    auditoria: AuditoriaService,
  ) {
    super(repo, auditoria);
  }

  protected etiqueta(fila: Categoria): string {
    return `${fila.tipo} ${fila.codigo} ${fila.glosa}`;
  }

  protected prepararConsulta(qb: SelectQueryBuilder<Categoria>): SelectQueryBuilder<Categoria> {
    return qb.leftJoinAndSelect('e.padre', 'padre');
  }

  /** Arma el árbol en memoria: son ~300 filas, no justifica una consulta recursiva. */
  async arbol(): Promise<NodoCategoria[]> {
    const filas = await this.repo.find({ order: { codigo: 'ASC' } });

    const nodos = new Map<number, NodoCategoria>(
      filas.map((f) => [
        f.id,
        { id: f.id, tipo: f.tipo, codigo: f.codigo, glosa: f.glosa, activa: f.activa, hijos: [] },
      ]),
    );

    const raices: NodoCategoria[] = [];
    for (const f of filas) {
      const nodo = nodos.get(f.id)!;
      const padre = f.padreId ? nodos.get(f.padreId) : undefined;
      if (padre) padre.hijos.push(nodo);
      else raices.push(nodo);
    }
    return raices;
  }
}

@ApiTags('Mantenedores')
@ApiBearerAuth()
@Controller('mantenedores/categorias')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequierePermiso('Categorías')
export class CategoriaController {
  constructor(private readonly servicio: CategoriaService) {}

  @Get()
  @ApiOperation({ summary: 'Lista categorías en plano' })
  listar(@Query() q: PaginacionDto): Promise<RespuestaPaginada<Categoria>> {
    return this.servicio.listar(q);
  }

  @Get('arbol')
  @ApiOperation({ summary: 'Devuelve la jerarquía completa anidada' })
  arbol(): Promise<NodoCategoria[]> {
    return this.servicio.arbol();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene una categoría' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<Categoria> {
    return this.servicio.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea una categoría' })
  crear(@Body() dto: CrearCategoriaDto, @Ctx() ctx: ContextoAuditoria): Promise<Categoria> {
    return this.servicio.crear(dto, ctx);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modifica una categoría' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCategoriaDto,
    @Ctx() ctx: ContextoAuditoria,
  ): Promise<Categoria> {
    return this.servicio.actualizar(id, dto, ctx);
  }
}
