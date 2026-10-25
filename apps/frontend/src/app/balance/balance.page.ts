/**
 * BALANCE_CCOSTO: donde se va la plata, por centro de costo y por origen.
 *
 * El gasto no sale de una tabla: el backend lo arma como union de cuatro
 * origenes (facturas, rendiciones, vehiculos y consumo de bodega). La pantalla
 * muestra ese desglose a proposito, y deja a la vista que el quinto origen del
 * ERP —costos de personal— no esta, porque el modulo quedo fuera de la replica.
 *
 * Arriba va el panorama de toda la empresa (total contra el año anterior,
 * origenes, meses y los diez centros que mas gastan); abajo, las vistas de
 * siempre (centros, origen, categoria, detalle), filtrables por centro.
 */
import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  IonButton, IonContent, IonInput, IonSelect, IonSelectOption,
} from '@ionic/angular/standalone';

import { API, AuthService } from '../core/auth.service';
import { clp, fechaTabla, rangoLista } from '../shared/format';
import { share } from '../shared/consulta';
import {
  barPercents, buildCsv, isoLocal, monthLabel, monthlySeries, originSegments,
  percentChange, periodPreset, shiftYear, trailingEmptyMonths, valueLabel,
} from './balance-chart';
import { SaList } from '../shared/sa-list.component';
import { SaTableWrap } from '../shared/sa-table-wrap.component';
import { SaPageHead } from '../shared/sa-page-head.component';
import { SaIcon } from '../shared/sa-icon.component';
import { PageHeaderComponent } from '../shared/page-header.component';

interface FilaResumen {
  ccosto: string; proyecto: string; estado: string;
  presupuesto: string; presupuesto_neto: string;
  responsable: string; gasto: string; movimientos: number;
}
interface Resumen {
  desde: string; hasta: string;
  origenes: string[]; origenesFuera: string[];
  filas: FilaResumen[];
}
interface Origen { origen: string; total: string; movimientos: number; excluido?: boolean; }
interface Categoria { ccosto_ap: string; glosa: string; total: string; movimientos: number; }
interface Movimiento {
  origen: string; fecha: string; numdoc: string; tipo_doc: string;
  total: number; ccosto: string; ccosto_ap: string; glosa: string; nombre: string;
}
interface CentroCosto { ccosto: string; proyecto: string; }
interface Mes { mes: string; total: number; }

type Periodo = 'ytd' | '12m' | 'fechas';
type Vista = 'ccosto' | 'origen' | 'categoria' | 'detalle';

const GLOSA_ORIGEN: Record<string, string> = {
  RECIBIDOS: 'Facturas de proveedor',
  RIN_GASTO: 'Rendiciones de gastos',
  MOV_BODEGA: 'Vehículos y equipos',
  INV_BODEGA: 'Consumo de bodega',
  RRHH: 'Costos de personal — módulo fuera de la réplica',
};

/** Sequential purples from the Finanzas hue: darkest for the largest origin. */
const TONOS = [
  'color-mix(in srgb, var(--sa-area-finanzas) 70%, var(--sa-ink))',
  'var(--sa-area-finanzas)',
  'color-mix(in srgb, var(--sa-area-finanzas) 50%, var(--sa-surface))',
  'color-mix(in srgb, var(--sa-area-finanzas) 22%, var(--sa-surface))',
];

/** Spend of the period across every origin the replica holds (RRHH excluded). */
const sumaOrigenes = (lista: { total: unknown; excluido?: boolean }[]) =>
  lista.filter((o) => !o.excluido).reduce((s, o) => s + Number(o.total || 0), 0);

