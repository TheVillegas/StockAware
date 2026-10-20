/**
 * Armazon: menu lateral + salida de rutas.
 *
 * El backend decide que puede abrir cada perfil (acceso_funciones filtrado por
 * acceso_permisos). El menu reagrupa esas opciones por proposito y oculta las
 * que no tienen pantalla: ver shared/workspace-navigation.js.
 */
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  IonApp, IonContent, IonItem, IonLabel, IonList, IonListHeader, IonMenu, IonMenuToggle,
  IonRouterOutlet, IonSplitPane,
} from '@ionic/angular/standalone';
import { AuthService } from './core/auth.service';
import { SaIcon, SaIconName } from './shared/sa-icon.component';
import { accionesCrear, construirNavegacion, entradaActiva } from './shared/workspace-navigation';

/** Area of each navigation section; it colors the section icons. */
const AREA_SECCION: Record<string, string> = {
  compras: 'compras', bodega: 'bodega', finanzas: 'finanzas', configuracion: 'sistema',
};
const ICONOS: Record<string, SaIconName> = {
  ordenes: 'orders',
  stock: 'warehouse',
  movimientos: 'move',
  registrar: 'in',
  distribucion: 'split',
  balance: 'chart',
  configuracion: 'settings',
};
const ICONOS_CREAR: Record<string, SaIconName> = {
  oc: 'orders', ingreso: 'in', salida: 'out', reparto: 'split',
};

