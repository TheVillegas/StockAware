import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { InteligenciaModule } from '../inteligencia/inteligencia.module';
import { PermisoRecomendaciones } from './permiso';
import { RecomendacionesController } from './recomendaciones.controller';
import { RecomendacionesRepositorio } from './recomendaciones.repositorio';
import { RecomendacionesService } from './recomendaciones.service';

/** Recomendaciones de reposicion: ranking explicable (FastAPI), regla base, y decisiones de la persona. */
@Module({
  imports: [AuthModule, InteligenciaModule],
  controllers: [RecomendacionesController],
  providers: [RecomendacionesRepositorio, RecomendacionesService, PermisoRecomendaciones],
})
export class RecomendacionesModule {}
