import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Permiso, Usuario } from '../entities/acceso.entity.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Permiso]),
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // registerAsync, no register: con register las opciones se evalúan al
    // importar el módulo, ANTES de que ConfigModule cargue el .env, y el token
    // termina firmado con el secreto por defecto mientras JwtStrategy —que se
    // instancia después— valida con el del .env. El síntoma es un 401 en todo
    // endpoint protegido, con un login que sí devuelve token.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secreto'),
        signOptions: {
          expiresIn: config.get<string>('jwt.expiraEn') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // PassportModule se exporta porque JwtAuthGuard (que extiende AuthGuard'jwt')
  // resuelve AuthModuleOptions desde el inyector del módulo que lo usa. Sin
  // esto, cualquier módulo con @UseGuards(JwtAuthGuard) falla al arrancar.
  exports: [AuthService, PassportModule],
})
export class AuthModule {}
