import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonList,
  IonNote,
  IonSpinner,
} from '@ionic/angular';

import { AuthService } from '../core/auth.service';
import { mensajeDeError } from '../core/api.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, IonContent, IonList, IonItem, IonInput, IonButton, IonNote, IonSpinner],
  styles: [
    `
      .caja {
        max-width: 380px;
        margin: 0 auto;
        padding: 12vh 20px 20px;
      }
      h1 {
        font-size: 26px;
        font-weight: 700;
        margin: 0 0 4px;
        letter-spacing: -0.02em;
      }
      .bajada {
        color: var(--ion-color-medium);
        font-size: 14px;
        margin: 0 0 26px;
      }
      .error {
        display: block;
        margin: 14px 2px 0;
        color: var(--ion-color-danger);
        font-size: 13px;
        line-height: 1.45;
      }
      .ayuda {
        margin-top: 28px;
        padding-top: 16px;
        border-top: 1px solid var(--ion-color-light-shade);
        font-size: 12.5px;
        color: var(--ion-color-medium);
        line-height: 1.6;
      }
      code {
        font-family: ui-monospace, monospace;
        background: var(--ion-color-light);
        padding: 1px 5px;
        border-radius: 3px;
      }
    `,
  ],
  template: `
    <ion-content>
      <div class="caja">
        <h1>StockAware</h1>
        <p class="bajada">Compras y bodega</p>

        <form (ngSubmit)="entrar()">
          <ion-list inset="true">
            <ion-item>
              <ion-input
                label="Usuario"
                labelPlacement="stacked"
                name="username"
                autocomplete="username"
                [(ngModel)]="username"
                required
              ></ion-input>
            </ion-item>
            <ion-item>
              <ion-input
                label="Contraseña"
                labelPlacement="stacked"
                type="password"
                name="password"
                autocomplete="current-password"
                [(ngModel)]="password"
                required
              ></ion-input>
            </ion-item>
          </ion-list>

          <ion-button expand="block" type="submit" [disabled]="cargando()">
            @if (cargando()) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              Entrar
            }
          </ion-button>
        </form>

        @if (error()) {
          <ion-note class="error">{{ error() }}</ion-note>
        }

        <p class="ayuda">
          Usuarios de prueba: <code>admin</code>, <code>bodega</code> y
          <code>compras</code>. Todos con la clave <code>stockaware</code>. Cada
          uno tiene un perfil distinto, así que el menú cambia según quién entre.
        </p>
      </div>
    </ion-content>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  username = 'admin';
  password = '';
  readonly cargando = signal(false);
  readonly error = signal('');

  async entrar(): Promise<void> {
    this.error.set('');
    this.cargando.set(true);
    try {
      await this.auth.login(this.username.trim(), this.password);
      await this.router.navigate(['/inicio']);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
