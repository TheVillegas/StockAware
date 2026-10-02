import { Component, computed, input, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  IonButton, IonButtons, IonHeader, IonIcon, IonMenuButton, IonNote, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { logOutOutline } from 'ionicons/icons';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonButton, IonIcon, IonNote],
  styles: [`
    ion-header { box-shadow: none; }
    ion-toolbar {
      --min-height: var(--sa-topbar-h);
      --background: var(--sa-surface);
      --border-width: 0 0 var(--sa-border) 0;
      --border-color: var(--sa-line-strong);
      --border-style: solid;
    }
    ion-title { position: relative; inset: auto; transform: none; flex: 1 1 auto; width: auto;
      display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
      min-width: 0; padding-inline: var(--sa-space-3); }
    .page-title { min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-size: var(--sa-text-page); font-weight: 600; line-height: 1.2; }
    .codigo { font-family: var(--sa-font-mono); font-size: var(--sa-text-label); color: var(--sa-ink-soft);
      line-height: 1.2; }
    ion-buttons[slot="end"] { min-width: 0; max-width: 55%; }
    .page-actions { display: flex; align-items: center; flex: 0 0 auto; min-width: max-content; }
    .logout-icon { display: none; }
    .cuenta { display: flex; flex-direction: column; justify-content: center; padding: 0 var(--sa-space-2); line-height: 1.2; }
    .usuario { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--sa-text-meta); font-weight: 600; }
    .perfil { font-size: var(--sa-text-meta); color: var(--sa-ink-soft); }
    .salir { --border-color: var(--sa-border-input); --color: var(--sa-accent); --border-radius: var(--sa-radius);
      min-height: var(--sa-control-h-sm); }
    .acciones { display: flex; align-items: center; gap: var(--sa-space-1); padding-inline-end: var(--sa-space-3); }
    ion-button:focus-visible, ion-menu-button:focus-visible { outline: var(--sa-focus-ring); outline-offset: var(--sa-focus-offset); }
    @media (max-width: 767.98px) {
      ion-toolbar { --min-height: var(--sa-topbar-h); --background: var(--sa-shell); --border-color: var(--sa-shell-line); }
      .page-title { flex: 1 1 auto; font-size: var(--sa-text-title); color: var(--sa-shell-strong); }
      .codigo { color: var(--sa-shell-soft); }
      ion-menu-button { --color: var(--sa-shell-strong); }
      .cuenta { display: none; }
      ion-buttons[slot="end"] { max-width: 48%; }
      .page-actions { max-width: none; overflow: visible; }
      :host ::ng-deep ion-button[header-actions] {
        flex: 0 0 auto; white-space: nowrap; --padding-start: 5px; --padding-end: 5px; font-size: var(--sa-text-meta);
      }
      .salir { --color: var(--sa-shell-strong); }
      .logout-icon { display: block; font-size: var(--sa-text-title); }
      .logout-label { display: none; }
      .acciones { gap: 0; }
    }
  `],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button aria-label="Abrir menú"></ion-menu-button>
        </ion-buttons>
        <ion-title>
          <h1 class="page-title">{{ title() }}</h1>
          @if (codigo()) {
            <span class="codigo">{{ codigo() }}</span>
          }
        </ion-title>
        <ion-buttons slot="end" class="acciones">
          <div class="page-actions"><ng-content select="[header-actions]"></ng-content></div>
          <div class="cuenta">
            <span class="usuario">{{ auth.sesion()?.nombre }}</span>
            <ion-note class="perfil">{{ auth.sesion()?.perfil }}</ion-note>
          </div>
          <ion-button class="salir" fill="outline" aria-label="Cerrar sesión" (click)="auth.salir()">
            <ion-icon class="logout-icon" [icon]="logOutOutline" aria-hidden="true"></ion-icon>
            <span class="logout-label">Salir</span>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly auth = inject(AuthService);
  readonly logOutOutline = logOutOutline;

  private readonly router = inject(Router);
  private readonly url = signal(this.router.url);
  // El codigo de funcion sale de la URL: /f/<CODE>. Si no calza, no se muestra.
  readonly codigo = computed(() => {
    const match = /\/f\/([^/?#]+)/.exec(this.url());
    return match ? decodeURIComponent(match[1]) : '';
  });

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe((event) => this.url.set((event as NavigationEnd).urlAfterRedirects));
  }
}