@Component({
  selector: 'app-balance',
  imports: [
    FormsModule, RouterLink, PageHeaderComponent, SaPageHead, SaIcon, IonContent, IonButton,
    IonSelect, IonSelectOption, IonInput, SaList, SaTableWrap,
  ],
  styles: [`
    :host { --plot: 150px; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    h2 { margin: 0; font-size: var(--sa-text-title); font-weight: 700; }
    .periodo { display: flex; flex-wrap: wrap; align-items: end; gap: var(--sa-space-3); margin-bottom: var(--sa-space-4); }
    .periodo .sa-chip { min-height: 44px; }
    .periodo ion-input { max-width: 11rem; }
    .grid2 { display: grid; gap: var(--sa-space-4); margin-bottom: var(--sa-space-4);
             grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); align-items: start; }
    .pad { padding: 20px 22px; }
    .hero__label { font-size: var(--sa-text-body); font-weight: 600; color: var(--sa-ink-soft); }
    .hero__value { font-size: 46px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; margin-top: 6px; }
    .hero__cmp { display: flex; align-items: center; gap: var(--sa-space-2); flex-wrap: wrap;
                 margin-top: 10px; font-size: var(--sa-text-body); color: var(--sa-ink-soft); }
    .hero__cmp .sa-badge { color: var(--sa-ink); background: var(--sa-line); font-size: var(--sa-text-dense); }
    .nota-maestro { margin: var(--sa-space-3) 0 0; font-size: var(--sa-text-dense); color: var(--sa-ink-soft); }
    .hero__facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sa-space-3);
                   margin-top: 18px; padding-top: var(--sa-space-4); border-top: var(--sa-border) solid var(--sa-line); }
    .fact__n { font-size: 20px; font-weight: 700; }
    .fact__t { font-size: var(--sa-text-body); color: var(--sa-ink-soft); }
    .stack { display: flex; height: 22px; gap: 2px; border-radius: 6px; overflow: hidden; margin: var(--sa-space-4) 0 14px; }
    .stack > i { display: block; min-width: 2px; }
    .legend { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px var(--sa-space-4);
              font-size: var(--sa-text-body); margin: 0; padding: 0; list-style: none; }
    .legend li { display: flex; gap: var(--sa-space-2); }
    .sw { inline-size: 12px; block-size: 12px; border-radius: 3px; margin-top: 4px; flex: none;
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sa-area-finanzas) 30%, transparent); }
    .muted { color: var(--sa-ink-soft); }
    .flush { margin: 0; }
    .gap-b { margin-bottom: var(--sa-space-4); }
    .note { margin: 14px 0 0; font-size: var(--sa-text-dense); color: var(--sa-ink-soft); line-height: 1.5; }
    .head-row { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sa-space-3); flex-wrap: wrap; }
    .head-row span { font-size: var(--sa-text-dense); color: var(--sa-ink-soft); }
    .meses-scroll { overflow-x: auto; margin-top: 18px; }
    .meses { min-inline-size: 520px; display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 10px; }
    .mes { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px;
           block-size: calc(var(--plot) + 24px); border-bottom: var(--sa-border) solid var(--sa-border-input); }
    .mes__v { font-size: var(--sa-text-meta); color: var(--sa-ink-soft); white-space: nowrap; }
    .mes__bar { inline-size: 100%; max-inline-size: 44px; border-radius: 4px 4px 0 0; background: var(--sa-line-strong); }
    .mes__bar.on { background: var(--sa-area-finanzas); }
    .mes__m { text-align: center; font-size: var(--sa-text-meta); color: var(--sa-ink-soft); margin-top: var(--sa-space-2); }
    .top-head { padding: 18px var(--sa-space-4) 12px; }
    .cc { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) auto 3.5rem; align-items: center;
          gap: var(--sa-space-3); inline-size: 100%; min-block-size: 52px; padding: 10px var(--sa-space-4);
          border: 0; border-top: var(--sa-border) solid var(--sa-line); background: transparent;
          font: inherit; font-size: var(--sa-text-body); color: var(--sa-ink); text-align: left; cursor: pointer; }
    .cc:hover { background: color-mix(in srgb, var(--sa-area-finanzas-tint) 50%, var(--sa-surface)); }
    .cc[aria-pressed="true"] { background: var(--sa-area-finanzas-tint); }
    .cc:last-child { border-radius: 0 0 12px 12px; }
    .cc__name { min-inline-size: 0; }
    .cc__name strong { display: block; font-size: var(--sa-text-dense); }
    .cc__name span { display: block; font-size: var(--sa-text-meta); color: var(--sa-ink-soft);
                     white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .track { block-size: 8px; border-radius: 999px; background: var(--sa-line); overflow: hidden; }
    .track > i { display: block; block-size: 100%; background: var(--sa-area-finanzas); border-radius: 999px; }
    .cc__amt { text-align: right; font-weight: 600; }
    .cc__pct { text-align: right; color: var(--sa-ink-soft); }
    @media (max-width: 767.98px) {
      .cc { grid-template-columns: minmax(0, 1fr) auto; }
      .cc__name { grid-column: 1 / -1; }
      .cc__pct { display: none; }
      .hero__value { font-size: 36px; }
    }
    .det__cc { margin: 0 0 2px; font-size: 20px; }
    .det__kind { font-size: var(--sa-text-dense); font-weight: 600; color: var(--sa-area-finanzas); }
    .det__facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 18px 0;
                  padding: var(--sa-space-4) 0; border-block: var(--sa-border) solid var(--sa-line); }
    .det__facts .fact__n { font-size: 24px; }
    .det__facts .fact__t { font-size: var(--sa-text-dense); }
    .tabs-wrap { scroll-margin-top: var(--sa-space-4); }
    .tabs { margin: var(--sa-space-6) 0 var(--sa-space-3); }
    .tabs .sa-chip { min-height: 44px; }
    .excluido { opacity: .6; font-style: italic; }
    .filtro { display: flex; align-items: center; gap: var(--sa-space-2); flex-wrap: wrap; }
  `],
  template: `
    <app-page-header title="Balance"></app-page-header>

    <ion-content>
      <div class="page-content page-content--wide">
      <sa-page-head title="Balance" area="finanzas" icon="chart"
                    subtitle="Dónde se va la plata, por centro de costo y por origen.">
        <div saActions>
          <ion-button fill="outline" (click)="exportar()" [disabled]="!puedeExportar()">
            <sa-icon name="download" [size]="18" slot="start" />Exportar CSV
          </ion-button>
          @if (puedeDistribuir() && pendientes() > 0) {
            <ion-button color="finanzas" routerLink="/f/DOC_DISTRIBUIR" [queryParams]="{ estado: 'ACEPTADO' }">
              Distribuir {{ pendientes().toLocaleString('es-CL') }} facturas pendientes
            </ion-button>
          }
        </div>
      </sa-page-head>

      @if (error()) { <div class="sa-notice sa-notice--crit">{{ error() }}</div> }

      <div class="periodo">
        <div class="sa-chips" role="group" aria-label="Período">
          <button type="button" class="sa-chip" [attr.aria-pressed]="periodo() === 'ytd'"
                  (click)="elegirPeriodo('ytd')">{{ etiquetaYtd() }}</button>
          <button type="button" class="sa-chip" [attr.aria-pressed]="periodo() === '12m'"
                  (click)="elegirPeriodo('12m')">Últimos 12 meses</button>
          <button type="button" class="sa-chip" [attr.aria-pressed]="periodo() === 'fechas'"
                  (click)="periodo.set('fechas')">Elegir fechas</button>
        </div>
        @if (periodo() === 'fechas') {
          <ion-input label="Desde" labelPlacement="stacked" fill="outline" type="date"
                     [value]="desde()" (ionChange)="fijarFecha('desde', $any($event).detail.value)"></ion-input>
          <ion-input label="Hasta" labelPlacement="stacked" fill="outline" type="date"
                     [value]="hasta()" (ionChange)="fijarFecha('hasta', $any($event).detail.value)"></ion-input>
        }
      </div>

      <div class="grid2">
        <section class="sa-panel pad" aria-label="Gasto del período">
          <div class="hero__label">Gasto del período</div>
          <div class="hero__value num" [attr.title]="moneda(totalGasto())">
            {{ cargandoPanorama() ? '…' : millones(totalGasto()) }}
          </div>
          <div class="hero__cmp">
            @if (cambio() != null && !cargandoAnterior()) {
              <span class="sa-badge num">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  @if (cambio()! < 0) { <path d="M12 5v14" /><path d="m19 12-7 7-7-7" /> }
                  @else { <path d="M12 19V5" /><path d="m5 12 7-7 7 7" /> }
                </svg>
                <span class="sr">{{ cambio()! < 0 ? 'Baja de' : 'Alza de' }}</span>
                {{ porcentaje(cambio()!) }}
              </span>
              <span>{{ cambio()! < 0 ? 'menos' : 'más' }} que el mismo período un año antes ({{ millones(totalAnterior()) }})</span>
            } @else if (!cargandoPanorama() && !cargandoAnterior()) {
              <span>Sin gasto registrado en el mismo período un año antes, así que no hay comparación.</span>
            }
          </div>
          <div class="hero__facts">
            <div><div class="fact__n num">{{ conGasto().toLocaleString('es-CL') }}</div>
                 <div class="fact__t">centros con gasto, de {{ filasOrdenadas().length.toLocaleString('es-CL') }}</div></div>
            <div><div class="fact__n num">{{ documentos().toLocaleString('es-CL') }}</div>
                 <div class="fact__t">documentos que suman gasto</div></div>
          </div>
          @if (sinMaestro() > 0) {
            <p class="nota-maestro">Incluye {{ millones(sinMaestro()) }} cargados a centros de costo que no están en el maestro, por eso no aparecen en la lista de centros.</p>
          }
        </section>

        <section class="sa-panel pad" aria-labelledby="h-origen">
          <h2 id="h-origen">De dónde sale el gasto</h2>
          @if (segmentos().length) {
            <div class="stack" role="img" [attr.aria-label]="ariaOrigen()">
              @for (s of segmentos(); track s.origen; let i = $index) {
                <i [style.flex]="s.share" [style.background]="tono(i)"></i>
              }
            </div>
            <ul class="legend">
              @for (s of segmentos(); track s.origen; let i = $index) {
                <li>
                  <span class="sw" [style.background]="tono(i)" aria-hidden="true"></span>
                  <span>{{ glosaOrigen(s.origen) }}<br>
                    <strong class="num">{{ porcentaje(s.share) }}</strong>
                    <span class="num muted"> {{ millones(s.total) }}</span></span>
                </li>
              }
            </ul>
          } @else if (!cargandoPanorama()) {
            <p class="note">Sin gasto en el período.</p>
          }
          <p class="note">Costos de personal no aparecen: ese módulo no está en la réplica, no es un error de cálculo.</p>
        </section>
      </div>

      <section class="sa-panel pad gap-b" aria-labelledby="h-meses">
        <div class="head-row">
          <h2 id="h-meses">Gasto por mes</h2>
          <span>Millones de pesos · en color los meses del período{{ notaMeses() }}</span>
        </div>
        <div class="meses-scroll" tabindex="0" role="region" aria-label="Gasto por mes, últimos 12 meses">
          <div class="meses" role="list">
            @for (m of meses(); track m.mes; let i = $index) {
              <div role="listitem">
                <div class="mes" [attr.title]="nombreMes(m.mes) + ': ' + moneda(m.total)">
                  <span class="mes__v num" aria-hidden="true">{{ etiquetaValor(m.total) }}</span>
                  <div class="mes__bar" [class.on]="m.enRango"
                       [style.height.px]="altoMes(i)"></div>
                </div>
                <div class="mes__m" aria-hidden="true">{{ mesCorto(m.mes) }}</div>
                <span class="sr">{{ nombreMes(m.mes) }}: {{ moneda(m.total) }}{{ m.enRango ? '' : ', fuera del período' }}</span>
              </div>
            }
          </div>
        </div>
      </section>

      <div class="grid2">
        <section class="sa-panel" aria-labelledby="h-top">
          <div class="head-row top-head">
            <h2 id="h-top">Los 10 centros que más gastan</h2>
            <span>Toca uno para ver su detalle</span>
          </div>
          @for (c of top(); track c.ccosto; let i = $index) {
            <button type="button" class="cc" [attr.aria-pressed]="seleccion()?.ccosto === c.ccosto"
                    (click)="centroSel.set(c.ccosto)">
              <span class="cc__name"><strong>{{ c.ccosto }}</strong><span>{{ c.proyecto }}</span></span>
              <span class="track" aria-hidden="true"><i [style.width.%]="anchosTop()[i]"></i></span>
              <span class="cc__amt num">{{ millones(c.gasto) }}</span>
              <span class="cc__pct num">{{ porcentaje(parte(c.gasto)) }}</span>
            </button>
          } @empty {
            @if (!cargandoPanorama()) { <p class="note pad">Sin gasto en el período.</p> }
          }
        </section>

        <aside class="sa-panel pad" aria-label="Detalle del centro">
          @if (seleccion(); as s) {
            <div class="det__kind">Centro de costo</div>
            <h2 class="det__cc">{{ s.ccosto }}</h2>
            <p class="muted flush">{{ s.proyecto }}@if (s.responsable) { · {{ s.responsable }} }</p>
            <div class="det__facts">
              <div><div class="fact__n num">{{ millones(s.gasto) }}</div><div class="fact__t">gastado en el período</div></div>
              <div><div class="fact__n num">{{ porcentaje(parte(s.gasto)) }}</div><div class="fact__t">del gasto total</div></div>
              <div><div class="fact__n num">{{ (+s.movimientos).toLocaleString('es-CL') }}</div><div class="fact__t">movimientos</div></div>
              <div><div class="fact__n num">{{ moneda(promedio(s)) }}</div><div class="fact__t">promedio por documento</div></div>
            </div>
            <ion-button fill="outline" (click)="verCentro(s.ccosto)">Ver detalle de este centro</ion-button>
          } @else {
            <p class="muted flush">Elige un centro de la lista para ver su detalle.</p>
          }
          <p class="note">El presupuesto viene anonimizado en la réplica, por eso no se compara gasto contra presupuesto.</p>
        </aside>
      </div>

      <div class="tabs-wrap" #tabs>
        <div class="sa-chips tabs" role="group" aria-label="Vista del balance">
          <button type="button" class="sa-chip" [attr.aria-pressed]="vista() === 'ccosto'"
                  (click)="vista.set('ccosto')">Todos los centros</button>
          <button type="button" class="sa-chip" [attr.aria-pressed]="vista() === 'origen'"
                  (click)="vista.set('origen')">Por origen</button>
          <button type="button" class="sa-chip" [attr.aria-pressed]="vista() === 'categoria'"
                  (click)="vista.set('categoria')">Por categoría</button>
          <button type="button" class="sa-chip" [attr.aria-pressed]="vista() === 'detalle'"
                  (click)="vista.set('detalle')">Detalle</button>
        </div>

        <sa-list [loading]="vista() === 'ccosto' ? cargandoPanorama() : cargando()" [empty]="false"
                 [foot]="vista() === 'detalle' && detalle().length > 0"
                 [range]="rango()" [page]="pagina()" [pages]="paginas()" (pageChange)="pagina.set($event)">
          <div saFilters class="filtro">
            <ion-select label="Centro de costo" labelPlacement="stacked" fill="outline" interface="popover"
                        [value]="ccosto()" (ionChange)="ccosto.set($any($event).detail.value)">
              <ion-select-option value="">Todos</ion-select-option>
              @for (c of centros(); track c.ccosto) {
                <ion-select-option [value]="c.ccosto">{{ c.ccosto }} - {{ c.proyecto }}</ion-select-option>
              }
            </ion-select>
            @if (ccosto()) {
              <ion-button fill="clear" (click)="ccosto.set('')">Quitar filtro</ion-button>
            }
          </div>

          @switch (vista()) {
            @case ('ccosto') {
              @if (!filasVista().length) {
                <div class="sa-empty"><div class="title">Sin movimientos en el período</div></div>
              } @else {
                <sa-table-wrap label="Balance por centro de costo">
                  <table class="sa-table">
                    <thead><tr>
                      <th>Centro de costo</th><th>Proyecto</th><th>Responsable</th>
                      <th class="num">Gasto</th><th>Del total</th><th class="num">Movs.</th>
                    </tr></thead>
                    <tbody>
                      @for (f of filasVista(); track f.ccosto) {
                        <tr class="is-click" tabindex="0" [class.is-selected]="ccosto() === f.ccosto"
                            (click)="ccosto.set(f.ccosto)" (keydown.enter)="ccosto.set(f.ccosto)">
                          <th scope="row">{{ f.ccosto }}</th>
                          <td data-label="Proyecto">{{ f.proyecto }}</td>
                          <td data-label="Responsable">{{ f.responsable }}</td>
                          <td class="num" data-label="Gasto">{{ moneda(f.gasto) }}</td>
                          <td data-label="Del total">
                            <span class="sa-share">
                              <span class="sa-share__track"><i [style.width.%]="parte(f.gasto)"></i></span>
                              <span class="num">{{ parte(f.gasto) }}%</span>
                            </span>
                          </td>
                          <td class="num" data-label="Movs.">{{ f.movimientos }}</td>
                        </tr>
                      }
                    </tbody>
                    <tfoot><tr>
                      <td colspan="3">Total</td>
                      <td class="num">{{ moneda(totalVista()) }}</td>
                      <td></td><td></td>
                    </tr></tfoot>
                  </table>
                </sa-table-wrap>
              }
            }

            @case ('origen') {
              <sa-table-wrap label="Balance por origen">
                <table class="sa-table">
                  <thead><tr>
                    <th>Origen</th><th>Qué agrupa</th>
                    <th class="num">Total</th><th class="num">Movimientos</th>
                  </tr></thead>
                  <tbody>
                    @for (o of origenes(); track o.origen) {
                      <tr [class.excluido]="o.excluido">
                        <th scope="row">{{ o.origen }}</th>
                        <td data-label="Qué agrupa">{{ glosaOrigen(o.origen) }}</td>
                        <td class="num" data-label="Total">{{ moneda(o.total) }}</td>
                        <td class="num" data-label="Movimientos">{{ o.movimientos }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </sa-table-wrap>
              <p class="note">
                El ERP suma cinco orígenes. RRHH (costos de personal) aparece en cero porque el módulo
                de Personal quedó fuera de la réplica: su tabla <code>rrhh_costos</code> no se migró.
              </p>
            }

            @case ('categoria') {
              @if (!categorias().length) {
                <div class="sa-empty"><div class="title">Sin movimientos en el período</div></div>
              } @else {
                <sa-table-wrap label="Balance por categoría">
                  <table class="sa-table">
                    <thead><tr>
                      <th>Cuenta</th><th>Glosa</th>
                      <th class="num">Total</th><th class="num">Movimientos</th>
                    </tr></thead>
                    <tbody>
                      @for (c of categorias(); track c.ccosto_ap) {
                        <tr>
                          <th scope="row">{{ c.ccosto_ap }}</th>
                          <td class="name" data-label="Glosa">{{ c.glosa }}</td>
                          <td class="num" data-label="Total">{{ moneda(c.total) }}</td>
                          <td class="num" data-label="Movimientos">{{ c.movimientos }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </sa-table-wrap>
              }
            }

            @case ('detalle') {
              @if (!detalle().length) {
                <div class="sa-empty"><div class="title">Sin movimientos en el período</div></div>
              } @else {
                <sa-table-wrap label="Detalle del balance">
                  <table class="sa-table">
                    <thead><tr>
                      <th>Fecha</th><th>Origen</th><th>Doc</th><th>N°</th>
                      <th>Centro costo</th><th>Cuenta</th><th>Glosa</th>
                      <th>Tercero</th><th class="num">Total</th>
                    </tr></thead>
                    <tbody>
                      @for (m of detalle(); track $index) {
                        <tr>
                          <th scope="row">{{ fecha(m.fecha) }}</th>
                          <td data-label="Origen">{{ m.origen }}</td>
                          <td data-label="Doc">{{ m.tipo_doc }}</td>
                          <td data-label="N°">{{ m.numdoc }}</td>
                          <td data-label="Centro costo">{{ m.ccosto }}</td>
                          <td data-label="Cuenta">{{ m.ccosto_ap }}</td>
                          <td class="name" data-label="Glosa">{{ m.glosa }}</td>
                          <td data-label="Tercero">{{ m.nombre }}</td>
                          <td class="num" data-label="Total">{{ moneda(m.total) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </sa-table-wrap>
              }
            }
          }
        </sa-list>
      </div>
      </div>
    </ion-content>
  `,
})
export class BalancePage {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly tabsRef = viewChild<ElementRef<HTMLElement>>('tabs');

