import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
<<<<<<< Updated upstream
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
=======
import {
  IonButton, IonContent, IonInput, IonItem, IonList, IonNote, IonSpinner,
} from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';
>>>>>>> Stashed changes

@Component({
  selector: 'app-login',
  imports: [FormsModule, IonContent, IonList, IonItem, IonInput, IonButton, IonNote, IonSpinner],
<<<<<<< Updated upstream
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
=======
  styles: [`
    .caja { max-width: 380px; margin: 12vh auto; padding: 0 20px; }
    .marca { text-align: center; margin-bottom: 26px; }
    .marca h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: -.02em; }
    .error { color: var(--ion-color-danger); display: block; margin: 14px 2px; }
    .pie { text-align: center; margin-top: 22px; font-size: 12px; color: var(--ion-color-medium); }
  `],
  template: `
    <ion-content>
      <div class="caja">
        <div class="marca">
          <h1>ERP</h1>
          <ion-note>Réplica local</ion-note>
        </div>
>>>>>>> Stashed changes

        <form (ngSubmit)="entrar()">
          <ion-list inset="true">
            <ion-item>
<<<<<<< Updated upstream
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
=======
              <ion-input label="Usuario" labelPlacement="floating" name="user"
                         [(ngModel)]="user" autocomplete="username" required></ion-input>
            </ion-item>
            <ion-item>
              <ion-input label="Clave" labelPlacement="floating" type="password" name="clave"
                         [(ngModel)]="clave" autocomplete="current-password" required></ion-input>
            </ion-item>
          </ion-list>

          @if (error()) { <ion-note class="error">{{ error() }}</ion-note> }
          @else if (auth.motivoSalida()) { <ion-note class="error">{{ auth.motivoSalida() }}</ion-note> }

          <ion-button expand="block" type="submit" [disabled]="cargando()">
            @if (cargando()) { <ion-spinner name="dots"></ion-spinner> } @else { Entrar }
          </ion-button>
        </form>

        <div class="pie">El usuario distingue mayúsculas, igual que el ERP.</div>
>>>>>>> Stashed changes
      </div>
    </ion-content>
  `,
})
export class LoginPage {
<<<<<<< Updated upstream
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
=======
  readonly auth = inject(AuthService);
  user = '';
  clave = '';
  readonly error = signal('');
  readonly cargando = signal(false);

  async entrar(): Promise<void> {
    this.error.set('');
    this.auth.motivoSalida.set('');
    this.cargando.set(true);
    try {
      await this.auth.entrar(this.user.trim(), this.clave);
    } catch (e: any) {
      this.error.set(
        e?.status === 0
          ? 'Sin conexión con el backend. ¿Está corriendo en el puerto 3000?'
          : e?.error?.message ?? 'No se pudo iniciar sesión',
      );
>>>>>>> Stashed changes
    } finally {
      this.cargando.set(false);
    }
  }
}
