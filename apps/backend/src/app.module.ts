import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { BalanceModule } from './balance/balance.module';
import { BodegaModule } from './bodega/bodega.module';
import { ComprasModule } from './compras/compras.module';
import { DistribucionModule } from './distribucion/distribucion.module';
import { ComunModule } from './comun/comun.module';
import { PeticionesMiddleware } from './comun/peticiones.middleware';
import { MantenedoresModule } from './mantenedores/mantenedores.module';
import { MenuModule } from './menu/menu.module';
import { InteligenciaModule } from './inteligencia/inteligencia.module';
import { SaludController } from './salud/salud.controller';
import { SondaPostgres } from './salud/sonda';
import { SondaPostgresReal } from './salud/sonda.postgres';
import { opcionesBase } from './data-source';
import { PreciosModule } from './precios/precios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        ...opcionesBase,
        host: c.get<string>('PG_HOST'),
        port: Number(c.get<string>('PG_PORT')),
        username: c.get<string>('PG_USER'),
        password: c.get<string>('PG_PASSWORD'),
        database: c.get<string>('PG_DATABASE'),
        ...(c.get<string>('PG_SSL') === 'require' ? { ssl: { rejectUnauthorized: false } } : {}),
        // La migracion de precios_externos corre sola al arrancar: los scripts de init
        // solo corren con el volumen vacio y la base de Compose ya tiene datos.
        migrationsRun: true,
      }),
    }),
    ComunModule,
    AuthModule,
    InteligenciaModule,
    MenuModule,
    BalanceModule,
    MantenedoresModule,
    ComprasModule,
    BodegaModule,
    DistribucionModule,
    PreciosModule,
  ],
  controllers: [SaludController],
  providers: [{ provide: SondaPostgres, useClass: SondaPostgresReal }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(PeticionesMiddleware).forRoutes('*');
  }
}
