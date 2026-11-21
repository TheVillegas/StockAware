/**
 * MATERIAL_X_BODEGA: saldo de materiales por bodega.
 *
 * El ajuste de stock vive dentro de esta pantalla, igual que en el ERP: no es
 * una opcion de menu aparte, es una accion sobre una fila del listado.
 */
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import {
  IonButton, IonContent, IonFooter, IonInput, IonModal, IonSearchbar,
} from '@ionic/angular/standalone';

import { API, AuthService } from '../core/auth.service';
import { clp } from '../shared/format';
import { PageHeaderComponent } from '../shared/page-header.component';
import { SaIcon } from '../shared/sa-icon.component';
import { SaList } from '../shared/sa-list.component';
import { SaPageHead } from '../shared/sa-page-head.component';
import { SaTableWrap } from '../shared/sa-table-wrap.component';
import { accionesCrear } from '../shared/workspace-navigation';
import { PreciosPanel } from '../precios/precios-panel.component';
import { BodegaCombobox } from './bodega-combobox.component';
import { stockState } from './stock-state';
import {
  coverageDays, coverageLabel, ordenDesdeStock, sortByStockRisk, suggestedOrderQty,
} from '../shared/consulta';

/** Coverage at or below this many days counts as "runs out soon". */
const PRONTO_DIAS = 30;

export interface Bodega { bodega: number; descr: string; ccosto: string; estado: string; }
interface FilaStock {
  cod_material: string; nombre: string; estado: string;
  id_bodega: number; bodega: string; stock: number;
  unidad: string; tarifa: number; stock_minimo: number;
  /** Salidas promedio por dia en el ultimo año; ausente si el backend no lo informa. */
  consumo_diario?: number | string | null;
}
type Filtro = 'todos' | 'urgente' | 'crit' | 'warn' | 'pronto';

