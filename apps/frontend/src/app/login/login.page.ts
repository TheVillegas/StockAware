import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton, IonContent, IonInput, IonItem, IonList, IonNote, IonSpinner,
} from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, IonContent, IonList, IonItem, IonInput, IonButton, IonNote, IonSpinner],
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

        <form (ngSubmit)="entrar()">
          <ion-list inset="true">
            <ion-item>
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
      </div>
    </ion-content>
  `,
})
export class LoginPage {
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
    } finally {
      this.cargando.set(false);
    }
  }
}
