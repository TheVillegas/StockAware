/**
 * Autorización por función, réplica del modelo del ERP.
 *
 * En el ERP cada pantalla consulta Permiso_Funcion('ALGUNA_FUNCION') antes de
 * mostrar un botón o ejecutar una acción. Aquí eso es un decorador sobre el
 * endpoint y un guard que lo verifica.
 *
 *   @RequierePermiso('Aprueba OC')
 *   @Post(':id/aprobar')
 *   aprobar() { ... }
 *
 * La glosa tiene que coincidir con funcion.glosa en la base.
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { UsuarioRequest } from '../auth/jwt.strategy.js';

export const PERMISO_KEY = 'permiso_requerido';

export const RequierePermiso = (...glosas: string[]) =>
  SetMetadata(PERMISO_KEY, glosas);

/** Valida el Bearer token. Sin él, 401. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

/**
 * Corre después de JwtAuthGuard. Si el endpoint no declara permiso, deja pasar:
 * basta con estar autenticado.
 */
@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISO_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requeridos || requeridos.length === 0) return true;

    const usuario = context.switchToHttp().getRequest<{ user?: UsuarioRequest }>()
      .user;

    if (!usuario) {
      throw new UnauthorizedException('Falta autenticación');
    }

    const tiene = requeridos.some((g) => usuario.permisos.includes(g));
    if (!tiene) {
      throw new ForbiddenException(
        `Su perfil no tiene permiso para: ${requeridos.join(' o ')}`,
      );
    }

    return true;
  }
}