  readonly periodo = signal<Periodo>('ytd');
  readonly desde = signal(periodPreset('ytd').desde);
  readonly hasta = signal(periodPreset('ytd').hasta);

  readonly ccosto = signal('');
  readonly vista = signal<Vista>('ccosto');
  readonly pagina = signal(1);
  readonly cargando = signal(false);
  readonly cargandoPanorama = signal(false);
  readonly cargandoAnterior = signal(false);
  readonly error = signal('');

  readonly centros = signal<CentroCosto[]>([]);
  readonly resumen = signal<Resumen | null>(null);
  readonly totalAnterior = signal<number | null>(null);
  readonly origenesTodos = signal<Origen[]>([]);
  readonly mensual = signal<Mes[]>([]);
  readonly origenes = signal<Origen[]>([]);
  readonly categorias = signal<Categoria[]>([]);
  readonly detalle = signal<Movimiento[]>([]);
  readonly totalDetalle = signal(0);
  readonly paginas = signal(1);
  readonly pendientes = signal(0);
  readonly centroSel = signal('');

  readonly moneda = clp;
  readonly fecha = fechaTabla;
  readonly etiquetaValor = valueLabel;
  readonly mesCorto = monthLabel;
  rango = () => rangoLista(this.pagina(), this.detalle().length, this.totalDetalle(), 'movimientos', 100);

