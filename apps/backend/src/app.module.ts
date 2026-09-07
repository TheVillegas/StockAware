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
    BalanceModule,
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
