<<<<<<< Updated upstream
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthService, type JwtPayload } from './auth.service.js';

/**
 * Lo que queda disponible en `request.user` una vez validado el token.
 * `permisos` se recarga en cada petición a propósito: si a un perfil le quitan
 * un permiso, deja de aplicar de inmediato y no al vencer el token.
 */
export interface UsuarioRequest {
  id: number;
  username: string;
  perfilId: number;
  permisos: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    // El secreto sale del ConfigService, la misma fuente que usa JwtModule al
    // firmar. Leer process.env aquí funcionaría, pero dejaría dos caminos
    // distintos hacia el mismo valor y ya nos costó un 401 silencioso.
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secreto') ?? '',
    });
  }

  async validate(payload: JwtPayload): Promise<UsuarioRequest> {
    const usuario = await this.auth.porId(payload.sub);
    if (!usuario) {
      throw new UnauthorizedException('El usuario ya no está activo');
    }

    return {
      id: usuario.id,
      username: usuario.username,
      perfilId: usuario.perfilId,
      permisos: await this.auth.permisosDe(usuario.perfilId),
    };
=======
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { SesionUsuario } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  /** Lo que retorna queda en req.user. */
  async validate(payload: SesionUsuario & { sub: number }): Promise<SesionUsuario> {
    const { sub, ...sesion } = payload;
    return sesion;
>>>>>>> Stashed changes
  }
}
