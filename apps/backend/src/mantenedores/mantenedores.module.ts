<<<<<<< Updated upstream
/**
 * Mantenedores de tablas maestras.
 *
 * Cada uno está detrás del permiso de su función, con las mismas glosas que
 * usa el árbol de acceso del ERP: 'Materiales', 'Bodegas', 'Proveedores',
 * 'Categorías' y 'Centros de costo'.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import {
  Bodega,
  Categoria,
  CentroCosto,
  Material,
  Proveedor,
} from '../entities/maestros.entity.js';
import { VMaterial } from '../entities/vistas.entity.js';

import { MaterialController, MaterialService } from './material.controller.js';
import { BodegaController, BodegaService } from './bodega.controller.js';
import { ProveedorController, ProveedorService } from './proveedor.controller.js';
import { CategoriaController, CategoriaService } from './categoria.controller.js';
import {
  CentroCostoController,
  CentroCostoService,
} from './centro-costo.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Material,
      VMaterial,
      Bodega,
      Proveedor,
      Categoria,
      CentroCosto,
    ]),
    // Aporta PassportModule, que JwtAuthGuard necesita en este inyector.
    AuthModule,
  ],
  controllers: [
    MaterialController,
    BodegaController,
    ProveedorController,
    CategoriaController,
    CentroCostoController,
  ],
  providers: [
    MaterialService,
    BodegaService,
    ProveedorService,
    CategoriaService,
    CentroCostoService,
  ],
=======
import { Module } from '@nestjs/common';
import { MantenedoresController } from './mantenedores.controller';
import { MantenedoresService } from './mantenedores.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MantenedoresController],
  providers: [MantenedoresService],
>>>>>>> Stashed changes
})
export class MantenedoresModule {}
