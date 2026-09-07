<<<<<<< Updated upstream
/** Consulta de stock por bodega, con la señal de reposición. */
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonBadge, IonButtons, IonCheckbox, IonContent, IonHeader, IonItem, IonMenuButton,
  IonSearchbar, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';

import { ApiService, mensajeDeError } from '../core/api.service';
import { clp, type FilaStock } from '../core/modelos';
=======
/**
 * MATERIAL_X_BODEGA: saldo de materiales por bodega.
 *
 * El ajuste de stock vive dentro de esta pantalla, igual que en el ERP: no es
 * una opcion de menu aparte, es una accion sobre una fila del listado.
 */
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonMenuButton,
  IonNote, IonSearchbar, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';

import { API, AuthService } from '../core/auth.service';

export interface Bodega { bodega: number; descr: string; ccosto: string; estado: string; }
interface FilaStock {
  cod_material: string; nombre: string; estado: string;
  id_bodega: number; bodega: string; stock: number;
  unidad: string; tarifa: number; stock_minimo: number;
}
>>>>>>> Stashed changes

@Component({
  selector: 'app-stock',
  imports: [
    FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent,
<<<<<<< Updated upstream
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
=======
    IonSearchbar, IonSelect, IonSelectOption, IonSpinner, IonNote, IonButton, IonItem, IonInput,
  ],
  styles: [`
    .barra { display: flex; align-items: center; gap: 10px; padding: 4px 8px; flex-wrap: wrap; }
    .barra ion-searchbar { flex: 1; min-width: 220px; }
    ion-select { max-width: 300px; }
    .conteo { font-size: 12px; color: var(--ion-color-medium); white-space: nowrap; padding-right: 12px; }
    .tabla { overflow-x: auto; padding: 0 12px 20px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
         color: var(--ion-color-medium); padding: 8px 10px;
         border-bottom: 1px solid var(--ion-color-light-shade); white-space: nowrap; }
    td { padding: 7px 10px; border-bottom: 1px solid var(--ion-color-light); white-space: nowrap; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .bajo { color: var(--ion-color-danger); font-weight: 600; }
    .vacio { padding: 40px 20px; text-align: center; color: var(--ion-color-medium); }
    .aviso { color: var(--ion-color-danger); padding: 8px 14px; font-size: 13px; }
    .ok { color: var(--ion-color-success); padding: 8px 14px; font-size: 13px; }
    .ficha { padding: 8px 14px 20px; max-width: 460px; }
  `],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
      <ion-title>Materiales por bodega</ion-title>
    </ion-toolbar></ion-header>

    <ion-content>
      @if (error()) { <div class="aviso">{{ error() }}</div> }
      @if (mensaje()) { <div class="ok">{{ mensaje() }}</div> }

      @if (ajustando(); as f) {
        <div class="ficha">
          <ion-note>Ajuste de stock — {{ f.cod_material }}</ion-note>
          <p>{{ f.nombre }}</p>
          <ion-item>
            <ion-input label="Stock actual" labelPlacement="stacked"
                       [value]="f.stock" disabled="true"></ion-input>
          </ion-item>
          <ion-item>
            <ion-input label="Stock que debe quedar" labelPlacement="stacked"
                       type="number" [(ngModel)]="nuevoStock"></ion-input>
          </ion-item>
          <ion-item>
            <ion-input label="Motivo" labelPlacement="stacked"
                       [(ngModel)]="motivo" placeholder="Inventario físico"></ion-input>
          </ion-item>
          <div class="barra">
            <ion-button (click)="confirmarAjuste()" [disabled]="trabajando()">Confirmar</ion-button>
            <ion-button fill="clear" (click)="ajustando.set(null)">Cancelar</ion-button>
          </div>
        </div>
      } @else {
        <div class="barra">
          <ion-select label="Bodega" labelPlacement="stacked" interface="popover"
                      [value]="bodega()" (ionChange)="bodega.set($any($event).detail.value)">
            <ion-select-option [value]="0">Todas</ion-select-option>
            @for (b of bodegas(); track b.bodega) {
              <ion-select-option [value]="b.bodega">{{ b.descr }}</ion-select-option>
            }
          </ion-select>
          <ion-searchbar placeholder="Código o nombre" [debounce]="350"
                         (ionInput)="buscar.set($any($event).detail.value ?? '')"></ion-searchbar>
          <span class="conteo">{{ datos().length }} materiales</span>
        </div>

        @if (cargando()) {
          <div class="vacio"><ion-spinner></ion-spinner></div>
        } @else if (datos().length === 0) {
          <div class="vacio">Sin resultados. Elegí una bodega o buscá por código.</div>
        } @else {
          <div class="tabla">
            <table>
              <thead><tr>
                <th>Código</th><th>Material</th><th>Bodega</th><th>Unidad</th>
                <th class="num">Stock</th><th class="num">Mínimo</th><th class="num">Tarifa</th><th></th>
              </tr></thead>
              <tbody>
                @for (f of datos(); track f.cod_material + '-' + f.id_bodega) {
                  <tr>
                    <td>{{ f.cod_material }}</td>
                    <td>{{ f.nombre }}</td>
                    <td>{{ f.bodega }}</td>
                    <td>{{ f.unidad }}</td>
                    <td class="num" [class.bajo]="f.stock < f.stock_minimo">{{ f.stock }}</td>
                    <td class="num">{{ f.stock_minimo }}</td>
                    <td class="num">{{ moneda(f.tarifa) }}</td>
                    <td>
                      @if (puedeAjustar()) {
                        <ion-button size="small" fill="clear" (click)="abrirAjuste(f)">Ajustar</ion-button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
>>>>>>> Stashed changes
      }
    </ion-content>
  `,
})
export class StockPage {
<<<<<<< Updated upstream
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
=======
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly bodegas = signal<Bodega[]>([]);
  readonly datos = signal<FilaStock[]>([]);
  readonly bodega = signal(0);
  readonly buscar = signal('');
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly trabajando = signal(false);
  readonly ajustando = signal<FilaStock | null>(null);

  nuevoStock: number | null = null;
  motivo = '';

  moneda = (n: unknown) => n == null ? '' : '$' + Math.round(Number(n)).toLocaleString('es-CL');
  puedeAjustar = () => (this.auth.sesion()?.permisos ?? []).includes('MATERIAL_X_BODEGA');

  constructor() {
    void this.cargarBodegas();
    effect(() => {
      const b = this.bodega(); const q = this.buscar();
      // Sin bodega ni busqueda el listado seria enorme: se pide algo primero.
      if (!b && !q.trim()) { this.datos.set([]); return; }
      void this.cargar(b, q);
    });
  }

  private async cargarBodegas(): Promise<void> {
    try {
      this.bodegas.set(await firstValueFrom(this.http.get<Bodega[]>(`${API}/bodega/bodegas`)));
    } catch { this.bodegas.set([]); }
  }

  private async cargar(bodega: number, buscar: string): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const q = new URLSearchParams();
      if (bodega) q.set('bodega', String(bodega));
      if (buscar.trim()) q.set('buscar', buscar.trim());
      this.datos.set(
        await firstValueFrom(this.http.get<FilaStock[]>(`${API}/bodega/stock?${q}`)),
      );
    } catch (e: any) {
      this.datos.set([]);
      this.error.set(e?.error?.message ?? 'No se pudo cargar el stock');
>>>>>>> Stashed changes
    } finally {
      this.cargando.set(false);
    }
  }
<<<<<<< Updated upstream
=======

  abrirAjuste(f: FilaStock): void {
    this.mensaje.set(''); this.error.set('');
    this.nuevoStock = f.stock;
    this.motivo = '';
    this.ajustando.set(f);
  }

  async confirmarAjuste(): Promise<void> {
    const f = this.ajustando();
    if (!f) return;
    if (!this.motivo.trim()) { this.error.set('El ajuste necesita un motivo'); return; }
    this.trabajando.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(this.http.post<{ anterior: number; nuevo: number }>(
        `${API}/bodega/ajuste`,
        {
          bodega: f.id_bodega, cod_material: f.cod_material,
          stockNuevo: Number(this.nuevoStock), motivo: this.motivo.trim(),
        },
      ));
      this.mensaje.set(`${f.cod_material}: ${r.anterior} → ${r.nuevo}`);
      this.ajustando.set(null);
      await this.cargar(this.bodega(), this.buscar());
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo ajustar');
    } finally {
      this.trabajando.set(false);
    }
  }
>>>>>>> Stashed changes
}