@Component({
  selector: 'app-stock',
  imports: [
    FormsModule, RouterLink, PageHeaderComponent, IonContent, IonFooter,
    IonSearchbar, IonButton, IonInput, IonModal,
    SaIcon, SaList, SaPageHead, SaTableWrap, BodegaCombobox, PreciosPanel,
  ],
  styles: [`
    .vistas .sa-chip { min-block-size: 2.75rem; display: inline-flex; align-items: center; gap: var(--sa-space-2); }
    .vistas .sa-chip .num { font-weight: 700; }
    .sel { inline-size: 2.75rem; text-align: center; }
    .sel input { inline-size: 1.25rem; block-size: 1.25rem; cursor: pointer; accent-color: var(--sa-area-bodega); }
    .material .code { display: block; }
    .material span:last-child { font-weight: 400; }
    .stock { display: inline-flex; align-items: center; gap: var(--sa-space-2); flex-wrap: wrap; justify-content: flex-end; }
    .fila-accion {
      appearance: none; font: inherit; font-size: var(--sa-text-dense); font-weight: 600; cursor: pointer;
      min-block-size: var(--sa-control-h-sm); padding: 0 var(--sa-space-3);
      background: var(--sa-surface); color: var(--sa-ink);
      border: var(--sa-border) solid var(--sa-border-input); border-radius: var(--sa-radius);
    }
    .fila-accion:hover { border-color: var(--sa-ink); }
    .fila-accion:focus-visible { outline: var(--sa-focus-ring); outline-offset: var(--sa-focus-offset); }
    @media (pointer: coarse) { .fila-accion { min-block-size: 2.75rem; } }
    .ajuste { max-inline-size: 36rem; padding: var(--sa-space-5); }
    .ajuste h2 { margin: 0; font-size: var(--sa-text-title); }
    .ajuste p { margin: var(--sa-space-1) 0 var(--sa-space-4); color: var(--sa-ink-soft); }
    .ajuste__campos { display: grid; gap: var(--sa-space-3); grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); }
    .ajuste__motivo { grid-column: 1 / -1; }
    .ajuste .sa-toolbar { margin-top: var(--sa-space-4); }
    .oculto { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .pedido strong { font-variant-numeric: tabular-nums; }
    .pedido__acciones { display: flex; gap: var(--sa-space-2); flex-wrap: wrap; }
    .stock-layout { display: flex; flex-direction: column; }
    .stock-mobile, .stock-intro, .stock-section { display: none; }
    .stock-search { display: grid; gap: var(--sa-space-1); flex: 1 1 16rem; min-inline-size: 12rem; }
    .stock-search label { color: var(--sa-ink-soft); font-size: var(--sa-text-meta); font-weight: 600; }
    ion-modal.stock-sheet { --height: min(80dvh, 34rem); --border-radius: var(--sa-ep1-radius-card) var(--sa-ep1-radius-card) 0 0; }
    .detalle-content { --background: var(--sa-surface); }
    .detalle { padding: var(--sa-space-4); padding-bottom: max(var(--sa-space-4), env(safe-area-inset-bottom)); color: var(--sa-ink); }
    .detalle h2 { font-size: var(--sa-text-page); }
    .detalle__datos { background: var(--sa-surface-2); border: 1px solid var(--sa-line-strong); border-radius: var(--sa-radius); padding: var(--sa-space-3); }
    .detalle__acciones { display: flex; flex-wrap: wrap; gap: var(--sa-space-2); }
    @media (max-width: 767.98px) {
      .stock-intro { display: grid; gap: var(--sa-space-1); margin-bottom: var(--sa-space-3); }
      .stock-intro span { color: var(--sa-area-bodega); font-size: var(--sa-text-label); font-weight: 750; letter-spacing: .085em; text-transform: uppercase; }
      .stock-intro h1 { margin: 0; font-size: var(--sa-text-page); line-height: 1.12; letter-spacing: -.025em; }
      .stock-section { display: block; margin: var(--sa-space-4) var(--sa-space-3) var(--sa-space-2); font-size: var(--sa-text-title); }
      .stock-search { order: -1; min-inline-size: 0; flex-basis: 100%; }
      .stock-search ion-searchbar { min-inline-size: 0; width: 100%; }
      .stock-layout sa-list { order: 0; }
      .stock-layout .sa-stats { order: 1; margin-top: var(--sa-space-4); }
      .stock-desktop { display: none; }
      .stock-mobile { display: block; border: 1px solid var(--sa-line-strong); border-radius: var(--sa-ep1-radius-card); overflow: hidden; background: var(--sa-surface); }
      .stock-mobile__row + .stock-mobile__row { border-top: 1px solid var(--sa-line-strong); }
      .stock-mobile__button { width: 100%; min-height: 44px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--sa-space-1) var(--sa-space-2); text-align: left; padding: var(--sa-space-3); background: var(--sa-surface); color: var(--sa-ink); border: 0; font: inherit; }
      .stock-mobile__button:focus-visible { outline: var(--sa-focus-ring); outline-offset: calc(-1 * var(--sa-focus-offset)); }
      .stock-mobile__button strong, .stock-mobile__button small { display: block; overflow-wrap: anywhere; }
      .stock-mobile__button small { color: var(--sa-ink-soft); font-size: var(--sa-text-meta); margin-top: var(--sa-space-1); }
      .stock-mobile__qty { text-align: right; font-variant-numeric: tabular-nums; }
      .stock-mobile__status { grid-column: 1 / -1; }
      .stock-mobile__select { display: flex; align-items: center; gap: var(--sa-space-2); min-height: 44px; padding: 0 var(--sa-space-3); }
      .stock-mobile__select input { width: 1.25rem; height: 1.25rem; accent-color: var(--sa-area-bodega); }
    }
  `],
  template: `
    <app-page-header title="Stock"></app-page-header>

    <ion-content>
      <div class="page-content page-content--wide">
      <div class="stock-intro"><span>Bodega · Catálogo operativo</span><h1>Stock por bodega</h1></div>
      <sa-page-head title="Stock" area="bodega" icon="warehouse" [phoneTitle]="false"
                    subtitle="Qué pedir antes de que falte. La cobertura usa el consumo del último año.">
        <div saActions>
          @if (puedeCrearMaterial()) {
            <ion-button fill="outline" routerLink="/f/ADM_MAT_FUN">Nuevo material</ion-button>
          }
          @if (rutaSalida(); as r) {
            <ion-button fill="outline" [routerLink]="r"><sa-icon name="out" slot="start" />Registrar salida</ion-button>
          }
          @if (rutaIngreso(); as r) {
            <ion-button color="bodega" [routerLink]="r"><sa-icon name="in" slot="start" />Registrar ingreso</ion-button>
          }
        </div>
      </sa-page-head>

      @if (errorConsulta()) { <div class="sa-notice sa-notice--crit" role="alert">{{ errorConsulta() }}</div> }
      @if (error()) { <div class="sa-notice sa-notice--crit" role="alert">{{ error() }}</div> }
      @if (mensaje()) { <div class="sa-notice sa-notice--ok" role="status">{{ mensaje() }}</div> }

      @if (precios(); as p) {
        <app-precios-panel [codMaterial]="p.cod_material" [nombre]="p.nombre" (cerrar)="precios.set(null)" />
      } @else if (ajustando(); as f) {
        <section class="sa-panel ajuste" aria-labelledby="ajuste-titulo">
          <h2 id="ajuste-titulo">Ajustar stock de <span class="code">{{ f.cod_material }}</span></h2>
          <p>{{ f.nombre }} en {{ f.bodega }}</p>
          <div class="ajuste__campos">
            <ion-input label="Stock actual" labelPlacement="stacked" fill="outline"
                       [value]="f.stock + ' ' + f.unidad" disabled="true"></ion-input>
            <ion-input label="Stock que debe quedar" labelPlacement="stacked" fill="outline"
                       type="number" inputmode="decimal" [(ngModel)]="nuevoStock"></ion-input>
            <ion-input class="ajuste__motivo" label="Motivo" labelPlacement="stacked" fill="outline"
                       [(ngModel)]="motivo" placeholder="Inventario físico"></ion-input>
          </div>
          <div class="sa-toolbar">
            <ion-button color="bodega" (click)="confirmarAjuste()" [disabled]="trabajando()">Confirmar ajuste</ion-button>
            <ion-button fill="outline" (click)="ajustando.set(null)">Cancelar</ion-button>
          </div>
        </section>
      } @else {
        @if (soloReponer()) {
          <div class="sa-notice sa-notice--warn">
            Materiales bajo el mínimo en todas las bodegas.
            <button type="button" class="sa-link" (click)="verTodo()">Ver todo el stock</button>
          </div>
        }

        <div class="stock-layout">
        @if (hayConsulta() && !cargando() && !errorConsulta()) {
          <div class="sa-stats">
            <div class="sa-stat sa-stat--crit">
              <div class="sa-stat__label">Urgente</div>
              <div class="sa-stat__value num">{{ resumen().urgente }}</div>
              <div class="sa-stat__hint">Sin stock y con consumo</div>
            </div>
            <div class="sa-stat">
              <div class="sa-stat__label">Sin stock</div>
              <div class="sa-stat__value num">{{ resumen().sin }}</div>
              <div class="sa-stat__hint">Stock en cero o negativo</div>
            </div>
            <div class="sa-stat">
              <div class="sa-stat__label">Bajo mínimo</div>
              <div class="sa-stat__value num">{{ resumen().bajo }}</div>
              <div class="sa-stat__hint">Quedan unidades, menos del mínimo</div>
            </div>
            <div class="sa-stat">
              <div class="sa-stat__label">Valorizado</div>
              <div class="sa-stat__value num">{{ moneda(resumen().valor) }}</div>
              <div class="sa-stat__hint">{{ truncado() ? 'Stock por tarifa de los primeros 500' : 'Stock por tarifa' }}</div>
            </div>
          </div>
        }

        <sa-list [loading]="cargando()" [empty]="listaVacia()"
                 [emptyTitle]="errorConsulta() ? 'No se pudo cargar el stock' : tituloVacio()" [emptyText]="errorConsulta() ? '' : textoVacio()"
                 [foot]="hayConsulta() && datos().length > 0" [range]="rango()" [pages]="1">
          <div saFilters>
            <app-bodega-combobox [bodegas]="bodegas()" [value]="bodega()" (valueChange)="bodega.set($event)" />
            <div class="stock-search">
              <label for="stock-buscar">Buscar por material o código</label>
              <ion-searchbar id="stock-buscar" aria-label="Buscar por material o código" placeholder="Código o nombre del material" [debounce]="350"
                             (ionInput)="buscar.set($any($event).detail.value ?? '')"></ion-searchbar>
            </div>
            @if (hayConsulta()) {
              <div class="sa-chips vistas" role="group" aria-label="Vista">
                <button type="button" class="sa-chip" [attr.aria-pressed]="filtro() === 'urgente'"
                        (click)="elegirFiltro('urgente')">Urgente <span class="num">{{ resumen().urgente }}</span></button>
                <button type="button" class="sa-chip" [attr.aria-pressed]="filtro() === 'pronto'"
                        (click)="elegirFiltro('pronto')">Se acaba en {{ prontoDias }} días <span class="num">{{ resumen().pronto }}</span></button>
                <button type="button" class="sa-chip" [attr.aria-pressed]="filtro() === 'warn'"
                        (click)="elegirFiltro('warn')">Bajo mínimo <span class="num">{{ resumen().bajo }}</span></button>
                <button type="button" class="sa-chip" [attr.aria-pressed]="filtro() === 'crit'"
                        (click)="elegirFiltro('crit')">Sin stock <span class="num">{{ resumen().sin }}</span></button>
                <button type="button" class="sa-chip" [attr.aria-pressed]="filtro() === 'todos'"
                        (click)="elegirFiltro('todos')">Todo <span class="num">{{ resumen().total }}</span></button>
              </div>
            }
          </div>
          <h2 class="stock-section">Disponibilidad</h2>
          <div class="stock-mobile">
            @if (puedePedir()) {
              <label class="stock-mobile__select"><input type="checkbox" [checked]="todosMarcados()"
                (change)="marcarVisibles($any($event.target).checked)" /> Elegir todos los visibles para pedir</label>
            }
            @for (f of visibles(); track f.cod_material + '-' + f.id_bodega) {
              @let estado = estadoStock(f.stock, f.stock_minimo);
              <div class="stock-mobile__row">
                <button type="button" class="stock-mobile__button" (click)="abrirDetalle(f, $event)">
                  <span><strong>{{ f.nombre }}</strong><small>{{ f.cod_material }} · {{ f.bodega }}</small></span>
                  <span class="stock-mobile__qty"><strong>{{ f.stock }} {{ f.unidad }}</strong><small>Mínimo {{ f.stock_minimo ?? 'No informado' }}</small></span>
                  <span class="stock-mobile__status">
                    @if (estado === 'crit') { <span class="sa-pill sa-pill--crit">SIN STOCK</span> }
                    @else if (estado === 'warn') { <span class="sa-pill sa-pill--warn">BAJO MÍNIMO</span> }
                    @else { <span class="sa-pill sa-pill--ok">OK</span> }
                  </span>
                </button>
                @if (puedePedir()) {
                  <label class="stock-mobile__select"><input type="checkbox" [checked]="marcado(f)"
                    (change)="alternar(f)" /> Pedir {{ f.cod_material }}</label>
                }
              </div>
            }
          </div>
          <sa-table-wrap class="stock-desktop" label="Materiales">
              <table class="sa-table">
                <thead><tr>
                  @if (puedePedir()) {
                    <th class="sel">
                      <input type="checkbox" aria-label="Elegir todos los visibles para pedir"
                             [checked]="todosMarcados()" (change)="marcarVisibles($any($event.target).checked)" />
                    </th>
                  }
                  <th>Material</th>
                  @if (bodega() === 0) { <th>Bodega</th> }
                  <th class="num">Stock</th><th class="num">Consumo</th><th>Cobertura</th>
                  <th class="num">Pedido sugerido</th><th class="num">Tarifa</th>
                  <th><span class="oculto">Acciones</span></th>
                </tr></thead>
                <tbody>
                  @for (f of visibles(); track f.cod_material + '-' + f.id_bodega) {
                    @let estado = estadoStock(f.stock, f.stock_minimo);
                    @let cantidad = pedir(f);
                    <tr [class.is-selected]="marcado(f)">
                      @if (puedePedir()) {
                        <td class="sel">
                          <input type="checkbox" [attr.aria-label]="'Pedir ' + f.cod_material"
                                 [checked]="marcado(f)" (change)="alternar(f)" />
                        </td>
                      }
                      <th scope="row" class="name material">
                        <span class="code">{{ f.cod_material }}</span>
                        <span>{{ f.nombre }}</span>
                      </th>
                      @if (bodega() === 0) { <td data-label="Bodega">{{ f.bodega }}</td> }
                      <td class="num" data-label="Stock">
                        <span class="stock">
                          <span [class.is-low]="estado === 'crit'">{{ f.stock }} {{ f.unidad }}</span>
                          @if (estado === 'crit') {
                            <span class="sa-pill sa-pill--crit">SIN STOCK</span>
                          } @else if (estado === 'warn') {
                            <span class="sa-pill sa-pill--warn">BAJO MÍNIMO</span>
                          } @else {
                            <span class="sa-pill sa-pill--ok">OK</span>
                          }
                        </span>
                      </td>
                      <td class="num" data-label="Consumo">{{ consumoSemana(f) }}</td>
                      @let dias = cobertura(f);
                      <td data-label="Cobertura" [class.is-low]="dias !== null && dias <= prontoDias">
                        {{ etiquetaCobertura(dias) }}
                      </td>
                      <td class="num" data-label="Pedido sugerido">
                        @if (cantidad > 0) { Pedir {{ cantidad }} {{ f.unidad }} }
                        @else { <span class="sa-sub">No hace falta</span> }
                      </td>
                      <td class="num" data-label="Tarifa">{{ moneda(f.tarifa) }}</td>
                      <td data-label="Acciones">
                        @if (puedeAjustar()) {
                          <button type="button" class="fila-accion" (click)="precios.set(f)"
                                  [attr.aria-label]="'Precios de mercado de ' + f.cod_material">Precios</button>
                          <button type="button" class="fila-accion" (click)="abrirAjuste(f)"
                                  [attr.aria-label]="'Ajustar stock de ' + f.cod_material">Ajustar</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
          </sa-table-wrap>
        </sa-list>
        </div>
      }
      <ion-modal #modal class="stock-sheet" [isOpen]="!!detalle()" (didDismiss)="cerrarDetalle()"
                 [breakpoints]="[0, 1]" [initialBreakpoint]="1" aria-label="Detalle de material">
        <ng-template>
          <ion-content class="detalle-content">
          @if (detalle(); as f) {
            <div class="detalle">
              <ion-button fill="outline" (click)="modal.dismiss()">Volver</ion-button>
              <h2 id="stock-detalle-titulo">{{ f.nombre }}</h2>
              <div class="detalle__datos">
                <p>{{ f.cod_material }} · {{ f.bodega }}</p>
                <p>Stock: {{ f.stock }} {{ f.unidad }} · Mínimo: {{ f.stock_minimo ?? 'No informado' }}</p>
                @let estado = estadoStock(f.stock, f.stock_minimo);
                @if (estado === 'crit') { <span class="sa-pill sa-pill--crit">SIN STOCK</span> }
                @else if (estado === 'warn') { <span class="sa-pill sa-pill--warn">BAJO MÍNIMO</span> }
                @else { <span class="sa-pill sa-pill--ok">OK</span> }
              </div>
              @if (puedeAjustar()) {
                <div class="detalle__acciones">
                  <ion-button fill="outline" (click)="modal.dismiss(); precios.set(f)">Precios</ion-button>
                  <ion-button fill="outline" (click)="modal.dismiss(); abrirAjuste(f)">Ajustar</ion-button>
                </div>
              }
            </div>
          }
          </ion-content>
        </ng-template>
      </ion-modal>
      </div>
    </ion-content>
    @if (seleccion().size && !ajustando() && !precios()) {
      <ion-footer>
        <div class="sa-actionbar pedido" role="region" aria-label="Pedido de reposición">
          <p>
            <strong>{{ seleccion().size }} {{ seleccion().size === 1 ? 'material' : 'materiales' }} para pedir · {{ moneda(estimado()) }} estimado</strong>
            <small>Cantidad para {{ prontoDias }} días de consumo o hasta el mínimo. Revisas proveedor y montos antes de emitir.</small>
          </p>
          <div class="pedido__acciones">
            <ion-button fill="outline" (click)="seleccion.set(empty())">Limpiar</ion-button>
            <ion-button color="bodega" (click)="crearPedido()">Crear orden de compra</ion-button>
          </div>
        </div>
      </ion-footer>
    }
  `,
})
export class StockPage {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly bodegas = signal<Bodega[]>([]);
  readonly datos = signal<FilaStock[]>([]);
  readonly bodega = signal(0);
  readonly buscar = signal('');
  /** Urgente first: what ran out and is still being used. */
  readonly filtro = signal<Filtro>('urgente');
  /** Once the user picks a view, loading new data keeps it. */
  private filtroElegido = false;
  /** Rows picked for a restock order, keyed by material and bodega. */
  readonly seleccion = signal<ReadonlySet<string>>(new Set());
  readonly empty = () => new Set<string>();
  readonly prontoDias = PRONTO_DIAS;
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly errorConsulta = signal('');
  readonly mensaje = signal('');
  readonly trabajando = signal(false);
  readonly ajustando = signal<FilaStock | null>(null);
  /** Material whose "Precios de mercado" panel is open. */
  readonly precios = signal<FilaStock | null>(null);
  private readonly detalleClave = signal<string | null>(null);
  readonly detalle = computed(() => this.datos().find((f) => this.clave(f) === this.detalleClave()) ?? null);
  private detalleOrigen: HTMLElement | null = null;
  private readonly location = inject(Location);

