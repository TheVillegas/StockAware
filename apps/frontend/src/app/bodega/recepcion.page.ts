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
  IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonMenuButton,
  IonNote, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';

import { API } from '../core/auth.service';
import type { Bodega } from './stock.page';

interface LineaHes {
  id: number; nombre: string; descripcion: string; cantidad: number;
  unidad: string; precio_uni: number; total: number;
  ccosto: string; ccosto_ap: string; cod_material: string | null;
}
interface Hes { numdoc: number; ccosto: string; yaCargada: boolean; lineas: LineaHes[]; }

@Component({
  selector: 'app-recepcion',
  imports: [
    FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent,
    IonSelect, IonSelectOption, IonSpinner, IonButton, IonItem, IonInput, IonNote,
  ],
  styles: [`
    .cuerpo { padding: 12px 14px 40px; max-width: 900px; }
    h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em;
         color: var(--ion-color-medium); margin: 22px 0 6px; }
    .fila { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
    .fila > * { flex: 1; min-width: 200px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 6px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
         color: var(--ion-color-medium); padding: 7px 9px;
         border-bottom: 1px solid var(--ion-color-light-shade); }
    td { padding: 6px 9px; border-bottom: 1px solid var(--ion-color-light); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .desplaza { overflow-x: auto; }
    .sinCodigo { color: var(--ion-color-danger); font-weight: 600; }
    .acciones { display: flex; gap: 10px; margin-top: 20px; }
    .aviso { color: var(--ion-color-danger); font-size: 13px; margin: 10px 0; }
    .ok { color: var(--ion-color-success); font-size: 13px; margin: 10px 0; }
    .nota { font-size: 12px; color: var(--ion-color-medium); margin-top: 10px; line-height: 1.5; }
  `],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
      <ion-title>Recibe material fungible</ion-title>
    </ion-toolbar></ion-header>

    <ion-content>
      <div class="cuerpo">
        @if (error()) { <div class="aviso">{{ error() }}</div> }
        @if (mensaje()) { <div class="ok">{{ mensaje() }}</div> }

        <div class="fila">
          <ion-item>
            <ion-input label="Número de HES" labelPlacement="stacked" type="number"
                       [(ngModel)]="numdoc" (keyup.enter)="cargarHes()"></ion-input>
          </ion-item>
          <ion-select label="Bodega de destino" labelPlacement="stacked" interface="popover"
                      [value]="bodega()" (ionChange)="bodega.set($any($event).detail.value)">
            @for (b of bodegas(); track b.bodega) {
              <ion-select-option [value]="b.bodega">{{ b.descr }}</ion-select-option>
            }
          </ion-select>
          <ion-button (click)="cargarHes()" [disabled]="buscando()">Buscar HES</ion-button>
        </div>

        @if (buscando()) { <ion-spinner></ion-spinner> }

        @if (hes(); as h) {
          <h3>HES {{ h.numdoc }} · centro de costo {{ h.ccosto }}</h3>
          @if (h.yaCargada) {
            <div class="aviso">Esta HES ya fue cargada a bodega (marca MF).</div>
          }
          <div class="desplaza">
            <table>
              <thead><tr>
                <th>Descripción de la línea</th><th>Código resuelto</th>
                <th class="num">Cantidad</th><th>Unidad</th><th class="num">Precio</th>
              </tr></thead>
              <tbody>
                @for (l of h.lineas; track l.id) {
                  <tr>
                    <td>{{ l.nombre }}</td>
                    <td [class.sinCodigo]="!l.cod_material">
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
            <div class="aviso">
              {{ faltantes() }} línea(s) sin el patrón <code>/MC_</code>. La carga se rechaza
              completa hasta que se corrija la descripción en la HES.
            </div>
          }

          <p class="nota">
            Al cargar: se suma el stock en la bodega elegida, se escribe un movimiento
            por línea, la tarifa del maestro queda con el precio de esta HES, y la HES
            se marca como <code>MF</code> — desde ahí ya no se puede eliminar desde compras.
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
    if (!this.numdoc) { this.error.set('Indicá el número de HES'); return; }
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
      this.mensaje.set(`${r.mensaje} — guía ${r.numdoc}`);
      await this.cargarHes();
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo cargar');
    } finally {
      this.trabajando.set(false);
    }
  }
}
