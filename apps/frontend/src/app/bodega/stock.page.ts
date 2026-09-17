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

@Component({
  selector: 'app-stock',
  imports: [
    FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent,
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
      }
    </ion-content>
  `,
})
export class StockPage {
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
    } finally {
      this.cargando.set(false);
    }
  }

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
}
