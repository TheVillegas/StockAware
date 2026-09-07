<<<<<<< Updated upstream
/** Portada: qué puede hacer el perfil que entró. */
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButtons, IonContent, IonHeader, IonMenuButton, IonTitle, IonToolbar,
} from '@ionic/angular';

=======
import { Component, computed, inject } from '@angular/core';
import {
  IonButtons, IonContent, IonHeader, IonMenuButton, IonNote, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
>>>>>>> Stashed changes
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-inicio',
<<<<<<< Updated upstream
  imports: [RouterLink, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent],
  styles: [
    `
      .caja { max-width: 760px; padding: 22px 18px 40px; }
      h2 { font-size: 22px; letter-spacing: -.02em; margin: 0 0 6px; }
      p.bajada { color: var(--ion-color-medium); margin: 0 0 22px; line-height: 1.55; }
      .tarjetas { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
      a.tarjeta { display: block; padding: 15px 16px; border: 1px solid var(--ion-color-light-shade); border-radius: 10px; text-decoration: none; color: inherit; }
      a.tarjeta:hover { border-color: var(--ion-color-primary); }
      a.tarjeta strong { display: block; font-size: 15px; margin-bottom: 3px; }
      a.tarjeta span { font-size: 13px; color: var(--ion-color-medium); line-height: 1.5; }
      .permisos { margin-top: 28px; font-size: 12.5px; color: var(--ion-color-medium); line-height: 1.7; }
      .permisos code { font-family: ui-monospace, monospace; background: var(--ion-color-light); padding: 1px 5px; border-radius: 3px; margin-right: 4px; display: inline-block; }
    `,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Inicio</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="caja">
        <h2>Hola, {{ auth.usuario()?.nombre }}</h2>
        <p class="bajada">
          Entraste con el perfil <strong>{{ auth.usuario()?.perfil }}</strong>. El menú
          muestra solo lo que ese perfil puede usar.
        </p>

        <div class="tarjetas">
          @if (puede('Órdenes de compra')) {
            <a class="tarjeta" routerLink="/compras/ordenes">
              <strong>Órdenes de compra</strong>
              <span>Crear, aprobar y recibir contra una OC.</span>
            </a>
          }
          @if (puede('Stock por bodega')) {
            <a class="tarjeta" routerLink="/bodega/stock">
              <strong>Stock por bodega</strong>
              <span>Saldos y materiales bajo su mínimo.</span>
            </a>
          }
          @if (puede('Materiales')) {
            <a class="tarjeta" routerLink="/mantenedores/materiales">
              <strong>Materiales</strong>
              <span>Maestro de materiales fungibles.</span>
            </a>
          }
        </div>

        <div class="permisos">
          Permisos de este perfil:
          @for (p of permisos(); track p) { <code>{{ p }}</code> }
        </div>
=======
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
>>>>>>> Stashed changes
      </div>
    </ion-content>
  `,
})
export class InicioPage {
  readonly auth = inject(AuthService);
<<<<<<< Updated upstream
  readonly permisos = computed(() => this.auth.usuario()?.permisos ?? []);
  puede(p: string): boolean { return this.auth.puede(p); }
=======
  readonly totalOpciones = computed(() =>
    this.auth.menu().reduce((n, g) => n + g.opciones.length, 0),
  );
>>>>>>> Stashed changes
}
