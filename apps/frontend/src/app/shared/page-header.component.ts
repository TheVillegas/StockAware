import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonButtons, IonHeader, IonMenuButton, IonRouterOutlet, IonTitle, IonToolbar,
  MenuController, ModalController, NavController } from '@ionic/angular/standalone';
import { SaIcon } from './sa-icon.component';

/**
 * Top bar for phones only (artboard 04): menu button, StockAware brand and Volver
 * on the dark shell. The page title always lives in the content (sa-page-head or
 * the page intro); `title` names the bar for assistive technology. On desktop the
 * sidebar is always visible, so the bar is not rendered. Logout lives in the sidebar.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonButton, SaIcon],
  styles: [`
    ion-header { box-shadow: none; }
    ion-toolbar {
      --min-height: var(--sa-topbar-h);
      --background: var(--sa-shell);
      --color: var(--sa-shell-strong);
      --border-width: 0;
    }
    ion-title { padding-inline: var(--sa-space-2); }
    .topbar-brand {
      display: flex;
      align-items: center;
      gap: var(--sa-space-2);
      color: var(--sa-shell-strong);
      font-size: var(--sa-text-title);
      font-weight: 700;
    }
    .topbar-mark {
      display: grid;
      place-items: center;
      flex: 0 0 var(--sa-space-6);
      height: var(--sa-space-6);
      border-radius: var(--sa-radius);
      background: var(--sa-accent);
    }
    ion-toolbar { --padding-start: var(--sa-space-4); --padding-end: var(--sa-space-4); }
    ion-menu-button {
      --color: var(--sa-shell-strong);
      --background: var(--sa-shell-2);
      --border-radius: var(--sa-radius);
      --padding-start: var(--sa-space-3);
      --padding-end: var(--sa-space-3);
      min-height: calc(var(--sa-space-6) + var(--sa-space-3));
      box-shadow: inset 0 0 0 1px var(--sa-shell-soft);
      border-radius: var(--sa-radius);
    }
    ion-menu-button:focus-visible { outline: var(--sa-focus-ring); outline-offset: var(--sa-focus-offset); }
    @media (min-width: 768px) {
      :host { display: none; }
    }
  `],
  template: `
    <ion-header>
      <ion-toolbar [attr.aria-label]="title()">
        <ion-buttons slot="start">
          <ion-menu-button aria-label="Abrir menú"></ion-menu-button>
        </ion-buttons>
        <ion-title>
          <span class="topbar-brand">
            <span class="topbar-mark" aria-hidden="true"><sa-icon name="warehouse" [size]="20" /></span>
            <span>StockAware</span>
          </span>
        </ion-title>
        @if (!enInicio()) {
          <ion-buttons slot="end"><ion-button (click)="volver()">Volver</ion-button></ion-buttons>
        }
      </ion-toolbar>
    </ion-header>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  private readonly router = inject(Router);
  private readonly outlet = inject(IonRouterOutlet, { optional: true });
  private readonly nav = inject(NavController);
  private readonly menu = inject(MenuController);
  private readonly modals = inject(ModalController);

  private rutaActual(): string { return this.router.url.split(/[?#]/)[0]; }

  enInicio(): boolean { return this.rutaActual() === '/inicio'; }

  async volver(): Promise<void> {
    const modal = await this.modals.getTop();
    if (modal) { await modal.dismiss(); return; }
    if (await this.menu.isOpen()) { await this.menu.close(); return; }
    if (this.outlet?.canGoBack()) this.nav.back();
    else await this.nav.navigateRoot('/inicio');
  }
}
