import { Component, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';
import { SaField } from '../shared/sa-field.component';
import { SaIcon } from '../shared/sa-icon.component';

@Component({
  selector: 'app-login',
  imports: [IonButton, IonContent, IonSpinner, SaField, SaIcon],
  template: `
    <ion-content class="sa-login" data-visual="ep1">
      <div class="sa-login__frame">
        <section class="sa-login__brand" aria-labelledby="login-brand">
          <div class="sa-login__logo">
            <span class="sa-login__logo-mark"><sa-icon name="warehouse" [size]="22" [stroke]="2" /></span>
            <span id="login-brand">StockAware</span>
          </div>
          <div class="sa-login__pitch">
            <h2>Compras, bodega y finanzas en un solo lugar</h2>
            <ul class="sa-login__areas">
              <li data-area="compras"><sa-icon name="orders" /><span><strong>Compras</strong>Emite, aprueba y recibe órdenes.</span></li>
              <li data-area="bodega"><sa-icon name="warehouse" /><span><strong>Bodega</strong>Sabe qué reponer antes de que falte.</span></li>
              <li data-area="finanzas"><sa-icon name="chart" /><span><strong>Finanzas</strong>Reparte facturas y sigue el gasto.</span></li>
            </ul>
          </div>
          <p class="sa-login__foot">Ingeniería Web Avanzada · Réplica local del ERP</p>
        </section>

        <div class="sa-login__panel">
          <form class="sa-card" (submit)="entrar($event)">
            <div class="sa-brand">
              <div class="sa-brand__text">
                <h1>Ingresa a StockAware</h1>
                <p>Usa el mismo usuario y clave del ERP.</p>
              </div>
            </div>

            <div class="sa-form">
              <sa-field label="Usuario" name="user" icon="assets/visual/user.svg"
                        autocomplete="username" enterkeyhint="next"
                        [(value)]="user" [required]="true" />
              <sa-field label="Clave" name="clave" type="password" icon="assets/visual/lock.svg"
                        autocomplete="current-password" enterkeyhint="done"
                        [(value)]="clave" [required]="true" />
            </div>

            @if (error()) { <p class="sa-login__error" role="alert">{{ error() }}</p> }
            @else if (auth.motivoSalida()) { <p class="sa-login__error" role="alert">{{ auth.motivoSalida() }}</p> }

            <ion-button class="sa-btn" expand="block" type="submit" [disabled]="cargando()"
                        [attr.aria-label]="cargando() ? 'Ingresando' : null">
              @if (cargando()) { <ion-spinner name="dots" aria-hidden="true"></ion-spinner> } @else { Entrar }
            </ion-button>

            <p class="sa-hint">
              <img src="assets/visual/alert.svg" alt="" />
              El usuario distingue mayúsculas, igual que el ERP.
            </p>
          </form>
        </div>
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

  async entrar(event: Event): Promise<void> {
    event.preventDefault();
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
