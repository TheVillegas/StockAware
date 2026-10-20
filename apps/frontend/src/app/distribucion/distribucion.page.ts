/**
 * DOC_DISTRIBUIR: reparte una factura entre centros de costo.
 *
 * Vista dividida: a la izquierda la cola de facturas, a la derecha la elegida
 * con su reparto. La pantalla insiste en dos cosas del ERP: solo se distribuye
 * una factura ACEPTADA, y la distribucion es un acto unico — para cambiar el
 * reparto hay que deshacer el anterior. En el telefono los paneles se apilan:
 * primero la cola y, al elegir, la factura con un boton para volver.
 */
import { Component, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import {
  IonButton, IonContent, IonInput, IonSearchbar, IonSelect, IonSelectOption,
} from '@ionic/angular/standalone';

import { API } from '../core/auth.service';
import { clp, etiquetaEstado, fechaTabla, rangoLista, tonoEstado } from '../shared/format';
import { PageHeaderComponent } from '../shared/page-header.component';
import { daysSince } from '../shared/consulta';
import { allocation } from '../balance/balance-chart';
import { SaList } from '../shared/sa-list.component';
import { SaTableWrap } from '../shared/sa-table-wrap.component';
import { SaPageHead } from '../shared/sa-page-head.component';
import { SaIcon } from '../shared/sa-icon.component';

interface Factura {
  id: number; numdoc: number; tipo_doc: string; fecha: string; cliente: number;
  rut: string; estado: string; neto: number; iva: number; total: number;
  ccosto: string; proveedor: string; hijos: number;
}
interface LineaDet {
  id: number; nombre: string; descripcion: string; total: number;
  unidad: string; ccosto: string; ccosto_ap: string;
}
interface Hijo {
  id: number; numdoc: number; ccosto: string; neto: number;
  iva: number; total: number; estado: string; usuario: string;
}
interface Detalle extends Factura { detalle: LineaDet[]; }
interface CentroCosto { ccosto: string; proyecto: string; }

interface Reparto { id_detalle: number; ccosto: string; neto: number | null; exento: 'SI' | 'NO'; }

/** Shades of the Finanzas hue for the allocation segments, one per line. */
const TONOS = [
  'var(--sa-area-finanzas)',
  'color-mix(in srgb, var(--sa-area-finanzas) 70%, var(--sa-ink))',
  'color-mix(in srgb, var(--sa-area-finanzas) 55%, var(--sa-surface))',
  'color-mix(in srgb, var(--sa-area-finanzas) 45%, var(--sa-ink))',
  'color-mix(in srgb, var(--sa-area-finanzas) 35%, var(--sa-surface))',
];

const ESCRITORIO = '(min-width: 768px)';

@Component({
  selector: 'app-distribucion',
  imports: [
    PageHeaderComponent, SaPageHead, SaIcon, IonContent, IonSearchbar, IonButton,
    SaList, SaTableWrap, IonInput, IonSelect, IonSelectOption,
  ],
  styles: [`
    .conteo { margin: 0; display: flex; gap: var(--sa-space-4); flex-wrap: wrap;
              font-size: var(--sa-text-body); color: var(--sa-ink-soft); }
    .conteo strong { color: var(--sa-ink); font-size: var(--sa-text-title); }
    .split { display: grid; gap: var(--sa-space-4); align-items: start;
             grid-template-columns: minmax(20rem, 2fr) minmax(0, 3fr); }
    .split > .detalle { margin-top: var(--sa-space-4); }
    /* Desktop: the queue scrolls on its own so the selected invoice stays in view. */
    @media (min-width: 768px) {
      .split > sa-list { display: block; max-block-size: calc(100dvh - 12rem); overflow-y: auto; }
    }
    @media (max-width: 767.98px) {
      .split { grid-template-columns: 1fr; }
      .split.has-sel > sa-list { display: none; }
      .split:not(.has-sel) > .detalle { display: none; }
      .split > .detalle { margin-top: 0; }
    }
    @media (min-width: 768px) { .solo-movil { display: none; } }
    h2 { margin: 0; font-size: var(--sa-text-title); font-weight: 700; }
    h3 { margin: var(--sa-space-5) 0 var(--sa-space-3); font-size: var(--sa-text-body); font-weight: 700; }
    .cola-head { flex: 1 0 100%; display: flex; align-items: baseline; justify-content: space-between;
                 gap: var(--sa-space-2); flex-wrap: wrap; }
    .cola-head span { font-size: var(--sa-text-dense); color: var(--sa-ink-soft); }
    .cola .sa-chip { min-height: 44px; }
    .fac { display: flex; align-items: center; gap: var(--sa-space-3); inline-size: 100%; min-block-size: 56px;
           padding: var(--sa-space-3) var(--sa-space-4); border: 0; border-top: var(--sa-border) solid var(--sa-line);
           background: transparent; font: inherit; font-size: var(--sa-text-body); color: var(--sa-ink);
           text-align: left; cursor: pointer; }
    .fac:first-child { border-top: 0; }
    .fac:hover { background: color-mix(in srgb, var(--sa-area-finanzas-tint) 50%, var(--sa-surface)); }
    .fac[aria-current="true"] { background: var(--sa-area-finanzas-tint); }
    .fac__txt { flex: 1; min-inline-size: 0; }
    .fac__txt span { display: block; font-size: var(--sa-text-dense); color: var(--sa-ink-soft);
                     white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fac__der { display: flex; flex-direction: column; align-items: flex-end; gap: var(--sa-space-1); flex: none; }
    .detalle { padding: 20px 22px; }
    .vacio { color: var(--sa-ink-soft); margin: 0; }
    .det-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sa-space-3); flex-wrap: wrap; }
    .det-head p { margin: var(--sa-space-1) 0 0; color: var(--sa-ink-soft); font-size: var(--sa-text-body); }
    .volver { margin: 0 0 var(--sa-space-3) -8px; }
    dl { display: grid; gap: var(--sa-space-3) var(--sa-space-5); margin: var(--sa-space-4) 0 0;
         grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
         padding: var(--sa-space-4) 0; border-block: var(--sa-border) solid var(--sa-line); }
    dt { color: var(--sa-ink-soft); font-size: var(--sa-text-dense); }
    dd { margin: var(--sa-space-1) 0 0; font-size: 20px; font-weight: 700; }
    .estado-row { display: flex; gap: var(--sa-space-2); align-items: center; flex-wrap: wrap; }
    .resumen { display: flex; justify-content: space-between; gap: var(--sa-space-3); flex-wrap: wrap;
               font-size: var(--sa-text-body); }
    .falta { color: var(--sa-warn-fg); font-weight: 600; }
    .listo { color: var(--sa-ok-fg); font-weight: 600; }
    .excede { color: var(--sa-crit-fg); font-weight: 600; }
    .barra { display: flex; gap: 2px; block-size: 14px; border-radius: 999px; overflow: hidden;
             background: var(--sa-line); margin: var(--sa-space-2) 0 var(--sa-space-4); }
    .barra > i { display: block; min-inline-size: 0; }
    .barra.over > i { background: var(--sa-crit-fg) !important; }
    .linea { display: grid; gap: var(--sa-space-3); align-items: end; padding: var(--sa-space-3) 0;
             border-top: var(--sa-border) solid var(--sa-line);
             grid-template-columns: 12px minmax(0, 1.6fr) minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, .8fr) auto; }
    .sw { inline-size: 12px; block-size: 12px; border-radius: 3px; align-self: center; }
    @media (max-width: 1199.98px) {
      .linea { grid-template-columns: 12px 1fr 1fr; }
      .linea > .sw { grid-row: span 2; }
    }
    @media (max-width: 767.98px) {
      .linea { grid-template-columns: 12px 1fr; }
      .linea > .sw { grid-row: span 5; align-self: start; margin-top: 18px; }
    }
    .sugerencias { grid-column: 2 / -1; display: flex; flex-wrap: wrap; gap: var(--sa-space-2); margin: 0; padding: 0; list-style: none; }
    .sugerencias button { min-block-size: 44px; }
    .acciones { display: flex; gap: var(--sa-space-2); margin-top: var(--sa-space-3); flex-wrap: wrap; }
    .pie { display: flex; align-items: center; justify-content: space-between; gap: var(--sa-space-3); flex-wrap: wrap;
           margin-top: var(--sa-space-5); padding-top: var(--sa-space-4); border-top: var(--sa-border) solid var(--sa-line); }
    .pie p { margin: 0; font-size: var(--sa-text-dense); color: var(--sa-ink-soft); max-inline-size: 42ch; }
    .pie .motivo { color: var(--sa-ink); }
    @media (max-width: 767.98px) { .pie ion-button { inline-size: 100%; } }
    .confirmar { margin-top: var(--sa-space-4); }
    .confirmar p { margin: 0 0 var(--sa-space-3); }
    .nota { margin: var(--sa-space-4) 0 0; font-size: var(--sa-text-dense); color: var(--sa-ink-soft); }
  `],
  template: `
    <app-page-header [title]="sel() ? 'Factura ' + sel()!.numdoc : 'Distribuir facturas'"></app-page-header>

    <ion-content>
      <div class="page-content page-content--wide">
      <sa-page-head title="Distribuir facturas" area="finanzas" icon="split"
                    subtitle="Reparte el neto de cada factura aceptada entre centros de costo para que sume al balance.">
        <div saActions>
          <p class="conteo">
            <span><strong class="num">{{ n('ACEPTADO') }}</strong> por distribuir</span>
            <span><strong class="num">{{ n('DISTRIBUIDO') }}</strong> distribuidas</span>
          </p>
        </div>
      </sa-page-head>

      @if (error()) { <div class="sa-notice sa-notice--crit" role="alert">{{ error() }}</div> }
      @if (mensaje()) { <div class="sa-notice sa-notice--ok" role="status">{{ mensaje() }}</div> }

      <div class="split" [class.has-sel]="!!sel()">
        <sa-list class="cola" [loading]="cargando()" [empty]="datos().length === 0" emptyTitle="Sin facturas"
                 [emptyText]="buscar() ? 'Prueba con otro número, proveedor o RUT.' : 'No hay facturas en este estado.'"
                 [range]="rango()" [page]="pagina()" [pages]="paginas()" (pageChange)="pagina.set($event)">
          <div saFilters>
            <div class="cola-head">
              <h2 id="h-cola">Cola</h2>
              @if (estado() === 'ACEPTADO') { <span>Las que más esperan primero</span> }
            </div>
            <div class="sa-chips" role="group" aria-label="Estado de la factura">
              <button type="button" class="sa-chip" [attr.aria-pressed]="estado() === 'ACEPTADO'"
                      (click)="filtrar('ACEPTADO')">Por distribuir {{ n('ACEPTADO') }}</button>
              <button type="button" class="sa-chip" [attr.aria-pressed]="estado() === 'DISTRIBUIDO'"
                      (click)="filtrar('DISTRIBUIDO')">Distribuidas {{ n('DISTRIBUIDO') }}</button>
              <button type="button" class="sa-chip" [attr.aria-pressed]="estado() === ''"
                      (click)="filtrar('')">Todas {{ n('TOTAL') }}</button>
            </div>
            <ion-searchbar placeholder="Número, proveedor o RUT" [debounce]="350" aria-label="Buscar factura"
                           (ionInput)="buscarTexto($any($event).detail.value ?? '')"></ion-searchbar>
          </div>
          <div>
            @for (d of cola(); track d.id) {
              <button type="button" class="fac" [attr.aria-current]="sel()?.id === d.id"
                      (click)="abrir(d)">
                <span class="fac__txt">
                  <strong>Factura {{ d.numdoc }}</strong>
                  <span>{{ d.proveedor || d.rut }} · {{ fecha(d.fecha) }}</span>
                </span>
                <span class="fac__der">
                  <span class="num">{{ moneda(d.neto) }}</span>
                  @if (d.estado === 'ACEPTADO' && espera(d) != null) {
                    <span class="sa-badge num" [class.sa-badge--crit]="espera(d)! > 365"
                          [class.sa-badge--warn]="espera(d)! <= 365">{{ dias(espera(d)!) }}</span>
                  } @else {
                    <span class="sa-badge" [class]="'sa-badge sa-badge--' + tono(d.estado)">{{ nombreEstado(d.estado) }}</span>
                  }
                </span>
              </button>
            }
          </div>
        </sa-list>

        <section class="sa-panel detalle" aria-labelledby="h-factura">
          @if (sel(); as f) {
            <ion-button class="solo-movil volver" fill="clear" (click)="cerrar()">
              <sa-icon name="arrow-left" [size]="18" slot="start" />Volver a la cola
            </ion-button>
            <div class="det-head">
              <div>
                <h2 id="h-factura">Factura {{ f.numdoc }}</h2>
                <p>{{ f.proveedor || 'Proveedor sin nombre' }}@if (f.rut) { · {{ f.rut }} } · emitida el {{ fecha(f.fecha) }}
                  @if (f.estado === 'ACEPTADO' && espera(f) != null) { · espera {{ dias(espera(f)!) }} }</p>
              </div>
              <span class="sa-badge" [class]="'sa-badge sa-badge--' + tono(f.estado)">{{ nombreEstado(f.estado) }}</span>
            </div>
            <dl>
              <div><dt>Neto a repartir</dt><dd class="num">{{ moneda(f.neto) }}</dd></div>
              <div><dt>IVA</dt><dd class="num">{{ moneda(f.iva) }}</dd></div>
              <div><dt>Total</dt><dd class="num">{{ moneda(f.total) }}</dd></div>
              <div><dt>Tipo</dt><dd>{{ f.tipo_doc }}</dd></div>
            </dl>

            @if (hijos().length) {
              <h3>Reparto actual</h3>
              <sa-table-wrap label="Reparto actual">
                <table class="sa-table">
                  <thead><tr>
                    <th>N°</th><th>Centro de costo</th><th class="num">Neto</th>
                    <th class="num">IVA</th><th class="num">Total</th><th>Estado</th><th>Usuario</th>
                  </tr></thead>
                  <tbody>
                    @for (h of hijos(); track h.id) {
                      <tr>
                        <th scope="row">{{ h.numdoc }}</th>
                        <td data-label="Centro de costo">{{ h.ccosto }}</td>
                        <td class="num" data-label="Neto">{{ moneda(h.neto) }}</td>
                        <td class="num" data-label="IVA">{{ moneda(h.iva) }}</td>
                        <td class="num" data-label="Total">{{ moneda(h.total) }}</td>
                        <td data-label="Estado">
                          <span class="sa-estado" [class]="'sa-estado sa-estado--' + tono(h.estado)">{{ nombreEstado(h.estado) }}</span>
                        </td>
                        <td data-label="Usuario">{{ h.usuario }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </sa-table-wrap>
            }

            @if (f.estado === 'ACEPTADO') {
              <h3>Nuevo reparto</h3>
              <div class="resumen">
                <span>Repartido <strong class="num">{{ moneda(reparto$().asignado) }}</strong> de {{ moneda(f.neto) }}</span>
                @if (reparto$().excede) {
                  <span class="excede num">Supera el neto por {{ moneda(-reparto$().falta) }}</span>
                } @else if (reparto$().completo) {
                  <span class="listo">Listo para distribuir</span>
                } @else {
                  <span class="falta num">Falta {{ moneda(reparto$().falta) }}</span>
                }
              </div>
              <div class="barra" [class.over]="reparto$().excede" role="img" [attr.aria-label]="ariaBarra()">
                @for (s of reparto$().segmentos; track $index) {
                  <i [style.flex-basis.%]="s" [style.background]="tonoLinea($index)"></i>
                }
              </div>

              @for (r of reparto(); track $index; let i = $index) {
                <div class="linea" role="group" [attr.aria-label]="'Centro de costo ' + (i + 1)">
                  <span class="sw" [style.background]="tonoLinea(i)" aria-hidden="true"></span>
                  <ion-select label="Línea de la factura" labelPlacement="stacked" fill="outline" interface="popover"
                              [value]="r.id_detalle" (ionChange)="cambiar(i, { id_detalle: $any($event).detail.value })">
                    @for (l of f.detalle; track l.id) {
                      <ion-select-option [value]="l.id">{{ l.nombre || ('Línea ' + l.id) }}</ion-select-option>
                    }
                  </ion-select>
                  <ion-input label="Centro de costo" labelPlacement="stacked" fill="outline"
                             [value]="r.ccosto" (ionFocus)="activa.set(i)"
                             (ionInput)="cambiar(i, { ccosto: $any($event).detail.value ?? '' })"></ion-input>
                  <ion-input label="Neto" labelPlacement="stacked" fill="outline" type="number" inputmode="numeric"
                             [value]="r.neto" (ionInput)="cambiarNeto(i, $any($event).detail.value)"></ion-input>
                  <ion-select label="Exento" labelPlacement="stacked" fill="outline" interface="popover"
                              [value]="r.exento" (ionChange)="cambiar(i, { exento: $any($event).detail.value })">
                    <ion-select-option value="NO">No</ion-select-option>
                    <ion-select-option value="SI">Sí</ion-select-option>
                  </ion-select>
                  <ion-button fill="clear" color="danger" [attr.aria-label]="'Quitar centro ' + (i + 1)"
                              [disabled]="reparto().length === 1" (click)="quitar(i)">Quitar</ion-button>
                  @if (activa() === i && sugerencias(r.ccosto).length) {
                    <ul class="sugerencias" [attr.aria-label]="'Centros que coinciden con ' + r.ccosto">
                      @for (c of sugerencias(r.ccosto); track c.ccosto) {
                        <li><button type="button" class="sa-chip" (click)="elegirCentro(i, c.ccosto)">
                          {{ c.ccosto }} · {{ c.proyecto }}</button></li>
                      }
                    </ul>
                  }
                </div>
              }

              <div class="acciones">
                <ion-button fill="outline" (click)="agregar()">
                  <sa-icon name="plus" [size]="18" slot="start" />Agregar centro de costo
                </ion-button>
                <ion-button fill="outline" (click)="asignarFalta()" [disabled]="reparto$().falta <= 0">
                  Asignar lo que falta
                </ion-button>
              </div>

              <div class="pie">
                @if (motivo()) {
                  <p class="motivo" id="motivo">{{ motivo() }}</p>
                } @else {
                  <p>La distribución es un acto único: para cambiarla hay que deshacerla.</p>
                }
                <ion-button color="finanzas" (click)="distribuir()" [attr.aria-describedby]="motivo() ? 'motivo' : null"
                            [disabled]="trabajando() || !!motivo()">
                  Distribuir factura
                </ion-button>
              </div>
            } @else if (f.estado === 'DISTRIBUIDO') {
              @if (confirmando()) {
                <div class="sa-notice sa-notice--warn confirmar" role="group" aria-labelledby="conf-txt">
                  <p id="conf-txt">¿Deshacer la distribución de la factura {{ f.numdoc }}? Sus repartos se anulan
                    y la factura vuelve a quedar por distribuir.</p>
                  <div class="acciones">
                    <ion-button color="danger" (click)="deshacer()" [disabled]="trabajando()">Sí, deshacer</ion-button>
                    <ion-button fill="outline" (click)="confirmando.set(false)">Cancelar</ion-button>
                  </div>
                </div>
              } @else {
                <div class="acciones">
                  <ion-button color="danger" fill="outline" (click)="confirmando.set(true)"
                              [disabled]="trabajando()">Deshacer distribución</ion-button>
                </div>
              }
              <p class="nota">La distribución es un acto único. Para cambiar el reparto hay que deshacer este primero.</p>
            } @else {
              <p class="nota">Solo se puede distribuir una factura aceptada. Esta está {{ nombreEstado(f.estado).toLowerCase() }}.</p>
            }
          } @else {
            <h2 id="h-factura">Ninguna factura elegida</h2>
            <p class="vacio">Elige una factura de la cola para ver su resumen y repartir su neto.</p>
          }
        </section>
      </div>
      </div>
    </ion-content>
  `,
})
export class DistribucionPage {
  private readonly http = inject(HttpClient);

  readonly datos = signal<Factura[]>([]);
  readonly total = signal(0);
  readonly paginas = signal(1);
  readonly pagina = signal(1);
  readonly buscar = signal('');
  readonly estado = signal('ACEPTADO');
  readonly cargando = signal(false);
  readonly trabajando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly confirmando = signal(false);

  readonly sel = signal<Detalle | null>(null);
  readonly hijos = signal<Hijo[]>([]);
  readonly reparto = signal<Reparto[]>([]);
  readonly centros = signal<CentroCosto[]>([]);
  readonly activa = signal<number | null>(null);

  readonly moneda = clp;
  readonly fecha = fechaTabla;
  readonly nombreEstado = etiquetaEstado;
  readonly tono = tonoEstado;
  rango = () => rangoLista(this.pagina(), this.datos().length, this.total(), 'facturas');

  /** El backend ordena por numero; en la cola por distribuir, la mas antigua va primero. */
  readonly cola = computed(() => {
    const d = this.datos();
    return this.estado() === 'ACEPTADO'
      ? [...d].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
      : d;
  });

  readonly reparto$ = computed(() =>
    allocation(this.sel()?.neto ?? 0, this.reparto().map((r) => r.neto)));

  /** Why the primary action is disabled, or '' when the allocation can be sent. */
  readonly motivo = computed(() => {
    const a = this.reparto$();
    if (a.excede) return `El reparto supera el neto de la factura por ${clp(-a.falta)}. Ajusta los montos.`;
    if (a.asignado <= 0) return 'Indica al menos un centro de costo con su monto.';
    const sinCentro = this.reparto().findIndex((r) => Number(r.neto) > 0 && !r.ccosto.trim());
    if (sinCentro >= 0) return `Falta el centro de costo de la línea ${sinCentro + 1}.`;
    return '';
  });

  readonly ariaBarra = computed(() => {
    const a = this.reparto$();
    const neto = Number(this.sel()?.neto ?? 0);
    const pct = neto > 0 ? Math.round(a.asignado / neto * 100) : 0;
    return `Repartido ${pct} por ciento del neto`;
  });

  readonly conteos = signal<Record<string, number>>({});
  espera = (d: { fecha: string }) => daysSince(d.fecha);
  dias = (n: number) => `${n.toLocaleString('es-CL')} ${n === 1 ? 'día' : 'días'}`;
  n = (estado: string) => (this.conteos()[estado] ?? 0).toLocaleString('es-CL');
  tonoLinea = (i: number) => TONOS[i % TONOS.length];

  sugerencias(texto: string): CentroCosto[] {
    const t = texto.trim().toLowerCase();
    if (!t) return [];
    if (this.centros().some((c) => c.ccosto.toLowerCase() === t)) return [];
    return this.centros()
      .filter((c) => c.ccosto.toLowerCase().includes(t) || String(c.proyecto ?? '').toLowerCase().includes(t))
      .slice(0, 6);
  }

  private ultimoFiltro = '';
  private turno = 0;

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      const estado = q.get('estado');
      if (estado && ['ACEPTADO', 'DISTRIBUIDO'].includes(estado)) this.estado.set(estado);
    });
    void this.cargarConteos();
    void this.cargarCentros();
    effect(() => {
      const b = this.buscar(); const e = this.estado(); const p = this.pagina();
      const filtro = `${b}|${e}`;
      const pg = filtro !== this.ultimoFiltro ? 1 : p;
      this.ultimoFiltro = filtro;
      void this.cargar(b, e, pg);
    });
  }

  filtrar(estado: string): void {
    this.pagina.set(1);
    this.estado.set(estado);
  }

  buscarTexto(texto: string): void {
    this.pagina.set(1);
    this.buscar.set(texto);
  }

  private async cargar(buscar: string, estado: string, pagina: number): Promise<void> {
    const turno = ++this.turno;
    this.cargando.set(true);
    this.error.set('');
    try {
      const q = new URLSearchParams({ pagina: String(pagina), limite: '50' });
      if (buscar) q.set('buscar', buscar);
      if (estado) q.set('estado', estado);
      const r = await firstValueFrom(this.http.get<{
        datos: Factura[]; total: number; paginas: number;
      }>(`${API}/distribucion?${q}`));
      if (turno !== this.turno) return;
      this.datos.set(r.datos);
      this.total.set(r.total);
      this.paginas.set(r.paginas);
      // En escritorio la cola trabaja con la primera factura ya abierta.
      const primera = this.cola()[0];
      if (!this.sel() && primera && typeof matchMedia === 'function' && matchMedia(ESCRITORIO).matches) {
        void this.abrir(primera);
      }
    } catch (e: any) {
      if (turno !== this.turno) return;
      this.datos.set([]);
      this.error.set(e?.error?.message ?? 'No se pudieron cargar las facturas');
    } finally {
      if (turno === this.turno) this.cargando.set(false);
    }
  }

  async abrir(f: Factura, limpiar = true): Promise<void> {
    if (limpiar) { this.error.set(''); this.mensaje.set(''); }
    this.confirmando.set(false);
    this.activa.set(null);
    try {
      const d = await firstValueFrom(
        this.http.get<Detalle & { hijos: Hijo[] }>(`${API}/distribucion/${f.id}`),
      );
      // El listado trae "hijos" como conteo; el detalle lo trae como arreglo.
      this.hijos.set((d as any).hijos ?? []);
      this.sel.set({ ...d, hijos: f.hijos } as unknown as Detalle);
      this.reparto.set([this.lineaNueva()]);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo abrir la factura');
    }
  }

  cerrar(): void {
    this.sel.set(null); this.hijos.set([]); this.reparto.set([]);
    this.confirmando.set(false);
    this.error.set(''); this.mensaje.set('');
  }

  /** Totales reales por estado: una consulta de un registro por estado. */
  private async cargarConteos(): Promise<void> {
    const pedir = async (estado: string) => {
      const q = new URLSearchParams({ pagina: '1', limite: '1' });
      if (estado) q.set('estado', estado);
      const r = await firstValueFrom(this.http.get<{ total: number }>(`${API}/distribucion?${q}`));
      return r.total ?? 0;
    };
    try {
      const [total, aceptado, distribuido] = await Promise.all([
        pedir(''), pedir('ACEPTADO'), pedir('DISTRIBUIDO'),
      ]);
      this.conteos.set({ TOTAL: total, ACEPTADO: aceptado, DISTRIBUIDO: distribuido });
    } catch { /* los totales son accesorios */ }
  }

  /** Centros vigentes para sugerir; el campo sigue aceptando texto libre. */
  private async cargarCentros(): Promise<void> {
    try {
      this.centros.set(await firstValueFrom(this.http.get<CentroCosto[]>(`${API}/balance/ccostos`)));
    } catch { this.centros.set([]); }
  }

  private lineaNueva(neto: number | null = null): Reparto {
    return { id_detalle: this.sel()?.detalle?.[0]?.id ?? 0, ccosto: '', neto, exento: 'NO' };
  }

  cambiar(i: number, cambio: Partial<Reparto>): void {
    this.reparto.set(this.reparto().map((r, k) => (k === i ? { ...r, ...cambio } : r)));
  }

  cambiarNeto(i: number, valor: string | number | null | undefined): void {
    const v = valor === '' || valor == null ? null : Number(valor);
    this.cambiar(i, { neto: v != null && Number.isFinite(v) ? v : null });
  }

  elegirCentro(i: number, ccosto: string): void {
    this.cambiar(i, { ccosto });
    this.activa.set(null);
  }

  agregar(): void {
    this.reparto.set([...this.reparto(), this.lineaNueva()]);
  }

  /** Lleva el neto pendiente a una linea: la ultima si esta vacia, si no una nueva. */
  asignarFalta(): void {
    const falta = this.reparto$().falta;
    if (falta <= 0) return;
    const lineas = this.reparto();
    const ultima = lineas[lineas.length - 1];
    if (ultima && !(Number(ultima.neto) > 0)) this.cambiar(lineas.length - 1, { neto: falta });
    else this.reparto.set([...lineas, this.lineaNueva(falta)]);
  }

  quitar(i: number): void {
    this.reparto.set(this.reparto().filter((_, k) => k !== i));
    this.activa.set(null);
  }

  async distribuir(): Promise<void> {
    const f = this.sel();
    if (!f || this.motivo()) return;
    const lineas = this.reparto()
      .filter((r) => r.ccosto.trim() && Number(r.neto) > 0)
      .map((r) => ({
        id_detalle: r.id_detalle, ccosto: r.ccosto.trim(),
        neto: Number(r.neto), exento: r.exento,
      }));
    if (!lineas.length) { this.error.set('Falta indicar centro de costo y monto'); return; }

    this.trabajando.set(true);
    this.error.set(''); this.mensaje.set('');
    try {
      const r = await firstValueFrom(
        this.http.post<{ mensaje: string }>(`${API}/distribucion/${f.id}`, { lineas }),
      );
      this.mensaje.set(r.mensaje);
      await this.abrir(f, false);
      this.refrescarCola();
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo distribuir');
    } finally {
      this.trabajando.set(false);
    }
  }

  async deshacer(): Promise<void> {
    const f = this.sel();
    if (!f) return;
    this.trabajando.set(true);
    this.error.set(''); this.mensaje.set('');
    try {
      const r = await firstValueFrom(
        this.http.delete<{ mensaje: string }>(`${API}/distribucion/${f.id}`),
      );
      this.mensaje.set(r.mensaje);
      await this.abrir(f, false);
      this.refrescarCola();
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo deshacer');
    } finally {
      this.trabajando.set(false);
      this.confirmando.set(false);
    }
  }

  private refrescarCola(): void {
    void this.cargar(this.buscar(), this.estado(), this.pagina());
    void this.cargarConteos();
  }
}
