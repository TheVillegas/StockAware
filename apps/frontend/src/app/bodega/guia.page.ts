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
  IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonMenuButton,
  IonNote, IonSearchbar, IonSelect, IonSelectOption, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';

import { API } from '../core/auth.service';
import type { Bodega } from './stock.page';

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
    FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent,
    IonSearchbar, IonSelect, IonSelectOption, IonButton, IonItem, IonInput, IonNote,
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
    .sug { border: 1px solid var(--ion-color-light-shade); border-radius: 6px;
           max-height: 220px; overflow-y: auto; margin-top: 4px; }
    .sug div { padding: 7px 10px; cursor: pointer; font-size: 13px;
               border-bottom: 1px solid var(--ion-color-light); }
    .sug div:hover { background: var(--ion-color-light); }
    .acciones { display: flex; gap: 10px; margin-top: 20px; }
    .aviso { color: var(--ion-color-danger); font-size: 13px; margin: 10px 0; }
    .ok { color: var(--ion-color-success); font-size: 13px; margin: 10px 0; }
  `],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
      <ion-title>{{ modo().titulo }}</ion-title>
    </ion-toolbar></ion-header>

    <ion-content>
      <div class="cuerpo">
        @if (error()) { <div class="aviso">{{ error() }}</div> }
        @if (mensaje()) { <div class="ok">{{ mensaje() }}</div> }

        <h3>Encabezado</h3>
        <div class="fila">
          <ion-select label="Bodega" labelPlacement="stacked" interface="popover"
                      [value]="bodega()" (ionChange)="bodega.set($any($event).detail.value)">
            @for (b of bodegas(); track b.bodega) {
              <ion-select-option [value]="b.bodega">{{ b.descr }}</ion-select-option>
            }
          </ion-select>

          @if (esMaterial()) {
            <ion-select label="Destino" labelPlacement="stacked" interface="popover"
                        [value]="tipoCambio()" (ionChange)="tipoCambio.set($any($event).detail.value)">
              <ion-select-option value="Persona">Persona</ion-select-option>
              <ion-select-option value="Bodega">Otra bodega</ion-select-option>
            </ion-select>
          } @else {
            <ion-select label="Tipo de ítem" labelPlacement="stacked" interface="popover"
                        [value]="tipoVhe()" (ionChange)="tipoVhe.set($any($event).detail.value)">
              @for (t of tipos(); track t) { <ion-select-option [value]="t">{{ t }}</ion-select-option> }
            </ion-select>
          }

          @if (esMaterial() && tipoCambio() === 'Bodega') {
            <ion-select label="Bodega destino" labelPlacement="stacked" interface="popover"
                        [value]="bodegaDestino()"
                        (ionChange)="bodegaDestino.set($any($event).detail.value)">
              @for (b of bodegas(); track b.bodega) {
                <ion-select-option [value]="b.bodega">{{ b.descr }}</ion-select-option>
              }
            </ion-select>
          }
        </div>

        <div class="fila">
          <ion-item><ion-input label="Centro de costo" labelPlacement="stacked"
                               [(ngModel)]="ccosto"></ion-input></ion-item>
          <ion-item><ion-input label="Cuenta contable (ccosto_ap)" labelPlacement="stacked"
                               [(ngModel)]="ccostoAp"></ion-input></ion-item>
          @if (esMaterial() && tipoCambio() === 'Persona') {
            <ion-item><ion-input label="Id de quien recibe" labelPlacement="stacked"
                                 type="number" [(ngModel)]="responsable"></ion-input></ion-item>
          }
        </div>

        <h3>Agregar ítems</h3>
        <ion-searchbar placeholder="Buscar por código o nombre" [debounce]="350"
                       (ionInput)="buscar.set($any($event).detail.value ?? '')"></ion-searchbar>
        @if (sugerencias().length) {
          <div class="sug">
            @for (s of sugerencias(); track s.codigo) {
              <div (click)="agregar(s)">
                <strong>{{ s.codigo }}</strong> — {{ s.nombre }}
                @if (esMaterial()) { <ion-note> · stock {{ s.stock }}</ion-note> }
              </div>
            }
          </div>
        }

        @if (lineas().length) {
          <h3>Líneas de la guía</h3>
          <div class="desplaza">
            <table>
              <thead><tr>
                <th>Código</th><th>Descripción</th><th class="num">Cantidad</th>
                <th>Unidad</th><th></th>
              </tr></thead>
              <tbody>
                @for (l of lineas(); track l.id_vhe) {
                  <tr>
                    <td>{{ l.id_vhe }}</td>
                    <td>{{ l.nombre }}</td>
                    <td class="num"><ion-input type="number" [(ngModel)]="l.cantidad"></ion-input></td>
                    <td>{{ l.unidad }}</td>
                    <td>
                      <ion-button size="small" fill="clear" color="danger"
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
            <ion-button fill="clear" (click)="lineas.set([])">Vaciar</ion-button>
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