  readonly puedeDistribuir = computed(() =>
    (this.auth.sesion()?.permisos ?? []).includes('DOC_DISTRIBUIR'));

  readonly filasOrdenadas = computed(() =>
    [...(this.resumen()?.filas ?? [])].sort((a, b) => Number(b.gasto) - Number(a.gasto)));
  /** Gasto total = the same union as origins and months, so every figure on the page adds up. */
  readonly totalGasto = computed(() => sumaOrigenes(this.origenesTodos()));
  /** Spend charged to cost-center codes that are missing from the centro_costo master. */
  readonly sinMaestro = computed(() =>
    Math.max(0, this.totalGasto() - this.filasOrdenadas().reduce((s, f) => s + Number(f.gasto), 0)));
  readonly conGasto = computed(() => this.filasOrdenadas().filter((f) => Number(f.gasto) > 0).length);
  readonly documentos = computed(() =>
    this.origenesTodos().filter((o) => !o.excluido).reduce((s, o) => s + Number(o.movimientos || 0), 0));
  readonly cambio = computed(() => percentChange(this.totalGasto(), this.totalAnterior()));

  readonly segmentos = computed(() => originSegments(this.origenesTodos()));
  readonly ariaOrigen = computed(() => this.segmentos()
    .map((s) => `${this.glosaOrigen(s.origen)} ${this.porcentaje(s.share)}`).join(', '));

