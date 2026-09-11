import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaService } from './auditoria.service';
import { PermisosGuard } from './permisos.guard';
import { Registro } from '../entidades/acceso.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Registro])],
  providers: [AuditoriaService, PermisosGuard],
  exports: [AuditoriaService, PermisosGuard, TypeOrmModule],
})
export class ComunModule {}
