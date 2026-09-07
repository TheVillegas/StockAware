/**
 * Autorizacion por perfil, igual que el ERP.
 *
 * El permiso no vive en el codigo: vive en acceso_permisos, que cruza un perfil
 * con una funcion de acceso_funciones. @Requiere('EMITE_OC') exige que el
 * perfil del usuario tenga esa glosa activa.
 */
import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

export const PERMISO_CLAVE = 'permiso_requerido';
export const Requiere = (glosa: string) => SetMetadata(PERMISO_CLAVE, glosa);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requerido = this.reflector.getAllAndOverride<string>(PERMISO_CLAVE, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!requerido) return true;

    const req = ctx.switchToHttp().getRequest();
    const permisos: string[] = req.user?.permisos ?? [];
    if (!permisos.includes(requerido)) {
      throw new ForbiddenException(
        `El perfil "${req.user?.perfil ?? '?'}" no tiene la funcion ${requerido}`,
      );
    }
    return true;
  }
}
