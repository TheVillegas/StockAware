/**
 * Guia de recepcion: UNA pantalla con tres modos, igual que
 * Emite_Documento_GR($tipoMov) del ERP.
 *
 *   EMITE_GR    -> OUT       sale de bodega (equipos, vehiculos, herramientas)
 *   RECIBE_GR   -> IN        entra a bodega
 *   ENTREGA_MAT -> MATERIAL  material fungible, y ahi recien aparece el
 *                            selector Bodega / Persona
 *
 * El modo sale del codigo de la ruta, no de un boton: son tres entradas de
 * menu distintas apuntando al mismo formulario, como en el original.
 */
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import {
  IonButton, IonContent, IonInput,
  IonSearchbar, IonSelect, IonSelectOption,
} from '@ionic/angular/standalone';

import { API } from '../core/auth.service';
import type { Bodega } from './stock.page';
import { PageHeaderComponent } from '../shared/page-header.component';

interface Item { codigo: string; nombre: string; unidad: string; tarifa: number; stock: number; }
interface Linea { id_vhe: string; nombre: string; cantidad: number; unidad: string; tarifa: number; }

const MODOS: Record<string, { tipoMov: 'IN' | 'OUT' | 'MATERIAL'; titulo: string }> = {
  EMITE_GR:    { tipoMov: 'OUT',      titulo: 'Emite guía de recepción (salida)' },
  RECIBE_GR:   { tipoMov: 'IN',       titulo: 'Recibe material (entrada)' },
  ENTREGA_MAT: { tipoMov: 'MATERIAL', titulo: 'Entrega material fungible' },
};

@Component({
  selector: 'app-guia',
  imports: [
    FormsModule, PageHeaderComponent, IonContent,
    IonSearchbar, IonSelect, IonSelectOption, IonButton, IonInput,
  ],
  styles: [`
    h3 { font-size: var(--sa-text-label); text-transform: uppercase; letter-spacing: .06em;
         color: var(--sa-ink-soft); margin: var(--sa-space-5) 0 var(--sa-space-1); font-weight: 600; }
    .fila { display: flex; gap: var(--sa-space-3); flex-wrap: wrap; align-items: flex-end; }
    .fila > * { flex: 1; min-width: 200px; }
    .fila > ion-button { flex: none; min-width: 0; }
    .sug { border: var(--sa-border) solid var(--sa-line-strong); border-radius: var(--sa-radius);
           max-height: 220px; overflow-y: auto; margin-top: var(--sa-space-1); }
    .sug div { padding: 7px 10px; cursor: pointer; font-size: var(--sa-text-dense);
               border-bottom: var(--sa-border) solid var(--sa-line); }
    .sug div:hover { background: var(--sa-surface-2); }
    .sug-stock { color: var(--sa-ink-soft); }
    .acciones { display: flex; gap: var(--sa-space-2); margin-top: var(--sa-space-5); }
  `],
  template: `
    <app-page-header [title]="modo().titulo"></app-page-header>

    <ion-content>
      <div class="cuerpo page-content">
        @if (error()) { <div class="sa-notice sa-notice--crit">{{ error() }}</div> }
        @if (mensaje()) { <div class="sa-notice sa-notice--ok">{{ mensaje() }}</div> }

        <h3>Encabezado</h3>
        <div class="fila">
          <ion-select label="Bodega" labelPlacement="stacked" fill="outline" interface="popover"
                      [value]="bodega()" (ionChange)="bodega.set($any($event).detail.value)">
            @for (b of bodegas(); track b.bodega) {
              <ion-select-option [value]="b.bodega">{{ b.descr }}</ion-select-option>
            }
          </ion-select>

          @if (esMaterial()) {
            <ion-select label="Destino" labelPlacement="stacked" fill="outline" interface="popover"
                        [value]="tipoCambio()" (ionChange)="tipoCambio.set($any($event).detail.value)">
              <ion-select-option value="Persona">Persona</ion-select-option>
              <ion-select-option value="Bodega">Otra bodega</ion-select-option>
            </ion-select>
          } @else {
            <ion-select label="Tipo de ítem" labelPlacement="stacked" fill="outline" interface="popover"
                        [value]="tipoVhe()" (ionChange)="tipoVhe.set($any($event).detail.value)">
              @for (t of tipos(); track t) { <ion-select-option [value]="t">{{ t }}</ion-select-option> }
            </ion-select>
          }

          @if (esMaterial() && tipoCambio() === 'Bodega') {
            <ion-select label="Bodega destino" labelPlacement="stacked" fill="outline" interface="popover"
                        [value]="bodegaDestino()"
                        (ionChange)="bodegaDestino.set($any($event).detail.value)">
              @for (b of bodegas(); track b.bodega) {
                <ion-select-option [value]="b.bodega">{{ b.descr }}</ion-select-option>
              }
            </ion-select>
          }

          @if (esMaterial() && tipoCambio() === 'Persona') {
            <ion-input label="Responsable (id)" labelPlacement="stacked" fill="outline" type="number"
                         [(ngModel)]="responsable"></ion-input>
          }

          <ion-input label="Centro de costo" labelPlacement="stacked" fill="outline"
                       [(ngModel)]="ccosto"></ion-input>
          <ion-input label="Centro de costo AP" labelPlacement="stacked" fill="outline"
                       [(ngModel)]="ccostoAp"></ion-input>
        </div>

        <h3>Ítems</h3>
        <div class="fila">
          <div style="flex: 1; position: relative;">
            <ion-searchbar placeholder="Buscar material o equipo" [debounce]="350"
                           [value]="buscar()"
                           (ionInput)="buscar.set($any($event).detail.value ?? '')"></ion-searchbar>
            @if (sugerencias().length) {
              <div class="sug">
                @for (s of sugerencias(); track s.codigo) {
                  <div (click)="agregar(s)"><span class="code">{{ s.codigo }}</span> - {{ s.nombre }}@if (esMaterial()) { <span class="sug-stock"> · stock <span class="num">{{ s.stock }}</span></span> }</div>
                }
              </div>
            }
          </div>
        </div>

        @if (lineas().length) {
          <div class="sa-table-wrap">
            <table class="sa-table">
              <thead><tr>
                <th class="code">Código</th><th>Descripción</th><th class="num">Cantidad</th>
                <th>Unidad</th><th></th>
              </tr></thead>
              <tbody>
                @for (l of lineas(); track l.id_vhe) {
                  <tr>
                    <td class="code">{{ l.id_vhe }}</td>
                    <td>{{ l.nombre }}</td>
                    <td class="num"><ion-input type="number" [(ngModel)]="l.cantidad"></ion-input></td>
                    <td>{{ l.unidad }}</td>
                    <td>
                      <ion-button size="small" fill="outline" color="danger"
                                  (click)="quitar(l)">Quitar</ion-button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <div class="acciones">
          <ion-button (click)="emitir()" [disabled]="trabajando() || lineas().length === 0">
            Emitir guía
          </ion-button>
          @if (lineas().length) {
            <ion-button fill="outline" (click)="lineas.set([])">Vaciar</ion-button>
          }
        </div>
      </div>
    </ion-content>
  `,
})
export class GuiaPage {
  private readonly http = inject(HttpClient);

