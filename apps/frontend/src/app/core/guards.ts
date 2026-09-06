/**
 * Interceptor y guards.
 *
 * El guard de permiso repite lo que ya valida el backend. No lo reemplaza:
 * sirve para que el usuario no llegue a una pantalla que no va a poder usar.
 */
import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import type { HttpInterceptorFn } from '@angular/common/http';

import { AuthService } from './auth.service';

/** Agrega el Bearer a toda llamada al backend. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token;
  return token
    ? next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
    : next(req);
};

export const guardSesion: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.autenticado() ? true : router.createUrlTree(['/login']);
};

/** Uso: { canActivate: [guardSesion, guardPermiso('Materiales')] } */
export const guardPermiso =
  (permiso: string): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.puede(permiso) ? true : router.createUrlTree(['/inicio']);
  };
