import { Module } from '@nestjs/common';
<<<<<<< Updated upstream
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { Bodega, Material } from '../entities/maestros.entity.js';
import { Documento } from '../entities/documentos.entity.js';
import { MaterialBodega, MovimientoBodega } from '../entities/inventario.entity.js';
import { VMaterialBodega, VMovimientoBodega } from '../entities/vistas.entity.js';
import { BodegaController } from './bodega.controller.js';
import { BodegaService } from './bodega.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Bodega, Material, Documento, MaterialBodega, MovimientoBodega,
      VMaterialBodega, VMovimientoBodega,
    ]),
    AuthModule,
  ],
=======
import { BodegaController } from './bodega.controller';
import { BodegaService } from './bodega.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
>>>>>>> Stashed changes
  controllers: [BodegaController],
  providers: [BodegaService],
})
export class BodegaModule {}
