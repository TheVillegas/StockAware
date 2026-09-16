import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { ComunModule } from '../comun/comun.module';
import {
  AccesoFuncion, AccesoPerfil, AccesoPermiso, Usuario,
} from '../entidades/acceso.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, AccesoPerfil, AccesoPermiso, AccesoFuncion]),
    PassportModule,
    ComunModule,
    // registerAsync: si fuera register(), las opciones se evaluarian antes de
    // que ConfigModule cargue el .env y el token se firmaria con otro secreto.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret: c.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: (c.get<string>('JWT_EXPIRA') ?? '3600s') as any },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, PassportModule, JwtModule],
})
export class AuthModule {}