  readonly meses = computed(() => monthlySeries(this.mensual(), this.desde(), this.hasta(), 12));
  readonly alturas = computed(() => barPercents(this.meses().map((m) => m.total)));
  readonly notaMeses = computed(() => {
    const vacios = trailingEmptyMonths(this.meses().filter((m) => m.enRango));
    if (!vacios || vacios === this.meses().filter((m) => m.enRango).length) return '';
    const s = this.meses();
    return ` · sin registros desde ${this.nombreMes(s[s.length - vacios].mes)}`;
  });

  readonly top = computed(() => this.filasOrdenadas().filter((f) => Number(f.gasto) > 0).slice(0, 10));
  readonly anchosTop = computed(() => barPercents(this.top().map((f) => Number(f.gasto))));
  readonly seleccion = computed(() => {
    const filas = this.filasOrdenadas();
    return filas.find((f) => f.ccosto === this.centroSel()) ?? this.top()[0] ?? null;
  });

  readonly filasVista = computed(() => {
    const c = this.ccosto();
    return c ? this.filasOrdenadas().filter((f) => f.ccosto === c) : this.filasOrdenadas();
  });
  readonly totalVista = computed(() => this.filasVista().reduce((s, f) => s + Number(f.gasto), 0));

  readonly puedeExportar = computed(() => {
    switch (this.vista()) {
      case 'ccosto': return this.filasVista().length > 0;
      case 'origen': return this.origenes().length > 0;
      case 'categoria': return this.categorias().length > 0;
      default: return this.detalle().length > 0;
    }
  });

