/**
 * Consulta de stock.
 *
 * En la fase 2 existe solo para verificar el esqueleto de punta a punta: que
 * una @ViewEntity se consulte, que el guard de permisos rechace a quien no
 * corresponde y que Swagger lo documente. Los movimientos y la carga desde HES
 * llegan en la fase 5.
 */
import { Controller, Get, Module, Query, UseGuards } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { VMaterialBodega } from '../entities/vistas.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard, PermisosGuard, RequierePermiso } from '../common/permisos.js';

@ApiTags('Inventario')
@ApiBearerAuth()
@Controller('inventario')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class InventarioController {
  constructor(
    @InjectRepository(VMaterialBodega)
    private readonly stock: Repository<VMaterialBodega>,
  ) {}

  @Get('stock')
  @RequierePermiso('Stock por bodega')
  @ApiOperation({ summary: 'Saldo de materiales por bodega' })
  @ApiQuery({ name: 'bodega', required: false, description: 'Código de bodega' })
  @ApiQuery({
    name: 'bajoMinimo',
    required: false,
    description: 'Solo los que están bajo su stock mínimo',
  })
  @ApiForbiddenResponse({ description: 'El perfil no tiene el permiso requerido' })
  async listar(
    @Query('bodega') bodega?: string,
    @Query('bajoMinimo') bajoMinimo?: string,
  ): Promise<VMaterialBodega[]> {
    const qb = this.stock.createQueryBuilder('v');

    if (bodega) {
      qb.andWhere('v.bodega_codigo = :bodega', { bodega: Number(bodega) });
    }
    if (bajoMinimo === 'true') {
      qb.andWhere('v.bajo_minimo = true');
    }

    return qb.orderBy('v.cod_material', 'ASC').getMany();
  }
}

@Module({
  // AuthModule aporta PassportModule, que es lo que JwtAuthGuard necesita.
  imports: [TypeOrmModule.forFeature([VMaterialBodega]), AuthModule],
  controllers: [InventarioController],
})
export class InventarioModule {}
