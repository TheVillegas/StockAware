import type { Routes } from '@angular/router';

import { guardPermiso, guardSesion } from './core/guards';
import { MANTENEDORES } from './mantenedores/mantenedor.config';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'inicio',
    canActivate: [guardSesion],
    loadComponent: () => import('./inicio/inicio.page').then((m) => m.InicioPage),
  },

  // Una ruta por mantenedor, todas hacia la misma pantalla genérica. El
  // parámetro `tipo` llega como input gracias a withComponentInputBinding().
  ...MANTENEDORES.map((m) => ({
    path: `mantenedores/${m.ruta}`,
    canActivate: [guardSesion, guardPermiso(m.permiso)],
    data: { tipo: m.ruta },
    loadComponent: () =>
      import('./mantenedores/mantenedor.page').then((x) => x.MantenedorPage),
  })),

  {
    path: 'compras/ordenes',
    canActivate: [guardSesion, guardPermiso('Órdenes de compra')],
    loadComponent: () => import('./compras/ordenes.page').then((m) => m.OrdenesPage),
  },
  {
    path: 'compras/ordenes/:id',
    canActivate: [guardSesion, guardPermiso('Órdenes de compra')],
    loadComponent: () =>
      import('./compras/orden-detalle.page').then((m) => m.OrdenDetallePage),
  },
  {
    path: 'bodega/stock',
    canActivate: [guardSesion, guardPermiso('Stock por bodega')],
    loadComponent: () => import('./bodega/stock.page').then((m) => m.StockPage),
  },

  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  { path: '**', redirectTo: 'inicio' },
];
