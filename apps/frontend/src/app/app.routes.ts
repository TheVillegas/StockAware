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
    // Las pantallas de compras se resuelven antes que el mantenedor generico.
    path: 'f/CON_DOC_EMI',
    canActivate: [exigeSesion],
    loadComponent: () => import('./compras/ordenes.page').then((m) => m.OrdenesPage),
  },
  {
    path: 'f/EMITE_OC',
    canActivate: [exigeSesion],
    loadComponent: () => import('./compras/ordenes.page').then((m) => m.OrdenesPage),
  },
  {
    // Se emite HES contra una OC, asi que la entrada es el listado de OC.
    path: 'f/EMITE_HES',
    canActivate: [exigeSesion],
    loadComponent: () => import('./compras/ordenes.page').then((m) => m.OrdenesPage),
  },
  {
    path: 'f/EDITA_OC',
    canActivate: [exigeSesion],
    loadComponent: () => import('./compras/ordenes.page').then((m) => m.OrdenesPage),
  },
  {
    path: 'oc/:id',
    canActivate: [exigeSesion],
    loadComponent: () => import('./compras/orden.page').then((m) => m.OrdenPage),
  },
  {
    // Cada opcion del menu del ERP entra por aca hasta que tenga pantalla propia.
    path: 'f/:codigo',
    canActivate: [exigeSesion],
    loadComponent: () => import('./mantenedor/mantenedor.page').then((m) => m.MantenedorPage),
  },
  { path: '**', redirectTo: 'inicio' },
];