  readonly etiquetaYtd = computed(() => {
    const hoy = periodPreset('ytd').hasta;
    const fin = monthLabel(hoy.slice(0, 7));
    return fin === 'ene' ? `Enero ${hoy.slice(0, 4)}` : `Ene–${fin} ${hoy.slice(0, 4)}`;
  });

  parte = (gasto: unknown) => share(Number(gasto), this.totalGasto());
  tono = (i: number) => TONOS[Math.min(i, TONOS.length - 1)];
  altoMes = (i: number) => {
    const p = this.alturas()[i] ?? 0;
    return p > 0 ? Math.max(3, p * 1.5) : 1;
  };
  porcentaje = (n: number) =>
    `${Math.abs(n).toLocaleString('es-CL', { maximumFractionDigits: 1 })} %`;
  millones = (n: unknown) => {
    const v = Number(n ?? 0);
    return Math.abs(v) >= 1e6 ? `$${valueLabel(v)} M` : clp(v);
  };
  nombreMes = (mes: string) => `${monthLabel(mes)} ${mes.slice(0, 4)}`;
  promedio = (f: FilaResumen) => (Number(f.movimientos) ? Number(f.gasto) / Number(f.movimientos) : 0);

  glosaOrigen(o: string): string {
    return GLOSA_ORIGEN[o] ?? o;
  }