  readonly codigo = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('codigo') ?? 'ENTREGA_MAT')),
    { initialValue: 'ENTREGA_MAT' },
  );
  readonly modo = computed(() => MODOS[this.codigo()] ?? MODOS['ENTREGA_MAT']);
  readonly esMaterial = computed(() => this.modo().tipoMov === 'MATERIAL');

  readonly bodegas = signal<Bodega[]>([]);
  readonly tipos = signal<string[]>([]);
  readonly sugerencias = signal<Item[]>([]);
  readonly lineas = signal<Linea[]>([]);
  readonly bodega = signal(0);
  readonly bodegaDestino = signal(0);
  readonly tipoCambio = signal<'Bodega' | 'Persona'>('Persona');
  readonly tipoVhe = signal('Equipo');
  readonly buscar = signal('');
  readonly trabajando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');

  ccosto = '';
  ccostoAp = '';
  responsable: number | null = null;

  constructor() {
    void this.cargarApoyo();
    effect(() => {
      const q = this.buscar(); const b = this.bodega();
      const tipo = this.esMaterial() ? 'Material' : this.tipoVhe();
      if (q.trim().length < 2) { this.sugerencias.set([]); return; }
      void this.buscarItems(tipo, q.trim(), b);
    });
  }

  private async cargarApoyo(): Promise<void> {
    try {
      const bs = await firstValueFrom(this.http.get<Bodega[]>(`${API}/bodega/bodegas`));
      this.bodegas.set(bs);
      if (bs.length) this.bodega.set(bs[0].bodega);
      this.tipos.set(await firstValueFrom(this.http.get<string[]>(`${API}/bodega/tipos-vhe`)));
    } catch { /* accesorio */ }
  }

  private async buscarItems(tipo: string, q: string, bodega: number): Promise<void> {
    try {
      const p = new URLSearchParams({ tipo_vhe: tipo, q });
      if (bodega) p.set('bodega', String(bodega));
      this.sugerencias.set(
        await firstValueFrom(this.http.get<Item[]>(`${API}/bodega/items?${p}`)),
      );
    } catch { this.sugerencias.set([]); }
  }

  agregar(s: Item): void {
    if (this.lineas().some((l) => l.id_vhe === s.codigo)) return;
    this.lineas.set([...this.lineas(), {
      id_vhe: s.codigo, nombre: s.nombre, cantidad: 1,
      unidad: s.unidad ?? 'UNI', tarifa: Number(s.tarifa ?? 0),
    }]);
    this.sugerencias.set([]);
  }

  quitar(l: Linea): void {
    this.lineas.set(this.lineas().filter((x) => x.id_vhe !== l.id_vhe));
  }

  async emitir(): Promise<void> {
    this.error.set(''); this.mensaje.set('');
    const lineas = this.lineas().filter((l) => Number(l.cantidad) > 0);
    if (!lineas.length) { this.error.set('No hay líneas con cantidad'); return; }
    if (!this.bodega()) { this.error.set('Falta la bodega'); return; }

    this.trabajando.set(true);
    try {
      const r = await firstValueFrom(this.http.post<{ numdoc: number }>(`${API}/bodega/gr`, {
        tipoMov: this.modo().tipoMov,
        tipo_Cambio: this.esMaterial() ? this.tipoCambio() : undefined,
        tipo_vhe: this.esMaterial() ? 'Material' : this.tipoVhe(),
        bodega: this.bodega(),
        bodegaDestino: this.esMaterial() && this.tipoCambio() === 'Bodega'
          ? this.bodegaDestino() : undefined,
        id_responsable: this.responsable ?? undefined,
        ccosto: this.ccosto, ccosto_ap: this.ccostoAp,
        lineas: lineas.map((l) => ({
          id_vhe: l.id_vhe, cantidad: Number(l.cantidad), unidad: l.unidad, tarifa: l.tarifa,
        })),
      }));
      this.mensaje.set(`Guía ${r.numdoc} emitida`);
      this.lineas.set([]);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo emitir la guía');
    } finally {
      this.trabajando.set(false);
    }
  }
}