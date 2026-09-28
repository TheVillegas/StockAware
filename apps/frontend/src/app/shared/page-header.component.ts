import { Component, input, inject } from '@angular/core';
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
    ion-toolbar { --min-height: 64px; }
    ion-title { position: relative; inset: auto; transform: none; flex: 1 1 auto; width: auto;
      display: flex; align-items: center; min-width: 0; font-size: 17px; padding-inline: 12px; }
    .nombre { flex: none; font-size: 15px; font-weight: 700; letter-spacing: -.02em; margin-right: 10px; }
    .page-title { min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: inherit; }
    ion-buttons[slot="end"] { min-width: 0; max-width: 55%; }
    .page-actions { display: flex; align-items: center; flex: 0 0 auto; min-width: max-content; }
    .logout-icon { display: none; }
    .cuenta { display: flex; flex-direction: column; justify-content: center; padding: 0 8px; line-height: 1.2; }
    .usuario { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; }
    .perfil { font-size: 11px; }
    .acciones { display: flex; align-items: center; gap: 4px; }
    ion-button:focus-visible, ion-menu-button:focus-visible { outline: 3px solid var(--ion-color-primary); outline-offset: 2px; }
    @media (max-width: 620px) {
      ion-toolbar { --min-height: 56px; }
      .nombre { display: none; }
      ion-title { font-size: 15px; }
      .page-title { flex: 1 1 auto; }
      .cuenta { display: none; }
      ion-buttons[slot="end"] { max-width: 48%; }
      .page-actions { max-width: none; overflow: visible; }
      :host ::ng-deep ion-button[header-actions] {
        flex: 0 0 auto; white-space: nowrap; --padding-start: 5px; --padding-end: 5px; font-size: 12px;
      }
      .logout-icon { display: block; font-size: 20px; }
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
        <ion-title><span class="nombre">StockAware</span><h1 class="page-title">{{ title() }}</h1></ion-title>
        <ion-buttons slot="end" class="acciones">
          <div class="page-actions"><ng-content select="[header-actions]"></ng-content></div>
          <div class="cuenta">
            <span class="usuario">{{ auth.sesion()?.nombre }}</span>
            <ion-note class="perfil">{{ auth.sesion()?.perfil }}</ion-note>
          </div>
          <ion-button aria-label="Cerrar sesión" (click)="auth.salir()">
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
}