  private ultimo = '';
  private turnoPanorama = 0;
  private turnoVista = 0;

  constructor() {
    void this.cargarCentros();
    void this.cargarPendientes();
    effect(() => {
      void this.cargarPanorama(this.desde(), this.hasta());
    });
    effect(() => {
      const v = this.vista(); const c = this.ccosto(); const p = this.pagina();
      const d = this.desde(); const h = this.hasta();
      const clave = `${v}|${c}|${d}|${h}`;
      const pg = clave !== this.ultimo && v === 'detalle' ? 1 : p;
      this.ultimo = clave;
      void this.cargar(v, c, pg, d, h);
    });
  }

  elegirPeriodo(p: 'ytd' | '12m'): void {
    const r = periodPreset(p);
    this.periodo.set(p);
    this.desde.set(r.desde);
    this.hasta.set(r.hasta);
  }

  fijarFecha(campo: 'desde' | 'hasta', valor: string | null | undefined): void {
    const v = String(valor ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    (campo === 'desde' ? this.desde : this.hasta).set(v);
  }

  verCentro(ccosto: string): void {
    this.ccosto.set(ccosto);
    this.vista.set('detalle');
    this.tabsRef()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Descarga la vista actual como CSV que Excel abre con acentos y columnas. */
  exportar(): void {
    const r = (n: unknown) => Math.round(Number(n ?? 0));
    let columnas: string[];
    let filas: unknown[][];
    switch (this.vista()) {
      case 'ccosto':
        columnas = ['Centro de costo', 'Proyecto', 'Responsable', 'Gasto', 'Movimientos'];
        filas = this.filasVista().map((f) => [f.ccosto, f.proyecto, f.responsable, r(f.gasto), f.movimientos]);
        break;
      case 'origen':
        columnas = ['Origen', 'Qué agrupa', 'Total', 'Movimientos'];
        filas = this.origenes().map((o) => [o.origen, this.glosaOrigen(o.origen), r(o.total), o.movimientos]);
        break;
      case 'categoria':
        columnas = ['Cuenta', 'Glosa', 'Total', 'Movimientos'];
        filas = this.categorias().map((c) => [c.ccosto_ap, c.glosa, r(c.total), c.movimientos]);
        break;
      default:
        columnas = ['Fecha', 'Origen', 'Doc', 'N°', 'Centro de costo', 'Cuenta', 'Glosa', 'Tercero', 'Total'];
        filas = this.detalle().map((m) => [
          this.fecha(m.fecha), m.origen, m.tipo_doc, m.numdoc, m.ccosto, m.ccosto_ap, m.glosa, m.nombre, r(m.total),
        ]);
    }
    const blob = new Blob([buildCsv(columnas, filas)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const centro = this.ccosto() ? `-${this.ccosto().replace(/\s+/g, '_')}` : '';
    a.href = url;
    a.download = `balance-${this.vista()}${centro}-${this.desde()}-${this.hasta()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  private params(ccosto: string, desde: string, hasta: string): string {
    const q = new URLSearchParams({ fini: desde, ffin: hasta });
    if (ccosto) q.set('ccosto', ccosto);
    return q.toString();
  }

  private async cargarCentros(): Promise<void> {
    try {
      this.centros.set(
        await firstValueFrom(this.http.get<CentroCosto[]>(`${API}/balance/ccostos`)),
      );
    } catch { this.centros.set([]); }
  }

  private async cargarPendientes(): Promise<void> {
    if (!this.puedeDistribuir()) return;
    try {
      const r = await firstValueFrom(this.http.get<{ total: number }>(
        `${API}/distribucion?estado=ACEPTADO&pagina=1&limite=1`));
      this.pendientes.set(r.total ?? 0);
    } catch { /* el atajo es accesorio */ }
  }

  /** Panorama de la empresa: resumen actual y del año anterior, origenes y meses. */
  private async cargarPanorama(desde: string, hasta: string): Promise<void> {
    const turno = ++this.turnoPanorama;
    this.cargandoPanorama.set(true);
    this.error.set('');
    const [y, m] = hasta.split('-').map(Number);
    const inicioMeses = isoLocal(new Date(y, m - 12, 1));
    this.cargandoAnterior.set(true);
    try {
      const [actual, origenes, mensual] = await Promise.all([
        firstValueFrom(this.http.get<Resumen>(`${API}/balance/resumen?${this.params('', desde, hasta)}`)),
        firstValueFrom(this.http.get<Origen[]>(`${API}/balance/origenes?${this.params('', desde, hasta)}`)),
        firstValueFrom(this.http.get<Mes[]>(`${API}/balance/mensual?${this.params('', inicioMeses, hasta)}`))
          .catch(() => [] as Mes[]),
      ]);
      if (turno !== this.turnoPanorama) return;
      this.resumen.set(actual);
      this.origenesTodos.set(origenes);
      this.mensual.set(mensual);
    } catch (e: any) {
      if (turno === this.turnoPanorama) this.error.set(e?.error?.message ?? 'No se pudo cargar el balance');
    } finally {
      if (turno === this.turnoPanorama) this.cargandoPanorama.set(false);
    }
    // La comparacion llega despues: no retrasa el resto del panorama.
    try {
      const previo = await firstValueFrom(this.http.get<Origen[]>(
        `${API}/balance/origenes?${this.params('', shiftYear(desde, -1), shiftYear(hasta, -1))}`));
      if (turno !== this.turnoPanorama) return;
      this.totalAnterior.set(sumaOrigenes(previo));
    } catch {
      if (turno === this.turnoPanorama) this.totalAnterior.set(null);
    } finally {
      if (turno === this.turnoPanorama) this.cargandoAnterior.set(false);
    }
  }

  private async cargar(vista: Vista, ccosto: string, pagina: number, desde: string, hasta: string): Promise<void> {
    if (vista === 'ccosto') return; // usa el resumen del panorama
    const turno = ++this.turnoVista;
    this.cargando.set(true);
    try {
      const p = this.params(ccosto, desde, hasta);
      if (vista === 'origen') {
        const r = await firstValueFrom(this.http.get<Origen[]>(`${API}/balance/origenes?${p}`));
        if (turno === this.turnoVista) this.origenes.set(r);
      } else if (vista === 'categoria') {
        const r = await firstValueFrom(this.http.get<Categoria[]>(`${API}/balance/categorias?${p}`));
        if (turno === this.turnoVista) this.categorias.set(r);
      } else {
        const r = await firstValueFrom(this.http.get<{
          datos: Movimiento[]; total: number; paginas: number;
        }>(`${API}/balance/detalle?${p}&pagina=${pagina}&limite=100`));
        if (turno !== this.turnoVista) return;
        this.detalle.set(r.datos);
        this.totalDetalle.set(r.total);
        this.paginas.set(r.paginas);
      }
    } catch (e: any) {
      if (turno === this.turnoVista) this.error.set(e?.error?.message ?? 'No se pudo cargar el balance');
    } finally {
      if (turno === this.turnoVista) this.cargando.set(false);
    }
  }
}
