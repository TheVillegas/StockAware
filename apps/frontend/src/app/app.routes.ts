import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './core/auth.service';

const exigeSesion = () => {
  const auth = inject(AuthService);
  return auth.autenticado() ? true : inject(Router).createUrlTree(['/login']);
};

export const rutas: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inicio' },
  { path: 'login', loadComponent: () => import('./login/login.page').then((m) => m.LoginPage) },
  {
    path: 'inicio',
    canActivate: [exigeSesion],
    loadComponent: () => import('./inicio/inicio.page').then((m) => m.InicioPage),
  },
  {
    // Cada opcion del menu del ERP entra por aca hasta que tenga pantalla propia.
    path: 'f/:codigo',
    canActivate: [exigeSesion],
    loadComponent: () => import('./mantenedor/mantenedor.page').then((m) => m.MantenedorPage),
  },
  { path: '**', redirectTo: 'inicio' },
];
