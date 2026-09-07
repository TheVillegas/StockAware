/**
<<<<<<< Updated upstream
 * Armazón de la aplicación: menú lateral y salida de rutas.
 *
 * El menú se arma con los permisos del perfil, igual que el ERP construye el
 * suyo desde acceso_funciones. Si un perfil no tiene la función, la opción no
 * aparece. Es comodidad, no seguridad: quien autoriza es el backend.
 */
import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonApp, IonContent, IonIcon, IonItem, IonLabel, IonList, IonListHeader,
  IonMenu, IonMenuToggle, IonNote, IonRouterOutlet, IonSplitPane,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  cartOutline, cubeOutline, fileTrayFullOutline, homeOutline, logOutOutline,
  peopleOutline, pricetagsOutline, serverOutline, swapHorizontalOutline, walletOutline,
} from 'ionicons/icons';

import { AuthService } from './core/auth.service';

interface Opcion {
  titulo: string;
  ruta: string;
  icono: string;
  permiso?: string;
}

interface Grupo {
  titulo: string;
  opciones: Opcion[];
}

@Component({
  selector: 'app-root',
  imports: [
    RouterLink, RouterLinkActive, IonApp, IonSplitPane, IonMenu, IonContent, IonList,
    IonListHeader, IonNote, IonMenuToggle, IonItem, IonIcon, IonLabel, IonRouterOutlet,
  ],
  styles: [
    `
      ion-list-header { font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: var(--ion-color-medium); min-height: 30px; margin-top: 10px; }
      .marca { padding: 18px 16px 6px; }
      .marca strong { display: block; font-size: 18px; letter-spacing: -.02em; }
      .marca ion-note { font-size: 12px; }
      ion-item.activo { --color: var(--ion-color-primary); font-weight: 600; }
      .pie { padding: 10px 8px 20px; }
    `,
  ],
=======
 * Armazon: menu lateral + salida de rutas.
 *
 * El menu lo entrega el backend desde acceso_funciones filtrado por
 * acceso_permisos. Aca no hay ninguna lista de opciones escrita a mano.
 */
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonApp, IonContent, IonItem, IonLabel, IonList, IonListHeader, IonMenu,
  IonMenuToggle, IonNote, IonRouterOutlet, IonSplitPane,
} from '@ionic/angular/standalone';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterLink, RouterLinkActive, IonApp, IonSplitPane, IonMenu, IonContent,
    IonList, IonListHeader, IonNote, IonMenuToggle, IonItem, IonLabel, IonRouterOutlet,
  ],
  styles: [`
    ion-list-header { font-size: 11px; text-transform: uppercase; letter-spacing: .07em;
      color: var(--ion-color-medium); min-height: 28px; margin-top: 12px; }
    .marca { padding: 18px 16px 4px; }
    .marca strong { display: block; font-size: 17px; letter-spacing: -.02em; }
    .marca ion-note { font-size: 12px; }
    ion-item.activo { --color: var(--ion-color-primary); font-weight: 600; }
    ion-item.pendiente { opacity: .55; }
    .pie { padding: 12px 8px 24px; }
  `],
