import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonNote } from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';
import { PageHeaderComponent } from '../shared/page-header.component';
import { agruparAccesosInicio } from '../shared/workspace-navigation';

@Component({
  selector: 'app-inicio',
  imports: [PageHeaderComponent, IonContent, IonNote, RouterLink],
  styles: [`
    .cuerpo { padding: 0; }
    .contexto { padding: 18px 0 24px; border-bottom: 1px solid var(--ion-color-light-shade); }
    .contexto h2 { margin: 0 0 6px; font-size: clamp(24px, 4vw, 32px); letter-spacing: -.03em; }
    .contexto p { margin: 0; color: var(--ion-color-medium); }
    h2 { margin: 28px 0 16px; font-size: 18px; letter-spacing: -.015em; }
    .grupos { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 270px), 1fr)); gap: 24px; }
    .grupo { min-width: 0; }
    .grupo h3 { margin: 0 0 10px; font-size: 14px; font-weight: 600; color: var(--ion-color-medium-shade); }
    .opciones { display: grid; gap: 8px; }
    .opcion { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 52px; padding: 12px 14px; border: 1px solid var(--ion-color-light-shade); border-radius: 8px; color: var(--ion-text-color); text-decoration: none; background: var(--ion-background-color); }
    a.opcion:hover { border-color: var(--ion-color-primary); }
    a.opcion:focus-visible { outline: 3px solid var(--ion-color-primary); outline-offset: 2px; }
    .estado { flex: none; color: var(--ion-color-medium); font-size: 12px; }
    .sin-opciones { color: var(--ion-color-medium); }
  `],
  template: `
    <app-page-header title="Inicio"></app-page-header>

    <ion-content>
      <main class="cuerpo page-content">
        <section class="contexto" aria-labelledby="bienvenida">
          <h2 id="bienvenida">Hola, {{ auth.sesion()?.nombre }}</h2>
          <p>Tu espacio de trabajo · Perfil {{ auth.sesion()?.perfil }}</p>
        </section>

        <section aria-labelledby="accesos">
          <h2 id="accesos">Accesos de trabajo</h2>
          @if (accesosRapidos().length) {
            <div class="grupos">
              @for (grupo of accesosRapidos(); track grupo.titulo) {
                <section class="grupo" [attr.aria-label]="grupo.titulo">
                  <h3>{{ grupo.titulo }}</h3>
                  <div class="opciones">
                    @for (opcion of grupo.opciones; track opcion.codigo) {
                      @if (opcion.implementada) {
                        <a class="opcion" [routerLink]="['/f', opcion.codigo]">
                          <span>{{ opcion.titulo }}</span><span class="estado" aria-hidden="true">Abrir →</span>
                        </a>
                      }
                    }
                  </div>
                </section>
              }
            </div>
          } @else {
            <ion-note class="sin-opciones">No hay accesos disponibles para tu perfil.</ion-note>
          }
        </section>
      </main>
    </ion-content>
  `,
})
export class InicioPage {
  readonly auth = inject(AuthService);
  readonly accesosRapidos = computed(() => agruparAccesosInicio(this.auth.menu()));
}
