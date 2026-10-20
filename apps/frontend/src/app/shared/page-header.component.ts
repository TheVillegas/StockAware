import { Component, input } from '@angular/core';
import { IonButtons, IonHeader, IonMenuButton, IonTitle, IonToolbar } from '@ionic/angular/standalone';

/**
 * Top bar for phones only: menu button and page title on the dark shell.
 * On desktop the sidebar is always visible and the title lives in the content
 * (sa-page-head), so the bar is not rendered. Logout lives in the sidebar.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton],
  styles: [`
    ion-header { box-shadow: none; }
    ion-toolbar {
      --min-height: var(--sa-topbar-h);
      --background: var(--sa-shell);
      --color: var(--sa-shell-strong);
      --border-width: 0;
    }
    ion-title { padding-inline: var(--sa-space-2); }
    .page-title {
      margin: 0;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--sa-text-title);
      font-weight: 600;
      color: var(--sa-shell-strong);
    }
    ion-menu-button { --color: var(--sa-shell-strong); }
    ion-menu-button:focus-visible { outline: var(--sa-focus-ring); outline-offset: var(--sa-focus-offset); }
    @media (min-width: 768px) {
      :host { display: none; }
    }
  `],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button aria-label="Abrir menú"></ion-menu-button>
        </ion-buttons>
        <ion-title><h1 class="page-title">{{ title() }}</h1></ion-title>
      </ion-toolbar>
    </ion-header>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
}
