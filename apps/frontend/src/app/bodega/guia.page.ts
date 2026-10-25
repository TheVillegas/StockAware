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
 *
 * Layout "carro": a la izquierda el catalogo de la bodega (el endpoint de
 * items lista sin texto de busqueda, asi que se ve de entrada), a la derecha
 * la guia que se arma, con el destino, las lineas y el boton de emitir.
 */
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import {
  IonButton, IonContent, IonInput, IonSelect, IonSelectOption, IonSkeletonText,
} from '@ionic/angular/standalone';

import { API } from '../core/auth.service';
import type { Bodega } from './stock.page';
import { PageHeaderComponent } from '../shared/page-header.component';
import { SaPageHead } from '../shared/sa-page-head.component';
import { SaIcon } from '../shared/sa-icon.component';
import { SaRegistroTabs } from '../shared/sa-registro-tabs.component';

interface Item { codigo: string; nombre: string; unidad: string; tarifa: number; stock: number; }
interface Linea {
  id_vhe: string; nombre: string; cantidad: number; unidad: string; tarifa: number;
  /** Tope de unidades: el stock disponible cuando sale material; null si no aplica. */
  max: number | null;
}

const MODOS: Record<string, { tipoMov: 'IN' | 'OUT' | 'MATERIAL'; titulo: string; guia: string }> = {
  EMITE_GR:    { tipoMov: 'OUT',      titulo: 'Salida de bodega',     guia: 'Guía de salida' },
  RECIBE_GR:   { tipoMov: 'IN',       titulo: 'Ingreso manual',       guia: 'Guía de ingreso' },
  ENTREGA_MAT: { tipoMov: 'MATERIAL', titulo: 'Entrega de fungibles', guia: 'Entrega de fungibles' },
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

@Component({
  selector: 'app-guia',
  imports: [
    FormsModule, PageHeaderComponent, IonContent, IonSelect, IonSelectOption, IonButton,
    IonInput, IonSkeletonText, SaPageHead, SaIcon, SaRegistroTabs,
  ],
  styles: [`
    .registro { container-type: inline-size; }
    .carro { display: grid; gap: var(--sa-space-4); grid-template-columns: minmax(0, 1fr); align-items: start; }
    @container (min-width: 760px) {
      .carro { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); }
    }
    .sa-panel { overflow: hidden; }
    h2 { margin: 0; font-size: var(--sa-text-title); font-weight: 600; color: var(--sa-ink); }
    .cab { display: grid; gap: var(--sa-space-3); padding: var(--sa-space-4); }
    .campos { display: grid; gap: var(--sa-space-3); grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); }
    .lista { max-height: 30rem; overflow-y: auto; }
    .item {
      display: flex; align-items: center; gap: var(--sa-space-3);
      padding: var(--sa-space-3) var(--sa-space-4);
      border-top: var(--sa-border) solid var(--sa-line);
    }
    .item-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; line-height: 1.35; }
    .item-txt .code { font-size: var(--sa-text-meta); color: var(--sa-ink-soft); }
    .item-stock { flex: none; color: var(--sa-ink-soft); font-size: var(--sa-text-dense); white-space: nowrap; }
    .item-stock--cero { color: var(--sa-crit-fg); }
    .item ion-button { flex: none; min-height: 44px; margin: 0; }
    .vacio-lista { margin: 0; padding: var(--sa-space-5) var(--sa-space-4); border-top: var(--sa-border) solid var(--sa-line);
                   color: var(--sa-ink-soft); font-size: var(--sa-text-body); }
    .cargando { padding: var(--sa-space-3) var(--sa-space-4); border-top: var(--sa-border) solid var(--sa-line); }

    .guia { display: flex; flex-direction: column; }
    .guia .cab p { margin: 0; color: var(--sa-ink-soft); font-size: var(--sa-text-body); }
    .lineas { border-top: var(--sa-border) solid var(--sa-line); }
    .linea {
      display: flex; align-items: center; gap: var(--sa-space-2); flex-wrap: wrap;
      padding: var(--sa-space-3) var(--sa-space-4);
      border-bottom: var(--sa-border) solid var(--sa-line);
    }
    .linea-txt { flex: 1 1 12rem; min-width: 0; line-height: 1.35; }
    .linea-txt small { display: block; color: var(--sa-ink-soft); font-size: var(--sa-text-meta); }
    .stepper { display: flex; align-items: center; gap: var(--sa-space-1); }
    .stepper ion-input { width: 4.5rem; --padding-start: var(--sa-space-2); --padding-end: var(--sa-space-2); text-align: center; }
    .step, .quitar {
      display: inline-flex; align-items: center; justify-content: center;
      width: 44px; height: 44px; flex: none;
      border: var(--sa-border) solid var(--sa-border-input); border-radius: var(--sa-radius);
      background: var(--sa-surface); color: var(--sa-ink); cursor: pointer;
    }
    .step:hover:not(:disabled) { border-color: var(--sa-area-bodega); color: var(--sa-area-bodega); }
    .step:disabled { color: var(--sa-border-input); cursor: default; }
    .quitar { border-color: transparent; color: var(--sa-ink-soft); }
    .quitar:hover { color: var(--sa-crit-fg); background: var(--sa-crit-bg); }
    .step:focus-visible, .quitar:focus-visible { outline: 2px solid var(--sa-area-bodega); outline-offset: var(--sa-focus-offset); }
    .vacio-guia { margin: 0; padding: var(--sa-space-5) var(--sa-space-4); color: var(--sa-ink-soft);
                  font-size: var(--sa-text-body); text-align: center; }
    .emitir { display: grid; gap: var(--sa-space-2); padding: var(--sa-space-4); }
    .emitir ion-button { margin: 0; min-height: 48px; }
    .emitir p { margin: 0; color: var(--sa-ink-soft); font-size: var(--sa-text-dense); }
    .emitir .vaciar { justify-self: center; }
  `],
  template: `
    <app-page-header title="Registrar movimiento"></app-page-header>

    <ion-content>
      <div class="cuerpo page-content registro">
        <sa-page-head title="Registrar movimiento" area="bodega" icon="move"
                      subtitle="Elige qué pasa, agrega lo que se mueve y emite la guía." />
        <sa-registro-tabs [actual]="codigo()" />
        @if (error()) { <div class="sa-notice sa-notice--crit" role="alert">{{ error() }}</div> }
        @if (mensaje()) { <div class="sa-notice sa-notice--ok" role="status">{{ mensaje() }}</div> }

        <div class="carro">
          <section class="sa-panel" aria-labelledby="catalogo-titulo">
            <div class="cab">
              <h2 id="catalogo-titulo">Catálogo de la bodega</h2>
              <div class="campos">
                <ion-select [label]="modo().tipoMov === 'IN' ? 'Bodega de ingreso' : 'Bodega de origen'"
                            labelPlacement="stacked" fill="outline" interface="popover"
                            [value]="bodega()" (ionChange)="cambiarBodega($any($event).detail.value)">
                  @for (b of bodegas(); track b.bodega) {
                    <ion-select-option [value]="b.bodega">{{ b.descr }}</ion-select-option>
                  }
                </ion-select>
                @if (!esMaterial()) {
                  <ion-select label="Tipo de ítem" labelPlacement="stacked" fill="outline" interface="popover"
                              [value]="tipoVhe()" (ionChange)="cambiarTipo($any($event).detail.value)">
                    @for (t of tipos(); track t) { <ion-select-option [value]="t">{{ t }}</ion-select-option> }
                  </ion-select>
                }
              </div>
              <ion-input label="Buscar en el catálogo" labelPlacement="stacked" fill="outline" type="search"
                         placeholder="Busca por código o nombre" [debounce]="350" [clearInput]="true"
                         [value]="buscar()" (ionInput)="buscar.set($any($event).detail.value ?? '')"></ion-input>
            </div>

            <div class="lista" aria-live="polite" [attr.aria-busy]="buscandoItems()">
              @if (buscandoItems() && !sugerencias().length) {
                <div class="cargando"><ion-skeleton-text [animated]="true" style="height: 120px;"></ion-skeleton-text></div>
              }
              @for (s of sugerencias(); track s.codigo) {
                <div class="item">
                  <span class="item-txt"><span class="code">{{ s.codigo }}</span><span>{{ s.nombre }}</span></span>
                  @if (esMaterial()) { <span class="item-stock" [class.item-stock--cero]="sinStock(s)"><span class="num">{{ s.stock }}</span> {{ s.unidad }}</span> }
                  @else if (conStock()) { <span class="item-stock" [class.item-stock--cero]="sinStock(s)"><span class="num">{{ s.stock }}</span> {{ s.unidad }}</span> }
                  <ion-button fill="outline" color="bodega" [disabled]="enGuia(s) || sinStock(s)"
                              [attr.aria-label]="(enGuia(s) ? 'Ya está en la guía: ' : 'Agregar a la guía: ') + s.nombre"
                              (click)="agregar(s)">
                    @if (enGuia(s)) { En la guía } @else if (sinStock(s)) { Sin stock } @else { Agregar }
                  </ion-button>
                </div>
              } @empty {
                @if (!buscandoItems()) {
                  <p class="vacio-lista">
                    @if (!bodega()) { Elige una bodega para ver su catálogo. }
                    @else if (buscar().trim()) { No hay ítems que coincidan con "{{ buscar().trim() }}". Prueba con otro código o nombre. }
                    @else { No hay ítems para mostrar en esta bodega. }
                  </p>
                }
              }
            </div>
          </section>

          <section class="sa-panel guia" aria-labelledby="guia-titulo">
            <div class="cab">
              <h2 id="guia-titulo">{{ modo().guia }}</h2>
              @if (nombreBodega()) {
                <p>{{ modo().tipoMov === 'IN' ? 'Hacia' : 'Desde' }} {{ nombreBodega() }}</p>
              }
              <div class="campos">
                @if (esMaterial()) {
                  <ion-select label="Destino" labelPlacement="stacked" fill="outline" interface="popover"
                              [value]="tipoCambio()" (ionChange)="tipoCambio.set($any($event).detail.value)">
                    <ion-select-option value="Persona">Persona</ion-select-option>
                    <ion-select-option value="Bodega">Otra bodega</ion-select-option>
                  </ion-select>
                  @if (tipoCambio() === 'Bodega') {
                    <ion-select label="Bodega destino" labelPlacement="stacked" fill="outline" interface="popover"
                                [value]="bodegaDestino()"
                                (ionChange)="bodegaDestino.set($any($event).detail.value)">
                      @for (b of bodegas(); track b.bodega) {
                        <ion-select-option [value]="b.bodega">{{ b.descr }}</ion-select-option>
                      }
                    </ion-select>
                  } @else {
                    <ion-input label="Responsable (id)" labelPlacement="stacked" fill="outline" type="number"
                               [(ngModel)]="responsable"></ion-input>
                  }
                }
                <ion-input label="Centro de costo" labelPlacement="stacked" fill="outline"
                           [(ngModel)]="ccosto"></ion-input>
                <ion-input label="Centro de costo AP" labelPlacement="stacked" fill="outline"
                           [(ngModel)]="ccostoAp"></ion-input>
              </div>
            </div>

            <div class="lineas">
              @for (l of lineas(); track l.id_vhe) {
                <div class="linea">
                  <span class="linea-txt">
                    <span class="code">{{ l.id_vhe }}</span> {{ l.nombre }}
                    @if (l.max !== null) { <small>Disponible: <span class="num">{{ l.max }}</span> {{ l.unidad }}</small> }
                    @else { <small>{{ l.unidad }}</small> }
                  </span>
                  <span class="stepper">
                    <button type="button" class="step" [disabled]="l.cantidad <= 1"
                            [attr.aria-label]="'Quitar una unidad de ' + l.id_vhe" (click)="fijar(l, l.cantidad - 1)">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
                    </button>
                    <ion-input type="number" inputmode="numeric" fill="outline" [min]="1" [max]="l.max ?? undefined"
                               [attr.aria-label]="'Cantidad de ' + l.id_vhe" [value]="l.cantidad"
                               (ionChange)="fijar(l, $any($event).detail.value)"></ion-input>
                    <button type="button" class="step" [disabled]="l.max !== null && l.cantidad >= l.max"
                            [attr.aria-label]="'Sumar una unidad de ' + l.id_vhe" (click)="fijar(l, l.cantidad + 1)">
                      <sa-icon name="plus" [stroke]="2" />
                    </button>
                  </span>
                  <button type="button" class="quitar" [attr.aria-label]="'Quitar ' + l.id_vhe + ' de la guía'"
                          (click)="quitar(l)">
                    <sa-icon name="x" />
                  </button>
                </div>
              } @empty {
                <p class="vacio-guia">Agrega ítems desde el catálogo.</p>
              }
            </div>

            <div class="emitir">
              @if (motivo()) { <p id="emitir-motivo">{{ motivo() }}</p> }
              <ion-button expand="block" color="bodega" (click)="emitir()"
                          [disabled]="trabajando() || !!motivo()"
                          [attr.aria-describedby]="motivo() ? 'emitir-motivo' : null">
                {{ trabajando() ? 'Emitiendo...' : etiquetaEmitir() }}
              </ion-button>
              @if (lineas().length) {
                <ion-button class="vaciar" fill="clear" color="medium" (click)="lineas.set([])">Vaciar la guía</ion-button>
              }
            </div>
          </section>
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
  readonly buscandoItems = signal(false);
  readonly trabajando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');

  ccosto = '';
  ccostoAp = '';
  responsable: number | null = null;

  /** Tipo de item que se mueve: en fungibles siempre material. */
  readonly tipoItem = computed(() => (this.esMaterial() ? 'Material' : this.tipoVhe()));
  /** Solo el material tiene stock por bodega; equipos y vehiculos no. */
  readonly conStock = computed(() => this.tipoItem() === 'Material');
  /** Las salidas de material no pueden superar el stock disponible. */
  readonly topaStock = computed(() => this.conStock() && this.modo().tipoMov !== 'IN');

  readonly nombreBodega = computed(
    () => this.bodegas().find((b) => b.bodega === this.bodega())?.descr ?? '',
  );
  readonly unidades = computed(() => this.lineas().reduce((s, l) => s + (Number(l.cantidad) || 0), 0));
  readonly etiquetaEmitir = computed(() => {
    const n = this.lineas().length;
    const base = `Emitir ${this.modo().guia.toLowerCase()}`;
    return n ? `${base} · ${plural(n, 'ítem', 'ítems')}, ${plural(this.unidades(), 'unidad', 'unidades')}` : base;
  });
  /** Por que no se puede emitir todavia; vacio cuando la guia esta lista. */
  readonly motivo = computed(() => {
    if (!this.bodega()) return 'Elige la bodega para poder emitir.';
    if (!this.lineas().length) return 'Agrega al menos un ítem desde el catálogo para poder emitir.';
    if (this.lineas().some((l) => !(Number(l.cantidad) > 0))) return 'Cada ítem necesita una cantidad de al menos 1.';
    if (this.esMaterial() && this.tipoCambio() === 'Bodega' && !this.bodegaDestino()) {
      return 'Elige la bodega destino para poder emitir.';
    }
    return '';
  });

  private consulta = 0;

  constructor() {
    void this.cargarApoyo();
    effect(() => {
      const q = this.buscar().trim(); const b = this.bodega(); const tipo = this.tipoItem();
      if (!b) { this.sugerencias.set([]); return; }
      void this.buscarItems(tipo, q, b);
    });
    // Otro tipo de movimiento arma otra guia: no se arrastran lineas de un modo a otro.
    effect(() => { this.codigo(); untracked(() => this.lineas.set([])); });
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
    const id = ++this.consulta;
    this.buscandoItems.set(true);
    try {
      const p = new URLSearchParams({ tipo_vhe: tipo, q });
      if (bodega) p.set('bodega', String(bodega));
      const items = await firstValueFrom(this.http.get<Item[]>(`${API}/bodega/items?${p}`));
      if (id === this.consulta) this.sugerencias.set(items);
    } catch {
      if (id === this.consulta) this.sugerencias.set([]);
    } finally {
      if (id === this.consulta) this.buscandoItems.set(false);
    }
  }

  /** El stock y el tipo son de la bodega elegida: una guia armada con otros no sirve. */
  cambiarBodega(b: number): void {
    if (b === this.bodega()) return;
    this.bodega.set(b);
    this.lineas.set([]);
  }

  cambiarTipo(t: string): void {
    if (t === this.tipoVhe()) return;
    this.tipoVhe.set(t);
    this.lineas.set([]);
  }

  enGuia(s: Item): boolean {
    return this.lineas().some((l) => l.id_vhe === s.codigo);
  }

  sinStock(s: Item): boolean {
    return this.topaStock() && !(Number(s.stock) > 0);
  }

  agregar(s: Item): void {
    if (this.enGuia(s) || this.sinStock(s)) return;
    this.lineas.set([...this.lineas(), {
      id_vhe: s.codigo, nombre: s.nombre, cantidad: 1,
      unidad: s.unidad ?? 'UNI', tarifa: Number(s.tarifa ?? 0),
      max: this.topaStock() ? Number(s.stock) : null,
    }]);
  }

  /** Fija la cantidad de una linea, entre 1 y el stock disponible si lo hay. */
  fijar(l: Linea, valor: unknown): void {
    let n = Math.floor(Number(valor));
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (l.max !== null) n = Math.min(n, l.max);
    this.lineas.set(this.lineas().map((x) => (x.id_vhe === l.id_vhe ? { ...x, cantidad: n } : x)));
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
        tipo_vhe: this.tipoItem(),
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
      // El stock cambio: refresca el catalogo con las cantidades nuevas.
      void this.buscarItems(this.tipoItem(), this.buscar().trim(), this.bodega());
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo emitir la guía');
    } finally {
      this.trabajando.set(false);
    }
  }
}
