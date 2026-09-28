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
  IonAccordion, IonAccordionGroup, IonMenuToggle, IonRouterOutlet, IonSplitPane,
} from '@ionic/angular/standalone';
import { AuthService } from './core/auth.service';
import { agruparAreas } from './shared/workspace-navigation';

@Component({
  selector: 'app-root',
  imports: [
    RouterLink, RouterLinkActive, IonApp, IonSplitPane, IonMenu, IonContent,
    IonList, IonListHeader, IonMenuToggle, IonItem, IonLabel, IonRouterOutlet,
    IonAccordion, IonAccordionGroup,
  ],
  styles: [`
    ion-menu {
      --background: var(--sa-shell);
    }
    ion-menu ion-content {
      --background: var(--sa-shell);
    }
    ion-list {
      background: transparent;
      padding: 0;
    }
    .marca {
      font-family: var(--sa-font-mono);
      font-weight: 600;
      font-size: var(--sa-text-title);
      padding: var(--sa-space-4);
      border-bottom: var(--sa-border) solid var(--sa-shell-line);
    }
    .marca .marca-stock { color: var(--sa-shell-strong); }
    .marca .marca-aware { color: var(--sa-shell-mark); }

    ion-accordion-group ion-item[slot="header"] {
      --background: transparent;
      --background-hover: transparent;
      --min-height: var(--sa-control-h);
      --padding-start: var(--sa-space-4);
      --padding-end: var(--sa-space-4);
    }
    ion-accordion-group ion-item[slot="header"] ion-label,
    ion-list-header {
      font-size: var(--sa-text-label);
      text-transform: uppercase;
      letter-spacing: .06em;
      font-weight: 600;
      color: var(--sa-shell-soft);
    }
    ion-accordion-group ion-item[slot="header"]::part(native) {
      color: var(--sa-shell-soft);
    }
    ion-accordion .ion-accordion-toggle-icon {
      color: var(--sa-shell-soft);
    }
    ion-list-header {
      padding-inline-start: var(--sa-space-5);
      min-height: var(--sa-control-h);
    }

    ion-menu-toggle ion-item {
      --background: transparent;
      --background-hover: var(--sa-shell-2);
      --background-hover-opacity: 1;
      --color: var(--sa-shell-ink);
      --min-height: var(--sa-control-h);
      --padding-start: var(--sa-space-4);
      --padding-end: var(--sa-space-4);
      font-size: var(--sa-text-dense);
    }
    ion-menu-toggle ion-item.activo {
      --background: var(--sa-shell-2);
      --color: var(--sa-shell-strong);
      font-weight: 600;
      border-inline-start: 3px solid var(--sa-shell-mark);
    }
    ion-menu-toggle ion-item.pendiente { opacity: .55; }
  `],
  template: `
    <ion-app>
      @if (auth.autenticado()) {
        <ion-split-pane contentId="principal">
          <ion-menu contentId="principal" type="overlay">
            <ion-content>
              <div class="marca"><span class="marca-stock">Stock</span><span class="marca-aware">Aware</span></div>
              <ion-list lines="none">
                <ion-menu-toggle [autoHide]="false">
                  <ion-item routerLink="/inicio" routerLinkActive="activo" detail="false">
                    <ion-label>Inicio</ion-label>
                  </ion-item>
                </ion-menu-toggle>

                <ion-accordion-group [multiple]="true">
                  @for (area of areas(); track area.key) {
                    <ion-accordion [value]="area.key">
                      <ion-item slot="header">
                        <ion-label>{{ area.titulo }}</ion-label>
                      </ion-item>
                      <div slot="content">
                        @for (g of area.grupos; track g.id) {
                          @if (area.grupos.length > 1 || area.key === 'otros') {
                            <ion-list-header>{{ g.titulo }}</ion-list-header>
                          }
                          @for (o of g.opciones; track o.id) {
                            <ion-menu-toggle [autoHide]="false">
                              <ion-item [routerLink]="['/f', o.codigo]" routerLinkActive="activo"
                                        detail="false" [class.pendiente]="!o.implementada">
                                <ion-label>{{ o.titulo }}</ion-label>
                              </ion-item>
                            </ion-menu-toggle>
                          }
                        }
                      </div>
                    </ion-accordion>
                  }
                </ion-accordion-group>
              </ion-list>

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
  readonly areas = () => agruparAreas(this.auth.menu());

  constructor() {
    // Al recargar la pagina la sesion vuelve de localStorage, pero el menu no.
    if (this.auth.autenticado()) void this.auth.cargarMenu();
  }
}
