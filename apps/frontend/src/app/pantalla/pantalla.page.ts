/**
 * Marcador de posicion para cada opcion del menu que todavia no tiene pantalla.
 * Cuando una capa se construya, su ruta reemplaza a esta.
 */
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import {
  IonButtons, IonContent, IonHeader, IonMenuButton, IonNote, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-pantalla',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent, IonNote],
  styles: [`
    .cuerpo { padding: 24px; max-width: 640px; }
    code { background: var(--ion-color-light); padding: 2px 7px; border-radius: 4px; font-size: 13px; }
    p { color: var(--ion-color-medium); font-size: 14px; line-height: 1.55; }
  `],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
      <ion-title>{{ titulo() }}</ion-title>
    </ion-toolbar></ion-header>

    <ion-content>
      <div class="cuerpo">
        <ion-note>Pendiente de construir</ion-note>
        <p>
          Esta opción existe en <code>acceso_funciones</code> y tu perfil tiene el
          permiso <code>{{ codigo() }}</code>, pero la pantalla todavía no está hecha.
        </p>
      </div>
    </ion-content>
  `,
})
export class PantallaPage {
  private readonly auth = inject(AuthService);
  readonly codigo = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('codigo') ?? '')),
    { initialValue: '' },
  );
  titulo = () => {
    const c = this.codigo();
    for (const g of this.auth.menu()) {
      const o = g.opciones.find((x) => x.codigo === c);
      if (o) return o.titulo;
    }
    return c;
  };
}
