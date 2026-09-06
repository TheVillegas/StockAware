import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { configuracion, opcionesTypeOrm } from './config/configuracion.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health/health.controller.js';
import { InventarioModule } from './inventario/inventario.module.js';

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
    AuthModule,
    InventarioModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
