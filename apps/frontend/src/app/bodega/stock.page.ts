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
  IonButton, IonContent, IonInput,
  IonNote, IonSearchbar, IonSelect, IonSelectOption, IonSkeletonText,
} from '@ionic/angular/standalone';

import { API, AuthService } from '../core/auth.service';
import { PageHeaderComponent } from '../shared/page-header.component';
import { stockState } from './stock-state';

export interface Bodega { bodega: number; descr: string; ccosto: string; estado: string; }
interface FilaStock {
  cod_material: string; nombre: string; estado: string;
  id_bodega: number; bodega: string; stock: number;
  unidad: string; tarifa: number; stock_minimo: number;
}

@Component({
  selector: 'app-stock',
  imports: [
    FormsModule, PageHeaderComponent, IonContent,
    IonSearchbar, IonSelect, IonSelectOption, IonSkeletonText, IonNote, IonButton, IonInput,
  ],
  styles: [`
    ion-select { max-width: 300px; }
    .sa-toolbar ion-searchbar { flex: 1; min-width: 220px; }
    .ficha { padding: var(--sa-space-2) var(--sa-space-3) var(--sa-space-5); max-width: 460px; }
    .skeleton-table { padding: 0 var(--sa-space-3) var(--sa-space-5); }
    .skeleton-table ion-skeleton-text { margin-bottom: var(--sa-space-1); }
  `],
  template: `
    <app-page-header title="Materiales por bodega"></app-page-header>

    <ion-content>
      <div class="page-content page-content--wide">
      @if (error()) { <div class="sa-notice sa-notice--crit">{{ error() }}</div> }
      @if (mensaje()) { <div class="sa-notice sa-notice--ok">{{ mensaje() }}</div> }

      @if (ajustando(); as f) {
        <div class="ficha">
          <ion-note>Ajuste de stock: {{ f.cod_material }}</ion-note>
          <p>{{ f.nombre }}</p>
          <ion-input label="Stock actual" labelPlacement="stacked" fill="outline"
                       [value]="f.stock" disabled="true"></ion-input>
          <ion-input label="Stock que debe quedar" labelPlacement="stacked" fill="outline"
                       type="number" [(ngModel)]="nuevoStock"></ion-input>
          <ion-input label="Motivo" labelPlacement="stacked" fill="outline"
                       [(ngModel)]="motivo" placeholder="Inventario físico"></ion-input>
          <div class="sa-toolbar">
            <ion-button (click)="confirmarAjuste()" [disabled]="trabajando()">Confirmar</ion-button>
            <ion-button fill="outline" (click)="ajustando.set(null)">Cancelar</ion-button>
          </div>
        </div>
      } @else {
        <div class="sa-toolbar">
          <ion-select label="Bodega" labelPlacement="stacked" fill="outline" interface="popover"
                      [value]="bodega()" (ionChange)="bodega.set($any($event).detail.value)">
            <ion-select-option [value]="0">Todas</ion-select-option>
            @for (b of bodegas(); track b.bodega) {
              <ion-select-option [value]="b.bodega">{{ b.descr }}</ion-select-option>
            }
          </ion-select>
          <ion-searchbar placeholder="Código o nombre" [debounce]="350"
                         (ionInput)="buscar.set($any($event).detail.value ?? '')"></ion-searchbar>
          <span class="sa-count">{{ datos().length }} materiales</span>
        </div>

        @if (cargando()) {
          <div class="skeleton-table">
            <ion-skeleton-text [animated]="true" style="width: 100%; height: 24px;"></ion-skeleton-text>
            <ion-skeleton-text [animated]="true" style="width: 100%; height: 24px;"></ion-skeleton-text>
            <ion-skeleton-text [animated]="true" style="width: 100%; height: 24px;"></ion-skeleton-text>
            <ion-skeleton-text [animated]="true" style="width: 100%; height: 24px;"></ion-skeleton-text>
            <ion-skeleton-text [animated]="true" style="width: 100%; height: 24px;"></ion-skeleton-text>
          </div>
        } @else if (datos().length === 0) {
          <div class="sa-empty">
            <div class="title">Sin resultados</div>
            <div class="text">Elige una bodega o busca por código</div>
          </div>
        } @else {
          <div class="sa-table-wrap">
            <table class="sa-table">
              <thead><tr>
                <th class="code">Código</th><th>Material</th><th>Bodega</th><th>Unidad</th>
                <th class="num">Stock</th><th class="num">Mínimo</th><th class="num">Tarifa</th><th>Estado</th><th></th>
              </tr></thead>
              <tbody>
                @for (f of datos(); track f.cod_material + '-' + f.id_bodega) {
                  @let estado = estadoStock(f.stock, f.stock_minimo);
                  <tr>
                    <td class="code">{{ f.cod_material }}</td>
                    <td>{{ f.nombre }}</td>
                    <td>{{ f.bodega }}</td>
                    <td>{{ f.unidad }}</td>
                    <td class="num" [class.is-low]="estado !== 'ok'">{{ f.stock }}</td>
                    <td class="num">{{ f.stock_minimo }}</td>
                    <td class="num">{{ moneda(f.tarifa) }}</td>
                    <td>
                      @if (estado === 'crit') {
                        <span class="sa-pill sa-pill--crit">SIN STOCK</span>
                      } @else if (estado === 'warn') {
                        <span class="sa-pill sa-pill--warn">BAJO MÍNIMO</span>
                      } @else {
                        <span class="sa-pill sa-pill--ok">OK</span>
                      }
                    </td>
                    <td>
                      @if (puedeAjustar()) {
                        <ion-button size="small" fill="outline" (click)="abrirAjuste(f)">Ajustar</ion-button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
      </div>
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
  readonly estadoStock = stockState;

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