import { Module } from '@nestjs/common';
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
})
export class ComprasModule {}
