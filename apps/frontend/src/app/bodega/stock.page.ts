/** Consulta de stock por bodega, con la señal de reposición. */
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonBadge, IonButtons, IonCheckbox, IonContent, IonHeader, IonItem, IonMenuButton,
  IonSearchbar, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';

import { ApiService, mensajeDeError } from '../core/api.service';
import { clp, type FilaStock } from '../core/modelos';

@Component({
  selector: 'app-stock',
  imports: [
    FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent,
    IonSearchbar, IonSelect, IonSelectOption, IonSpinner, IonBadge, IonItem, IonCheckbox,
  ],
  styles: [
    `
      .barra { display: flex; gap: 12px; align-items: center; padding: 8px 12px; flex-wrap: wrap; }
      .barra ion-searchbar { flex: 1 1 220px; padding: 0; }
      .envoltura { overflow-x: auto; padding: 0 12px 16px; }
      table { border-collapse: collapse; width: 100%; font-size: 14px; }
      th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--ion-color-light-shade); white-space: nowrap; }
      th { font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--ion-color-medium); font-weight: 600; }
      td.num { text-align: right; font-variant-numeric: tabular-nums; }
      tr.alerta td { background: rgba(255, 196, 9, 0.09); }
      .vacio, .error { padding: 32px 16px; text-align: center; color: var(--ion-color-medium); }
      .error { color: var(--ion-color-danger); }
      .resumen { padding: 4px 16px 18px; font-size: 13px; color: var(--ion-color-medium); }
    `,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Stock por bodega</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="barra">
        <ion-searchbar placeholder="Código o nombre" [debounce]="250"
          (ionInput)="texto.set($any($event).detail.value ?? '')"></ion-searchbar>
        <ion-select placeholder="Todas las bodegas" interface="popover"
          [(ngModel)]="bodega" (ionChange)="cargar()" style="min-width:190px">
          <ion-select-option [value]="''">Todas las bodegas</ion-select-option>
          @for (b of bodegas(); track b.codigo) {
            <ion-select-option [value]="b.codigo">{{ b.nombre }}</ion-select-option>
          }
        </ion-select>
        <ion-item lines="none">
          <ion-checkbox [(ngModel)]="soloBajos" (ionChange)="cargar()">Solo bajo mínimo</ion-checkbox>
        </ion-item>
      </div>

      @if (cargando()) {
        <div class="vacio"><ion-spinner name="crescent"></ion-spinner></div>
      } @else if (error()) {
        <div class="error">{{ error() }}</div>
      } @else if (visibles().length === 0) {
        <div class="vacio">Sin resultados.</div>
      } @else {
        <div class="envoltura">
          <table>
            <thead>
              <tr>
                <th style="width:110px">Código</th>
                <th>Material</th>
                <th style="width:80px">Unidad</th>
                <th>Bodega</th>
                <th style="width:100px">Stock</th>
                <th style="width:100px">Mínimo</th>
                <th style="width:120px">Tarifa</th>
                <th style="width:110px">Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (f of visibles(); track f.materialId + '-' + f.bodegaId) {
                <tr [class.alerta]="f.bajoMinimo">
                  <td>{{ f.codMaterial }}</td>
                  <td>{{ f.nombre }}</td>
                  <td>{{ f.unidad }}</td>
                  <td>{{ f.bodega }}</td>
                  <td class="num">{{ f.stock }}</td>
                  <td class="num">{{ f.stockMinimo }}</td>
                  <td class="num">{{ moneda(f.tarifa) }}</td>
                  <td>
                    @if (f.bajoMinimo) {
                      <ion-badge color="warning">Reponer</ion-badge>
                    } @else {
                      <ion-badge color="light">OK</ion-badge>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="resumen">
          {{ visibles().length }} fila(s) · {{ bajoMinimo() }} bajo el mínimo
        </div>
      }
    </ion-content>
  `,
})
export class StockPage {
  private readonly api = inject(ApiService);

  readonly filas = signal<FilaStock[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly texto = signal('');

  bodega = '';
  soloBajos = false;

  readonly moneda = clp;

  /** El filtro de texto es local: la consulta ya trae el stock completo. */
  readonly visibles = computed(() => {
    const t = this.texto().trim().toLowerCase();
    if (!t) return this.filas();
    return this.filas().filter(
      (f) => f.codMaterial.toLowerCase().includes(t) || f.nombre.toLowerCase().includes(t),
    );
  });

  readonly bajoMinimo = computed(() => this.visibles().filter((f) => f.bajoMinimo).length);

  readonly bodegas = computed(() => {
    const vistas = new Map<number, string>();
    for (const f of this.filas()) vistas.set(f.bodegaCodigo, f.bodega);
    return [...vistas].map(([codigo, nombre]) => ({ codigo, nombre }));
  });

  ionViewWillEnter(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.filas.set(
        await this.api.stock({
          bodega: this.bodega || undefined,
          bajoMinimo: this.soloBajos ? 'true' : undefined,
        }),
      );
    } catch (e) {
      this.error.set(mensajeDeError(e));
      this.filas.set([]);
    } finally {
      this.cargando.set(false);
    }
  }
}