@Component({
  selector: 'app-root',
  imports: [
    RouterLink, IonApp, IonSplitPane, IonMenu, IonContent, IonList, IonListHeader, IonMenuToggle,
    IonItem, IonLabel, IonRouterOutlet, SaIcon,
  ],
  styles: [`
    ion-menu {
      --background: var(--sa-shell);
      --ion-background-color: var(--sa-shell);
      --width: var(--sa-menu-w);
    }
    ion-menu ion-content {
      --background: var(--sa-shell);
      --padding-start: var(--sa-space-3);
      --padding-end: var(--sa-space-3);
      --padding-top: var(--sa-space-5);
    }
    ion-list {
      background: transparent;
      padding: 0;
    }

    .marca {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 var(--sa-space-2) 18px;
      color: var(--sa-shell-strong);
      font-weight: 700;
      font-size: var(--sa-text-title);
      text-decoration: none;
    }
    .marca-mark {
      inline-size: 32px;
      block-size: 32px;
      border-radius: var(--sa-radius);
      background: var(--sa-area-compras);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--sa-shell-strong);
    }
    .marca .marca-stock,
    .marca .marca-aware { color: var(--sa-shell-strong); }

    .crear { margin: 0 2px var(--sa-space-3); }
    .crear summary {
      list-style: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--sa-space-2);
      min-height: 44px;
      border-radius: var(--sa-radius);
      background: var(--sa-area-compras);
      color: var(--sa-shell-strong);
      font-weight: 600;
      font-size: var(--sa-text-body);
      cursor: pointer;
    }
    .crear summary::-webkit-details-marker { display: none; }
    .crear summary:hover { background: var(--sa-accent-hover); }
    .crear summary:focus-visible { outline: var(--sa-focus-ring); outline-offset: var(--sa-focus-offset); }
    .crear-menu {
      display: flex;
      flex-direction: column;
      margin-top: 6px;
      padding: var(--sa-space-1);
      border-radius: var(--sa-radius);
      background: var(--sa-shell-2);
    }
    .crear-menu a {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 40px;
      padding: 0 10px;
      border-radius: 6px;
      color: var(--sa-shell-ink);
      text-decoration: none;
      font-size: var(--sa-text-body);
    }
    .crear-menu a:hover,
    .crear-menu a:focus-visible { background: var(--sa-shell-line); color: var(--sa-shell-strong); }

    ion-list-header.seccion {
      min-height: 0;
      padding: 14px 10px 6px;
      font-size: var(--sa-text-meta);
      font-weight: 500;
      color: var(--sa-shell-soft);
      --color: var(--sa-shell-soft);
    }

    ion-menu-toggle ion-item {
      --background: transparent;
      --background-hover: var(--sa-shell-strong);
      --background-hover-opacity: .07;
      --color: var(--sa-shell-ink);
      --min-height: var(--sa-control-h);
      --padding-start: 10px;
      --inner-padding-end: 10px;
      --border-radius: var(--sa-radius);
      margin-block: 1px;
      font-size: var(--sa-text-body);
    }
    ion-menu-toggle ion-item.activo {
      --background: var(--sa-shell-2);
      --color: var(--sa-shell-mark);
      font-weight: 600;
    }
    ion-item sa-icon { margin-inline-end: 10px; }
    [data-area="compras"] { color: var(--sa-area-compras-on-shell); }
    [data-area="bodega"] { color: var(--sa-area-bodega-on-shell); }
    [data-area="finanzas"] { color: var(--sa-area-finanzas-on-shell); }
    [data-area="sistema"] { color: var(--sa-area-sistema-on-shell); }

    .cuenta-menu {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: var(--sa-space-3) var(--sa-space-4) var(--sa-space-4);
      background: var(--sa-shell);
      border-top: var(--sa-border) solid var(--sa-shell-line);
      color: var(--sa-shell-strong);
    }
    .iniciales {
      inline-size: 34px;
      block-size: 34px;
      border-radius: 50%;
      background: var(--sa-shell-line);
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
      font-size: var(--sa-text-dense);
      font-weight: 600;
    }
    .cuenta-texto { display: flex; flex-direction: column; min-width: 0; flex: 1; font-size: var(--sa-text-body); }
    .cuenta-texto strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
    .cuenta-texto small { color: var(--sa-shell-soft); font-size: var(--sa-text-meta); }
    .salir {
      inline-size: 40px;
      block-size: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: var(--sa-radius);
      background: transparent;
      color: var(--sa-shell-ink);
      cursor: pointer;
    }
    .salir:hover { background: var(--sa-shell-2); color: var(--sa-shell-strong); }
    .salir:focus-visible { outline: var(--sa-focus-ring); outline-offset: var(--sa-focus-offset); }
  `],
  template: `
    <ion-app>
      @if (auth.autenticado()) {
        <ion-split-pane contentId="principal" data-visual="ep1" when="md">
          <ion-menu contentId="principal" type="overlay">
            <ion-content>
              <a class="marca" routerLink="/inicio">
                <span class="marca-mark"><sa-icon name="warehouse" [size]="18" [stroke]="2" /></span>
                <span><span class="marca-stock">Stock</span><span class="marca-aware">Aware</span></span>
              </a>

              @if (crear().length) {
                <details class="crear" #menuCrear>
                  <summary><sa-icon name="plus" [stroke]="2.2" />Crear</summary>
                  <nav class="crear-menu" aria-label="Crear">
                    @for (a of crear(); track a.key) {
                      <ion-menu-toggle [autoHide]="false">
                        <a [routerLink]="a.ruta" (click)="menuCrear.open = false">
                          <sa-icon [name]="iconoCrear(a.key)" [size]="16" [attr.data-area]="a.area" />{{ a.titulo }}
                        </a>
                      </ion-menu-toggle>
                    }
                  </nav>
                </details>
              }

              <ion-list lines="none">
                <ion-menu-toggle [autoHide]="false">
                  <ion-item routerLink="/inicio" detail="false" [class.activo]="enInicio()"
                            [attr.aria-current]="enInicio() ? 'page' : null">
                    <sa-icon slot="start" name="home" />
                    <ion-label>Inicio</ion-label>
                  </ion-item>
                </ion-menu-toggle>

                @for (seccion of navegacion(); track seccion.key) {
                  <ion-list-header class="seccion">{{ seccion.titulo }}</ion-list-header>
                  @for (e of seccion.entradas; track e.key) {
                    <ion-menu-toggle [autoHide]="false">
                      <ion-item class="opcion-menu" [routerLink]="e.ruta" detail="false"
                                [class.activo]="activa() === e.key"
                                [attr.aria-current]="activa() === e.key ? 'page' : null">
                        <sa-icon slot="start" [name]="iconoEntrada(e.key)" [attr.data-area]="areaSeccion(seccion.key)" />
                        <ion-label>{{ e.titulo }}</ion-label>
                      </ion-item>
                    </ion-menu-toggle>
                  }
                }
              </ion-list>
            </ion-content>
            <div class="cuenta-menu">
              <span class="iniciales" aria-hidden="true">{{ iniciales() }}</span>
              <span class="cuenta-texto">
                <strong>{{ auth.sesion()?.nombre }}</strong>
                <small>Perfil {{ auth.sesion()?.perfil }}</small>
              </span>
              <button type="button" class="salir" aria-label="Cerrar sesión" (click)="auth.salir()">
                <sa-icon name="logout" />
              </button>
            </div>
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
  readonly navegacion = computed(() => construirNavegacion(this.auth.menu()));
  readonly crear = computed(() => accionesCrear(this.auth.menu()));
  private readonly router = inject(Router);
  private readonly url = signal(this.router.url);
  readonly activa = computed(() => entradaActiva(this.navegacion(), this.url()));
  readonly enInicio = computed(() => this.url().split(/[?#]/)[0] === '/inicio');

  iconoEntrada(key: string): SaIconName {
    return ICONOS[key] ?? 'home';
  }

  iconoCrear(key: string): SaIconName {
    return ICONOS_CREAR[key] ?? 'plus';
  }

  areaSeccion(key: string): string {
    return AREA_SECCION[key] ?? 'sistema';
  }

  iniciales(): string {
    const nombre = (this.auth.sesion()?.nombre ?? '').trim();
    const partes = nombre.split(/\s+/).filter(Boolean);
    const letras = partes.length > 1 ? partes[0][0] + partes[1][0] : nombre.slice(0, 2);
    return letras.toUpperCase();
  }

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe((e) => this.url.set((e as NavigationEnd).urlAfterRedirects));
    // Al recargar la pagina la sesion vuelve de localStorage, pero el menu no.
    if (this.auth.autenticado()) void this.auth.cargarMenu();
  }
}
