/**
 * Configuracion: un solo indice para los maestros.
 *
 * Antes eran diecisiete entradas sueltas en el menu. Aca se separan los datos
 * que se tocan en la operacion diaria de los ajustes del sistema; cada fila
 * abre el mantenedor generico en /f/<codigo>.
 */
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonNote, IonSearchbar } from '@ionic/angular/standalone';
import { chevronForwardOutline } from 'ionicons/icons';
import { AuthService } from '../core/auth.service';
import { PageHeaderComponent } from '../shared/page-header.component';
import { SaPageHead } from '../shared/sa-page-head.component';
import { maestrosConfiguracion } from '../shared/workspace-navigation';

/** Plain name and purpose for each maestro; ERP titles like "Mantenedor Bodegas" are not shown. */
const MAESTROS: Record<string, [string, string]> = {
  ADM_MAT_FUN: ['Materiales', 'Catálogo de materiales y su stock mínimo'],
  ADM_BODEGA: ['Bodegas', 'Bodegas y su centro de costo'],
  ADM_PROVEEDOR: ['Proveedores', 'Proveedores para órdenes de compra'],
  ADM_CCOSTO: ['Centros de costo', 'Centros de costo y proyectos'],
  ADM_EQUIPOS: ['Equipos y herramientas', 'Equipos asignables a terreno'],
  ADM_VEHICULO: ['Vehículos', 'Flota de vehículos'],
  ADM_PERSONAL: ['Personal', 'Personas que reciben entregas'],
  ADM_CLIENTE: ['Clientes', 'Clientes y terceros'],
  ADM_U_OBRA: ['Unidades de obra', 'Unidades de medida de obra'],
  ADM_EMPRESA: ['Empresa', 'Razón social y datos tributarios'],
  ADM_BANCO_CTA: ['Cuentas bancarias', 'Cuentas corrientes de la empresa'],
  ADM_VAL_ECONOMICO: ['Indicadores económicos', 'UF, dólar y otros valores diarios'],
  ADM_COMUNA: ['Comunas', 'Tabla de referencia geográfica'],
  ADM_CATEGORIA: ['Categorías', 'Categorías de gasto'],
  ADM_AREAS: ['Áreas', 'Áreas de la empresa'],
  ADM_LUGAR_TRABAJO: ['Lugares de trabajo', 'Faenas y sedes'],
  PERFILES: ['Perfiles de acceso', 'Nombre y pantalla de inicio de cada perfil'],
};

@Component({
  selector: 'app-configuracion',
  imports: [PageHeaderComponent, SaPageHead, IonContent, IonIcon, IonNote, IonSearchbar, RouterLink],
  styles: [`
    .grupo { padding: var(--sa-space-4); }
    ion-searchbar { max-inline-size: 28rem; padding: 0; margin-bottom: var(--sa-space-4); }
  `],
  template: `
    <app-page-header title="Configuración"></app-page-header>

    <ion-content>
      <div class="page-content page-content--wide">
        <sa-page-head title="Configuración" area="sistema" icon="settings"
                      subtitle="Datos maestros que usan las compras, la bodega y el balance. Los datos del negocio cambian seguido; los ajustes del sistema casi nunca." />
        <ion-searchbar placeholder="Buscar maestro" [debounce]="150"
                       (ionInput)="filtro.set($any($event).detail.value ?? '')"></ion-searchbar>

        @if (grupos().length) {
          <div class="sa-panels">
            @for (g of grupos(); track g.key) {
              <section class="sa-panel grupo" [attr.aria-label]="g.titulo">
                <h2 class="sa-panel__title">{{ g.titulo }}</h2>
                @for (o of g.opciones; track o.codigo) {
                  <a class="sa-entry" [routerLink]="['/f', o.codigo]">
                    <span class="sa-entry__text"><span>{{ nombre(o) }}</span><small>{{ detalle(o.codigo) }}</small></span>
                    <ion-icon class="sa-entry__go" [icon]="flecha" aria-hidden="true"></ion-icon>
                  </a>
                }
              </section>
            }
          </div>
        } @else {
          <ion-note>{{ filtro() ? 'Ningún maestro coincide con la búsqueda.' : 'Tu perfil no tiene maestros disponibles.' }}</ion-note>
        }
      </div>
    </ion-content>
  `,
})
export class ConfiguracionPage {
  private readonly auth = inject(AuthService);
  readonly flecha = chevronForwardOutline;
  readonly filtro = signal('');

  readonly grupos = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    return maestrosConfiguracion(this.auth.menu())
      .map((g) => ({
        ...g,
        opciones: g.opciones.filter((o: { codigo: string; titulo: string }) => !texto
          || `${this.nombre(o)} ${this.detalle(o.codigo)}`.toLowerCase().includes(texto)),
      }))
      .filter((g) => g.opciones.length > 0);
  });

  nombre(o: { codigo: string; titulo: string }): string {
    return MAESTROS[o.codigo]?.[0] ?? o.titulo;
  }

  detalle(codigo: string): string {
    return MAESTROS[codigo]?.[1] ?? '';
  }
}
