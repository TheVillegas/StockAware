import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { configuracion, opcionesTypeOrm } from './config/configuracion.js';
import { AuditoriaModule } from './common/auditoria.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health/health.controller.js';
import { InventarioModule } from './inventario/inventario.module.js';
import { MantenedoresModule } from './mantenedores/mantenedores.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuracion],
      // El .env vive en la raíz del repositorio, compartido con docker-compose,
      // para no tener las credenciales de la base escritas en dos lugares.
      envFilePath: ['../../.env', '.env'],
    }),
    TypeOrmModule.forRootAsync({ useFactory: opcionesTypeOrm }),
    AuditoriaModule,
    AuthModule,
    InventarioModule,
    MantenedoresModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
