import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { InteligenciaModule } from '../inteligencia/inteligencia.module';
import { ConsultaPreciosService } from './consulta/consulta.service';
import { ConsultaRepositorio } from './consulta/consulta.repositorio';
import { RecuperadorFuentes } from './fuentes/recuperador';
import { PreciosController } from './precios.controller';
import { PreciosRepositorio } from './precios.repositorio';

/** Precios externos: persistencia, lectura de fuentes y consulta por material. */
@Module({
  imports: [AuthModule, InteligenciaModule],
  controllers: [PreciosController],
  providers: [PreciosRepositorio, ConsultaRepositorio, RecuperadorFuentes, ConsultaPreciosService],
  exports: [PreciosRepositorio],
})
export class PreciosModule {}
