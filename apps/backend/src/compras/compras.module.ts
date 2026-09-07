import { Module } from '@nestjs/common';
<<<<<<< Updated upstream
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { Documento, DocumentoDetalle } from '../entities/documentos.entity.js';
import { Parametro } from '../entities/sistema.entity.js';
import {
  OrdenCompraController,
  OrdenCompraService,
} from './orden-compra.controller.js';
import { HesController, HesService } from './hes.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Documento, DocumentoDetalle, Parametro]),
    AuthModule,
  ],
  controllers: [OrdenCompraController, HesController],
  providers: [OrdenCompraService, HesService],
  exports: [OrdenCompraService, HesService],
=======
import { ComprasController } from './compras.controller';
import { ComprasService } from './compras.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ComprasController],
  providers: [ComprasService],
>>>>>>> Stashed changes
})
export class ComprasModule {}