  abrirDetalle(f: FilaStock, event: Event): void {
    this.detalleOrigen = event.currentTarget as HTMLElement;
    void this.router.navigate([], { queryParams: { stockDetalle: this.clave(f) }, queryParamsHandling: 'merge',
      state: { stockDetalleAbierto: true } });
  }

  cerrarDetalle(): void {
    if (this.detalleClave()) {
      const state = this.location.getState() as { stockDetalleAbierto?: boolean } | null;
      if (state?.stockDetalleAbierto) this.location.back();
      else void this.router.navigate([], { queryParams: { stockDetalle: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
    if (!this.ajustando() && !this.precios()) this.detalleOrigen?.focus({ preventScroll: true });
    this.detalleOrigen = null;
  }
  /** Viene del Inicio: lista lo que esta bajo el minimo sin pedir bodega. */
  readonly soloReponer = signal(false);
  private readonly router = inject(Router);

  nuevoStock: number | null = null;
  motivo = '';

  readonly moneda = clp;
  puedeAjustar = () => (this.auth.sesion()?.permisos ?? []).includes('MATERIAL_X_BODEGA');
  puedePedir = () => (this.auth.sesion()?.permisos ?? []).includes('EMITE_OC');
  /** Header actions open the same screens as the global Crear menu. */
  private readonly crear = computed(() => accionesCrear(this.auth.menu()));
  readonly rutaIngreso = computed(() => this.crear().find((a) => a.key === 'ingreso')?.ruta ?? null);
  readonly rutaSalida = computed(() => this.crear().find((a) => a.key === 'salida')?.ruta ?? null);
  readonly puedeCrearMaterial = computed(() => this.auth.menu()
    .some((g) => (g.opciones ?? []).some((o) => o.codigo === 'ADM_MAT_FUN' && o.implementada)));
  private clave = (f: FilaStock) => `${f.cod_material}|${f.id_bodega}`;
  marcado = (f: FilaStock) => this.seleccion().has(this.clave(f));
  todosMarcados = () => this.visibles().length > 0 && this.visibles().every((f) => this.marcado(f));
  /** Without stock but used in the last year: the most urgent purchases. */
  private esUrgente = (f: FilaStock) => Number(f.stock) <= 0 && Number(f.consumo_diario ?? 0) > 0;
  readonly estadoStock = stockState;
  /** Same quantity the restock order is prefilled with. */
  pedir = (f: FilaStock) => suggestedOrderQty(f.stock, f.stock_minimo, f.consumo_diario);
  cobertura = (f: FilaStock) => coverageDays(f.stock, f.consumo_diario);
  readonly etiquetaCobertura = coverageLabel;
  /** Average weekly use in the last year, e.g. "9,9 UNI/sem". */
  consumoSemana = (f: FilaStock) => {
    const porSemana = Number(f.consumo_diario ?? 0) * 7;
    if (!Number.isFinite(porSemana) || porSemana <= 0) return 'Sin uso';
    const valor = porSemana >= 10 ? Math.round(porSemana) : Math.round(porSemana * 10) / 10;
    return `${valor.toLocaleString('es-CL')} ${f.unidad}/sem`;
  };
  hayConsulta = () => this.soloReponer() || this.bodega() !== 0 || this.buscar().trim().length > 0;
  readonly resumen = computed(() => {
    let sin = 0;
    let bajo = 0;
    let pronto = 0;
    let urgente = 0;
    let valor = 0;
    for (const f of this.datos()) {
      const estado = stockState(f.stock, f.stock_minimo);
      if (estado === 'crit') sin += 1;
      if (estado === 'warn') bajo += 1;
      if (this.sePronto(f)) pronto += 1;
      if (this.esUrgente(f)) urgente += 1;
      valor += Number(f.stock) * Number(f.tarifa || 0);
    }
    return { total: this.datos().length, sin, bajo, pronto, urgente, valor };
  });
  readonly visibles = computed(() => {
    const filtro = this.filtro();
    if (filtro === 'urgente') {
      return this.datos().filter((f) => this.esUrgente(f))
        .sort((a, b) => Number(b.consumo_diario) - Number(a.consumo_diario));
    }
    if (filtro === 'pronto') {
      // Lo que se acaba primero, arriba.
      return this.datos().filter((f) => this.sePronto(f))
        .sort((a, b) => (this.cobertura(a) ?? 0) - (this.cobertura(b) ?? 0));
    }
    const filas = filtro === 'todos' ? this.datos()
      : this.datos().filter((f) => stockState(f.stock, f.stock_minimo) === filtro);
    return sortByStockRisk(filas);
  });
  /** Has stock left and recent consumption ends it within PRONTO_DIAS. */
  private sePronto(f: FilaStock): boolean {
    const dias = this.cobertura(f);
    return dias !== null && dias > 0 && dias <= PRONTO_DIAS;
  }
  /** Suggested quantity times tarifa for the rows picked for the order. */
  readonly estimado = computed(() => this.datos()
    .filter((f) => this.marcado(f))
    .reduce((total, f) => total + this.pedir(f) * Number(f.tarifa || 0), 0));
  /** The backend stops at 500 rows: totals are partial past that. */
  truncado = () => this.resumen().total >= 500;
  listaVacia = () => !this.hayConsulta() || this.datos().length === 0 || this.visibles().length === 0;
  tituloVacio = () => this.hayConsulta() && this.datos().length > 0
    ? 'Nada en este estado' : 'Sin resultados';
  textoVacio = () => {
    if (!this.hayConsulta()) {
      return 'Elige una bodega o busca un material. La lista abre en Urgente: lo que se agotó y se sigue usando.';
    }
    if (!this.datos().length) return 'Prueba otra bodega u otra búsqueda';
    if (this.filtro() === 'urgente') return 'Ningún material sin stock tuvo consumo en el último año';
    return 'Todos los materiales de esta consulta están en orden';
  };
  // El backend corta en 500 filas: con ese tope los totales son parciales y se avisa.
  rango = () => `Mostrando ${this.visibles().length} de ${this.resumen().total} materiales`
    + (this.truncado() ? ' (primeros 500: acota bodega o búsqueda)' : '');

  constructor() {
    void this.cargarBodegas();
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      this.soloReponer.set(q.get('bajo') === '1');
      this.detalleClave.set(q.get('stockDetalle'));
    });
    effect(() => {
      const b = this.bodega(); const q = this.buscar(); const r = this.soloReponer();
      // Sin bodega ni busqueda el listado seria enorme: se pide algo primero.
      if (!b && !q.trim() && !r) { this.datos.set([]); this.errorConsulta.set(''); return; }
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
    this.errorConsulta.set('');
    try {
      const q = new URLSearchParams();
      if (bodega) q.set('bodega', String(bodega));
      if (buscar.trim()) q.set('buscar', buscar.trim());
      if (this.soloReponer()) q.set('bajoMinimo', 'true');
      this.datos.set(
        await firstValueFrom(this.http.get<FilaStock[]>(`${API}/bodega/stock?${q}`)),
      );
      // Urgente leads; with nothing urgent the default view falls back to everything.
      if (!this.filtroElegido) this.filtro.set(this.resumen().urgente > 0 ? 'urgente' : 'todos');
    } catch (e: any) {
      this.datos.set([]);
      this.errorConsulta.set(e?.error?.message ?? 'No se pudo cargar el stock');
    } finally {
      this.cargando.set(false);
    }
  }

  elegirFiltro(filtro: Filtro): void {
    this.filtroElegido = true;
    this.filtro.set(filtro);
  }

  alternar(f: FilaStock): void {
    const next = new Set(this.seleccion());
    const k = this.clave(f);
    if (next.has(k)) next.delete(k); else next.add(k);
    this.seleccion.set(next);
  }

  marcarVisibles(marcar: boolean): void {
    const next = new Set(this.seleccion());
    for (const f of this.visibles()) {
      if (marcar) next.add(this.clave(f)); else next.delete(this.clave(f));
    }
    this.seleccion.set(next);
  }

  /** Opens a new purchase order prefilled with the selected rows; the user reviews and emits it. */
  crearPedido(): void {
    const filas = this.datos().filter((f) => this.marcado(f));
    const centros = Object.fromEntries(this.bodegas().map((b) => [b.bodega, b.ccosto]));
    const orden = ordenDesdeStock(filas, centros);
    if (!orden.lineas.length) {
      this.error.set('Los materiales elegidos ya tienen stock suficiente: no hay nada que pedir');
      return;
    }
    void this.router.navigate(['/oc', 'nueva'], { state: { reposicion: orden } });
  }

  verTodo(): void {
    void this.router.navigate([], { queryParams: { bajo: null }, queryParamsHandling: 'merge' });
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
      this.mensaje.set(`Ajuste registrado. ${f.cod_material} ${f.nombre}: ${r.anterior} → ${r.nuevo}`);
      this.ajustando.set(null);
      await this.cargar(this.bodega(), this.buscar());
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo ajustar');
    } finally {
      this.trabajando.set(false);
    }
  }
}