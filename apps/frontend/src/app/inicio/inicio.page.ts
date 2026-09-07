import { Component, computed, inject } from '@angular/core';
import {
  IonButtons, IonContent, IonHeader, IonMenuButton, IonNote, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-inicio',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent, IonNote],
  styles: [`
    .cuerpo { padding: 24px; max-width: 720px; }
    h2 { margin: 0 0 6px; font-size: 21px; letter-spacing: -.02em; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 20px; margin: 24px 0 0; }
    dt { color: var(--ion-color-medium); font-size: 13px; }
    dd { margin: 0; font-size: 14px; }
  `],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
      <ion-title>Inicio</ion-title>
    </ion-toolbar></ion-header>

    <ion-content>
      <div class="cuerpo">
        <h2>{{ auth.sesion()?.nombre }}</h2>
        <ion-note>Sesión iniciada</ion-note>

        <dl>
          <dt>Usuario</dt><dd>{{ auth.sesion()?.login }}</dd>
          <dt>Perfil</dt><dd>{{ auth.sesion()?.perfil }} (id {{ auth.sesion()?.id_perfil }})</dd>
          <dt>Permisos</dt><dd>{{ auth.sesion()?.permisos?.length }} funciones</dd>
          <dt>Menús visibles</dt><dd>{{ auth.menu().length }}</dd>
          <dt>Opciones visibles</dt><dd>{{ totalOpciones() }}</dd>
        </dl>
      </div>
    </ion-content>
  `,
})
export class InicioPage {
  readonly auth = inject(AuthService);
  readonly totalOpciones = computed(() =>
    this.auth.menu().reduce((n, g) => n + g.opciones.length, 0),
  );
}