>>>>>>> Stashed changes
  template: `
    <ion-app>
      @if (auth.autenticado()) {
        <ion-split-pane contentId="principal">
          <ion-menu contentId="principal" type="overlay">
            <ion-content>
              <div class="marca">
<<<<<<< Updated upstream
                <strong>StockAware</strong>
                <ion-note>{{ auth.usuario()?.nombre }} · {{ auth.usuario()?.perfil }}</ion-note>
              </div>

              <ion-list lines="none">
                @for (g of menu(); track g.titulo) {
                  @if (g.opciones.length > 0) {
                    <ion-list-header>{{ g.titulo }}</ion-list-header>
                    @for (o of g.opciones; track o.ruta) {
                      <ion-menu-toggle [autoHide]="false">
                        <ion-item [routerLink]="[o.ruta]" routerLinkActive="activo" detail="false">
                          <ion-icon slot="start" [name]="o.icono"></ion-icon>
                          <ion-label>{{ o.titulo }}</ion-label>
                        </ion-item>
                      </ion-menu-toggle>
                    }
=======
                <strong>ERP</strong>
                <ion-note>{{ auth.sesion()?.nombre }} · {{ auth.sesion()?.perfil }}</ion-note>
              </div>

              <ion-list lines="none">
                <ion-menu-toggle [autoHide]="false">
                  <ion-item routerLink="/inicio" routerLinkActive="activo" detail="false">
                    <ion-label>Inicio</ion-label>
                  </ion-item>
                </ion-menu-toggle>

                @for (g of auth.menu(); track g.id) {
                  <ion-list-header>{{ g.titulo }}</ion-list-header>
                  @for (o of g.opciones; track o.id) {
                    <ion-menu-toggle [autoHide]="false">
                      <ion-item [routerLink]="['/f', o.codigo]" routerLinkActive="activo"
                                detail="false" [class.pendiente]="!o.implementada">
                        <ion-label>{{ o.titulo }}</ion-label>
                      </ion-item>
                    </ion-menu-toggle>
>>>>>>> Stashed changes
                  }
                }
              </ion-list>

              <div class="pie">
                <ion-item button detail="false" lines="none" (click)="auth.salir()">
<<<<<<< Updated upstream
                  <ion-icon slot="start" name="log-out-outline"></ion-icon>
=======
>>>>>>> Stashed changes
                  <ion-label>Cerrar sesión</ion-label>
                </ion-item>
              </div>
            </ion-content>
          </ion-menu>

          <ion-router-outlet id="principal"></ion-router-outlet>
        </ion-split-pane>
      } @else {
        <ion-router-outlet id="principal"></ion-router-outlet>
      }
    </ion-app>
  `,
})
export class AppComponent {
  readonly auth = inject(AuthService);

<<<<<<< Updated upstream
  private readonly grupos: Grupo[] = [
    {
      titulo: 'General',
      opciones: [{ titulo: 'Inicio', ruta: '/inicio', icono: 'home-outline' }],
    },
    {
      titulo: 'Compras',
      opciones: [
        { titulo: 'Órdenes de compra', ruta: '/compras/ordenes', icono: 'cart-outline', permiso: 'Órdenes de compra' },
      ],
    },
    {
      titulo: 'Bodega',
      opciones: [
        { titulo: 'Stock por bodega', ruta: '/bodega/stock', icono: 'cube-outline', permiso: 'Stock por bodega' },
        { titulo: 'Movimientos', ruta: '/bodega/movimientos', icono: 'swap-horizontal-outline', permiso: 'Movimientos' },
      ],
    },
    {
      titulo: 'Mantenedores',
      opciones: [
        { titulo: 'Materiales', ruta: '/mantenedores/materiales', icono: 'file-tray-full-outline', permiso: 'Materiales' },
        { titulo: 'Bodegas', ruta: '/mantenedores/bodegas', icono: 'server-outline', permiso: 'Bodegas' },
        { titulo: 'Proveedores', ruta: '/mantenedores/proveedores', icono: 'people-outline', permiso: 'Proveedores' },
        { titulo: 'Categorías', ruta: '/mantenedores/categorias', icono: 'pricetags-outline', permiso: 'Categorías' },
        { titulo: 'Centros de costo', ruta: '/mantenedores/centros-costo', icono: 'wallet-outline', permiso: 'Centros de costo' },
      ],
    },
  ];

  readonly menu = computed<Grupo[]>(() => {
    // Se lee usuario() para que el menú se recalcule al entrar y al salir.
    this.auth.usuario();
    return this.grupos.map((g) => ({
      titulo: g.titulo,
      opciones: g.opciones.filter((o) => !o.permiso || this.auth.puede(o.permiso)),
    }));
  });

  constructor() {
    addIcons({
      homeOutline, cartOutline, cubeOutline, fileTrayFullOutline, serverOutline,
      peopleOutline, pricetagsOutline, walletOutline, logOutOutline, swapHorizontalOutline,
    });
=======
  constructor() {
    // Al recargar la pagina la sesion vuelve de localStorage, pero el menu no.
    if (this.auth.autenticado()) void this.auth.cargarMenu();
>>>>>>> Stashed changes
  }
}
