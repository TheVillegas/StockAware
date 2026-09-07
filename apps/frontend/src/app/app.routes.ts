<<<<<<< Updated upstream
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
    path: 'bodega/movimientos',
    canActivate: [guardSesion, guardPermiso('Movimientos')],
    loadComponent: () => import('./bodega/movimientos.page').then((m) => m.MovimientosPage),
  },
  {
    path: 'bodega/stock',
    canActivate: [guardSesion, guardPermiso('Stock por bodega')],
    loadComponent: () => import('./bodega/stock.page').then((m) => m.StockPage),
  },

  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
=======
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
    path: 'f/MATERIAL_X_BODEGA',
    canActivate: [exigeSesion],
    loadComponent: () => import('./bodega/stock.page').then((m) => m.StockPage),
  },
  {
    path: 'f/BODEGA_MOVIMIENTOS',
    canActivate: [exigeSesion],
    loadComponent: () => import('./bodega/movimientos.page').then((m) => m.MovimientosPage),
  },
  {
    path: 'f/ING_MATERIAL',
    canActivate: [exigeSesion],
    loadComponent: () => import('./bodega/recepcion.page').then((m) => m.RecepcionPage),
  },
  {
    // Un solo componente para los tres modos, igual que Emite_Documento_GR.
    matcher: (segs) => segs.length === 2 && segs[0].path === 'f'
      && ['EMITE_GR', 'RECIBE_GR', 'ENTREGA_MAT'].includes(segs[1].path)
      ? { consumed: segs, posParams: { codigo: segs[1] } } : null,
    canActivate: [exigeSesion],
    loadComponent: () => import('./bodega/guia.page').then((m) => m.GuiaPage),
  },
  {
    path: 'f/DOC_DISTRIBUIR',
    canActivate: [exigeSesion],
    loadComponent: () => import('./distribucion/distribucion.page').then((m) => m.DistribucionPage),
  },
  {
    // Cada opcion del menu del ERP entra por aca hasta que tenga pantalla propia.
    path: 'f/:codigo',
    canActivate: [exigeSesion],
    loadComponent: () => import('./mantenedor/mantenedor.page').then((m) => m.MantenedorPage),
  },
>>>>>>> Stashed changes
  { path: '**', redirectTo: 'inicio' },
];
