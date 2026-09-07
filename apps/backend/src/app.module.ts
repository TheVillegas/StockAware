<<<<<<< Updated upstream
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { configuracion, opcionesTypeOrm } from './config/configuracion.js';
import { AuditoriaModule } from './common/auditoria.js';
import { AuthModule } from './auth/auth.module.js';
import { ComprasModule } from './compras/compras.module.js';
import { HealthController } from './health/health.controller.js';
import { BodegaModule } from './bodega/bodega.module.js';
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
    ComprasModule,
    BodegaModule,
    MantenedoresModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
=======
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { BodegaModule } from './bodega/bodega.module';
import { ComprasModule } from './compras/compras.module';
import { DistribucionModule } from './distribucion/distribucion.module';
import { ComunModule } from './comun/comun.module';
import { PeticionesMiddleware } from './comun/peticiones.middleware';
import { MantenedoresModule } from './mantenedores/mantenedores.module';
import { MenuModule } from './menu/menu.module';
import * as entidades from './entidades/acceso.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        type: 'postgres' as const,
        host: c.get<string>('PG_HOST'),
        port: Number(c.get<string>('PG_PORT')),
        username: c.get<string>('PG_USER'),
        password: c.get<string>('PG_PASSWORD'),
        database: c.get<string>('PG_DATABASE'),
        entities: Object.values(entidades).filter((e) => typeof e === 'function'),
        // Jamas: el esquema lo manda 01_schema.sql, que es la replica exacta.
        synchronize: false,
      }),
    }),
    ComunModule,
    AuthModule,
    MenuModule,
    MantenedoresModule,
    ComprasModule,
    BodegaModule,
    DistribucionModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(PeticionesMiddleware).forRoutes('*');
  }
}
>>>>>>> Stashed changes
