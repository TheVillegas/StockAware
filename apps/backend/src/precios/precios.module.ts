import { Module } from '@nestjs/common';

import { InteligenciaModule } from '../inteligencia/inteligencia.module';
import { ConsultaPreciosService } from './consulta/consulta.service';
import { ConsultaRepositorio } from './consulta/consulta.repositorio';
import { RecuperadorFuentes } from './fuentes/recuperador';
import { PreciosRepositorio } from './precios.repositorio';

/** Precios externos: persistencia, lectura de fuentes y consulta por material. */
@Module({
  imports: [InteligenciaModule],
  providers: [PreciosRepositorio, ConsultaRepositorio, RecuperadorFuentes, ConsultaPreciosService],
  exports: [PreciosRepositorio],
})
export class PreciosModule {}
