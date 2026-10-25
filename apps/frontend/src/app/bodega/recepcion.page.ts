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
  IonSelect, IonSelectOption, IonSkeletonText,
} from '@ionic/angular/standalone';

import { API } from '../core/auth.service';
import type { Bodega } from './stock.page';
import { PageHeaderComponent } from '../shared/page-header.component';
import { SaPageHead } from '../shared/sa-page-head.component';
import { SaIcon } from '../shared/sa-icon.component';
import { SaRegistroTabs } from '../shared/sa-registro-tabs.component';
import { SaTableWrap } from '../shared/sa-table-wrap.component';

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
    IonSelect, IonSelectOption, IonSkeletonText, IonButton, IonInput, SaPageHead, SaIcon, SaRegistroTabs, SaTableWrap,
  ],
  styles: [`
    .hes { display: grid; gap: var(--sa-space-4); }
    .sa-panel { padding: var(--sa-space-4); }
    h2 { margin: 0 0 var(--sa-space-3); font-size: var(--sa-text-title); font-weight: 600; color: var(--sa-ink); }
    .fila { display: flex; gap: var(--sa-space-3); flex-wrap: wrap; align-items: flex-end; }
    .fila > * { flex: 1; min-width: min(100%, 200px); }
    .fila > ion-button { flex: none; min-width: 0; min-height: 44px; margin: 0; }
    .cabecera { display: flex; align-items: center; justify-content: space-between; gap: var(--sa-space-3);
                flex-wrap: wrap; margin-bottom: var(--sa-space-3); }
    .cabecera h2 { margin: 0; }
    .cabecera p { margin: 0; color: var(--sa-ink-soft); font-size: var(--sa-text-body); }
    .sinCodigo { color: var(--sa-crit-fg); font-weight: 600; }
    .nota { font-size: var(--sa-text-dense); color: var(--sa-ink-soft); margin: var(--sa-space-3) 0 0; line-height: 1.5; max-width: 70ch; }
    .cargar { display: grid; gap: var(--sa-space-2); margin-top: var(--sa-space-4); }
    .cargar p { margin: 0; color: var(--sa-ink-soft); font-size: var(--sa-text-dense); }
    .cargar ion-button { margin: 0; min-height: 48px; }
    @media (min-width: 768px) { .cargar { justify-items: end; } .cargar ion-button { min-width: 18rem; } }
    .sin-hes { margin: 0; color: var(--sa-ink-soft); font-size: var(--sa-text-body); }
  `],
  template: `
    <app-page-header title="Registrar movimiento"></app-page-header>

    <ion-content>
      <div class="cuerpo page-content">
        <sa-page-head title="Registrar movimiento" area="bodega" icon="move"
                      subtitle="Elige qué pasa, agrega lo que se mueve y emite la guía." />
        <sa-registro-tabs actual="ING_MATERIAL" />
        @if (error()) { <div class="sa-notice sa-notice--crit" role="alert">{{ error() }}</div> }
        @if (mensaje()) { <div class="sa-notice sa-notice--ok" role="status">{{ mensaje() }}</div> }

        <div class="hes">
          <section class="sa-panel" aria-labelledby="hes-buscar">
            <h2 id="hes-buscar">Buscar la HES</h2>
            <div class="fila">
              <ion-input label="Número de HES" labelPlacement="stacked" fill="outline" type="number"
                         inputmode="numeric" [(ngModel)]="numdoc" (keyup.enter)="cargarHes()"></ion-input>
              <ion-select label="Bodega de destino" labelPlacement="stacked" fill="outline" interface="popover"
                          [value]="bodega()" (ionChange)="bodega.set($any($event).detail.value)">
                @for (b of bodegas(); track b.bodega) {
                  <ion-select-option [value]="b.bodega">{{ b.descr }}</ion-select-option>
                }
              </ion-select>
              <ion-button fill="outline" color="bodega" (click)="cargarHes()" [disabled]="buscando()">
                <sa-icon slot="start" name="search" />
                Buscar HES
              </ion-button>
            </div>
          </section>

          @if (buscando()) {
            <section class="sa-panel" aria-busy="true">
              <ion-skeleton-text [animated]="true" style="width: 100%; height: 200px;"></ion-skeleton-text>
            </section>
          } @else if (hes(); as h) {
            <section class="sa-panel" aria-labelledby="hes-lineas">
              <div class="cabecera">
                <h2 id="hes-lineas">HES <span class="code">{{ h.numdoc }}</span></h2>
                <p>Centro de costo <span class="code">{{ h.ccosto }}</span> · {{ h.lineas.length }} línea(s)</p>
              </div>
              @if (h.yaCargada) {
                <div class="sa-notice sa-notice--warn">Esta HES ya fue cargada a bodega (marca MF).</div>
              }
              <sa-table-wrap label="Líneas de la HES">
                <table class="sa-table">
                  <thead><tr>
                    <th>Descripción de la línea</th><th class="code">Código resuelto</th>
                    <th class="num">Cantidad</th><th>Unidad</th><th class="num">Precio</th>
                  </tr></thead>
                  <tbody>
                    @for (l of h.lineas; track l.id) {
                      <tr>
                        <th scope="row">{{ l.nombre }}</th>
                        <td class="code" data-label="Código resuelto" [class.sinCodigo]="!l.cod_material">
                          {{ l.cod_material ?? 'sin patrón /MC_' }}
                        </td>
                        <td class="num" data-label="Cantidad">{{ l.cantidad }}</td>
                        <td data-label="Unidad">{{ l.unidad }}</td>
                        <td class="num" data-label="Precio">{{ moneda(l.precio_uni) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </sa-table-wrap>

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

              <div class="cargar">
                @if (motivoCarga(h); as m) { <p id="cargar-motivo">{{ m }}</p> }
                <ion-button expand="block" color="bodega" (click)="cargar()"
                            [attr.aria-describedby]="motivoCarga(h) ? 'cargar-motivo' : null"
                            [disabled]="trabajando() || h.yaCargada || faltantes() > 0 || !bodega()">
                  {{ trabajando() ? 'Cargando...' : 'Cargar a bodega · ' + h.lineas.length + ' línea(s)' }}
                </ion-button>
              </div>
            </section>
          } @else {
            <section class="sa-panel">
              <p class="sin-hes">Escribe el número de una HES aprobada y elige la bodega de destino para ver sus líneas antes de cargarlas.</p>
            </section>
          }
        </div>
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
  /** Por que no se puede cargar todavia; vacio cuando esta lista. */
  motivoCarga = (h: Hes): string => {
    if (h.yaCargada) return 'Esta HES ya está en bodega.';
    if (this.faltantes() > 0) return 'Corrige las líneas sin código antes de cargar.';
    if (!this.bodega()) return 'Elige la bodega de destino para poder cargar.';
    return '';
  };

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