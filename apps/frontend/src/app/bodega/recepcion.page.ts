/**
 * ING_MATERIAL: ingresa a bodega el material de una HES.
 *
 * El codigo del material no es una llave: viene incrustado en el texto de la
 * linea, con el formato "DESCRIPCION/MC_123". La pantalla muestra que codigo
 * resolvio cada linea ANTES de cargar, porque si alguna no resuelve la carga
 * completa se rechaza.
 */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  IonButton, IonContent, IonInput,
  IonNote, IonSelect, IonSelectOption, IonSkeletonText,
} from '@ionic/angular/standalone';

import { API } from '../core/auth.service';
import type { Bodega } from './stock.page';
import { PageHeaderComponent } from '../shared/page-header.component';

interface LineaHes {
  id: number; nombre: string; descripcion: string; cantidad: number;
  unidad: string; precio_uni: number; total: number;
  ccosto: string; ccosto_ap: string; cod_material: string | null;
}
interface Hes { numdoc: number; ccosto: string; yaCargada: boolean; lineas: LineaHes[]; }

@Component({
  selector: 'app-recepcion',
  imports: [
    FormsModule, PageHeaderComponent, IonContent,
    IonSelect, IonSelectOption, IonSkeletonText, IonButton, IonInput, IonNote,
  ],
  styles: [`
    h3 { font-size: var(--sa-text-label); text-transform: uppercase; letter-spacing: .06em;
         color: var(--sa-ink-soft); margin: var(--sa-space-5) 0 var(--sa-space-1); font-weight: 600; }
    .fila { display: flex; gap: var(--sa-space-3); flex-wrap: wrap; align-items: flex-end; }
    .fila > * { flex: 1; min-width: 200px; }
    .fila > ion-button { flex: none; min-width: 0; }
    .sinCodigo { color: var(--sa-crit-fg); font-weight: 600; }
    .acciones { display: flex; gap: var(--sa-space-2); margin-top: var(--sa-space-5); }
    .nota { font-size: var(--sa-text-meta); color: var(--sa-ink-soft); margin-top: var(--sa-space-2); line-height: 1.5; }
  `],
  template: `
    <app-page-header title="Recibe material fungible"></app-page-header>

    <ion-content>
      <div class="cuerpo page-content">
        @if (error()) { <div class="sa-notice sa-notice--crit">{{ error() }}</div> }
        @if (mensaje()) { <div class="sa-notice sa-notice--ok">{{ mensaje() }}</div> }

        <div class="fila">
          <ion-input label="Número de HES" labelPlacement="stacked" fill="outline" type="number"
                       [(ngModel)]="numdoc" (keyup.enter)="cargarHes()"></ion-input>
          <ion-select label="Bodega de destino" labelPlacement="stacked" fill="outline" interface="popover"
                      [value]="bodega()" (ionChange)="bodega.set($any($event).detail.value)">
            @for (b of bodegas(); track b.bodega) {
              <ion-select-option [value]="b.bodega">{{ b.descr }}</ion-select-option>
            }
          </ion-select>
          <ion-button (click)="cargarHes()" [disabled]="buscando()">Buscar HES</ion-button>
        </div>

        @if (buscando()) { <ion-skeleton-text [animated]="true" style="width: 100%; height: 200px;"></ion-skeleton-text> }

        @if (hes(); as h) {
          <h3>HES {{ h.numdoc }} · centro de costo {{ h.ccosto }}</h3>
          @if (h.yaCargada) {
            <div class="sa-notice sa-notice--warn">Esta HES ya fue cargada a bodega (marca MF).</div>
          }
          <div class="sa-table-wrap">
            <table class="sa-table">
              <thead><tr>
                <th>Descripción de la línea</th><th class="code">Código resuelto</th>
                <th class="num">Cantidad</th><th>Unidad</th><th class="num">Precio</th>
              </tr></thead>
              <tbody>
                @for (l of h.lineas; track l.id) {
                  <tr>
                    <td>{{ l.nombre }}</td>
                    <td class="code" [class.sinCodigo]="!l.cod_material">
                      {{ l.cod_material ?? 'sin patrón /MC_' }}
                    </td>
                    <td class="num">{{ l.cantidad }}</td>
                    <td>{{ l.unidad }}</td>
                    <td class="num">{{ moneda(l.precio_uni) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (faltantes() > 0) {
            <div class="sa-notice sa-notice--crit">
              {{ faltantes() }} línea(s) sin el patrón <code>/MC_</code>. La carga se rechaza
              completa hasta que se corrija la descripción en la HES.
            </div>
          }

          <p class="nota">
            Al cargar: se suma el stock en la bodega elegida, se escribe un movimiento
            por línea, la tarifa del maestro queda con el precio de esta HES, y la HES
            se marca como <code>MF</code>. Desde ahí ya no se puede eliminar desde compras.
          </p>

          <div class="acciones">
            <ion-button (click)="cargar()"
                        [disabled]="trabajando() || h.yaCargada || faltantes() > 0 || !bodega()">
              Cargar a bodega
            </ion-button>
          </div>
        }
      </div>
    </ion-content>
  `,
})
export class RecepcionPage {
  private readonly http = inject(HttpClient);

  readonly bodegas = signal<Bodega[]>([]);
  readonly hes = signal<Hes | null>(null);
  readonly bodega = signal(0);
  readonly buscando = signal(false);
  readonly trabajando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');

  numdoc: number | null = null;

  moneda = (n: unknown) => n == null ? '' : '$' + Math.round(Number(n)).toLocaleString('es-CL');
  faltantes = () => (this.hes()?.lineas ?? []).filter((l) => !l.cod_material).length;

  constructor() { void this.cargarBodegas(); }

  private async cargarBodegas(): Promise<void> {
    try {
      const bs = await firstValueFrom(this.http.get<Bodega[]>(`${API}/bodega/bodegas`));
      this.bodegas.set(bs);
      if (bs.length) this.bodega.set(bs[0].bodega);
    } catch { this.bodegas.set([]); }
  }

  async cargarHes(): Promise<void> {
    if (!this.numdoc) { this.error.set('Indica el número de HES'); return; }
    this.buscando.set(true);
    this.error.set(''); this.mensaje.set(''); this.hes.set(null);
    try {
      this.hes.set(
        await firstValueFrom(this.http.get<Hes>(`${API}/bodega/hes/${this.numdoc}`)),
      );
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se encontró la HES');
    } finally {
      this.buscando.set(false);
    }
  }

  async cargar(): Promise<void> {
    const h = this.hes();
    if (!h) return;
    this.trabajando.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(this.http.post<{ mensaje: string; numdoc: number }>(
        `${API}/bodega/cargar-hes`, { numdoc: h.numdoc, bodega: this.bodega() },
      ));
      this.mensaje.set(`${r.mensaje}, guía ${r.numdoc}`);
      await this.cargarHes();
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo cargar');
    } finally {
      this.trabajando.set(false);
    }
  }
}