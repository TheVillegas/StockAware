/**
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
  template: `
    <ion-app>
      @if (auth.autenticado()) {
        <ion-split-pane contentId="principal">
          <ion-menu contentId="principal" type="overlay">
            <ion-content>
              <div class="marca">
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
                  }
                }
              </ion-list>

              <div class="pie">
                <ion-item button detail="false" lines="none" (click)="auth.salir()">
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

  constructor() {
    // Al recargar la pagina la sesion vuelve de localStorage, pero el menu no.
    if (this.auth.autenticado()) void this.auth.cargarMenu();
  }
}
