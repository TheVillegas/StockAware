import { Module } from '@nestjs/common';

import { PreciosRepositorio } from './precios.repositorio';

/** Persistencia de precios externos. Sin controladores: los endpoints llegan en PR posteriores. */
@Module({
  providers: [PreciosRepositorio],
  exports: [PreciosRepositorio],
})
export class PreciosModule {}
