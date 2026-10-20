/**
 * Detalle de una OC: lineas, HES emitidas y acciones.
 *
 * La emision de HES calcula el avance como lo hace el ERP: por linea es el
 * porcentaje recibido, y el monto es proporcional al total de esa linea. El
 * avance del encabezado NO se calcula aca; lo devuelve el backend, ponderado
 * por plata.
 *
 * Con id = "nueva" el mismo componente sirve para emitir una OC.
 * Con ?recibir=1 (desde "Recibir (HES)" del listado) abre la recepcion.
 */
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import {
  AlertController, IonButton, IonContent, IonInput, IonSkeletonText,
} from '@ionic/angular/standalone';

import { API, AuthService } from '../core/auth.service';
import { clp, confirmar, estadoOc, fechaTabla, Oc } from './ordenes.page';
import { PageHeaderComponent } from '../shared/page-header.component';
import { SaIcon } from '../shared/sa-icon.component';
import { SaKpis, type SaKpiItem } from '../shared/sa-kpis.component';
import { SaPageHead } from '../shared/sa-page-head.component';
import { SaTableWrap } from '../shared/sa-table-wrap.component';

interface Linea {
  id: number; producto: number; nombre: string; descripcion: string;
  cantidad: number; unidad: string; precio_uni: number; descto: number;
  total: number; OC_avance: string; ccosto: string; ccosto_ap: string;
}
interface OcDetalle extends Oc { detalle: Linea[]; tipo_cambio: number; }
interface Hes {
  id: number; numdoc: number; fecha: string; estado: string;
  neto: number; total: number; OC_avance: string; obs: string; usuario: string;
}
interface LineaNueva { nombre: string; cantidad: number; unidad: string; precio_uni: number; }

/** IVA shown in the summary of a new order; the backend applies its own configured rate. */
const IVA = 0.19;

const lineaVacia = (): LineaNueva => ({ nombre: '', cantidad: 0, unidad: 'UNI', precio_uni: 0 });

@Component({
  selector: 'app-orden',
  imports: [
    FormsModule, RouterLink, PageHeaderComponent, IonContent,
    IonButton, IonSkeletonText, IonInput, SaIcon, SaKpis, SaPageHead, SaTableWrap,
  ],
  styles: [`
    .volver { display: inline-flex; align-items: center; gap: var(--sa-space-2);
      min-block-size: 44px; margin-bottom: var(--sa-space-1);
      color: var(--sa-area); font-size: var(--sa-text-dense); font-weight: 600; text-decoration: none; }
    .volver:hover { text-decoration: underline; }
    .volver:focus-visible, .step:focus-visible, .quitar:focus-visible {
      outline: var(--sa-focus-ring); outline-offset: var(--sa-focus-offset);
    }

    .oculto { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden;
      clip: rect(0 0 0 0); white-space: nowrap; }

    /* Detalle */
    .ficha { padding: var(--sa-space-4) var(--sa-space-5); margin-bottom: var(--sa-space-4); }
    .ficha__meta { display: grid; gap: var(--sa-space-3) var(--sa-space-5); margin: 0;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr)); }
    .ficha__meta div { display: flex; flex-direction: column; gap: var(--sa-space-1); }
    .ficha__meta dt { font-size: var(--sa-text-meta); color: var(--sa-ink-soft); }
    .ficha__meta dd { margin: 0; font-size: var(--sa-text-dense); }
    .obs { margin-top: var(--sa-space-3); padding-top: var(--sa-space-3);
      border-top: var(--sa-border) solid var(--sa-line); font-size: var(--sa-text-dense); }
    .obs strong { display: block; margin-bottom: var(--sa-space-1);
      font-size: var(--sa-text-meta); font-weight: 400; color: var(--sa-ink-soft); }
    .seccion { display: flex; align-items: center; gap: var(--sa-space-2); margin: 0;
      font-size: var(--sa-text-body); font-weight: 600; }
    .seccion__n { min-inline-size: 1.25rem; padding: 0 var(--sa-space-1); text-align: center;
      border-radius: var(--sa-radius-pill); background: var(--sa-line);
      font-size: var(--sa-text-meta); color: var(--sa-ink-soft); }
    .recepcion { margin-top: var(--sa-space-3); }
    .recepcion__acciones { display: flex; gap: var(--sa-space-2); flex-wrap: wrap; }
    .recepcion ion-button { margin: 0; min-height: 44px; --border-radius: var(--sa-radius); }
    td ion-input { --padding-start: var(--sa-space-2); min-height: var(--sa-control-h-sm); }

    /* Nueva OC */
    .nueva { display: flex; flex-wrap: wrap; gap: var(--sa-space-4); align-items: flex-start; }
    .nueva__main { flex: 3 1 34rem; min-inline-size: 0; display: flex; flex-direction: column; gap: var(--sa-space-4); }
    .bloque { padding: 18px var(--sa-space-5); }
    .bloque__titulo { margin: 0 0 14px; font-size: var(--sa-text-body); font-weight: 700; }
    .datos { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .datos .ancho { grid-column: 1 / -1; }
    .lineas__head { display: flex; align-items: center; justify-content: space-between; gap: var(--sa-space-3);
      padding: var(--sa-space-4) var(--sa-space-5); }
    .lineas__head h2 { margin: 0; font-size: var(--sa-text-body); font-weight: 700; }
    .lineas__head ion-button { margin: 0; --border-radius: var(--sa-radius); }
    .lineas td[data-label="Descripción"] { min-inline-size: 16rem; }
    .stepper { display: inline-flex; align-items: center; gap: var(--sa-space-1); }
    .stepper ion-input { inline-size: 5.5rem; text-align: center; }
    .step, .quitar {
      appearance: none; display: inline-flex; align-items: center; justify-content: center;
      inline-size: 36px; block-size: 36px; padding: 0; border-radius: var(--sa-radius);
      border: var(--sa-border) solid var(--sa-line-strong); background: var(--sa-surface);
      color: var(--sa-ink); cursor: pointer;
    }
    .step:hover { border-color: var(--sa-ink); }
    .quitar { border-color: transparent; color: var(--sa-ink-soft); }
    .quitar:hover { color: var(--sa-crit-fg); background: var(--sa-crit-bg); }
    .sin-lineas { padding: var(--sa-space-4) var(--sa-space-5); color: var(--sa-ink-soft); font-size: var(--sa-text-dense); }

    .resumen { flex: 1 1 18rem; min-inline-size: 0; padding: var(--sa-space-5);
      position: sticky; top: var(--sa-space-5); }
    .resumen h2 { margin: 0 0 14px; font-size: var(--sa-text-body); font-weight: 700; }
    .resumen dl { display: flex; flex-direction: column; gap: 10px; margin: 0; font-size: var(--sa-text-dense); }
    .resumen dl div { display: flex; justify-content: space-between; gap: var(--sa-space-3); }
    .resumen dt { color: var(--sa-ink-soft); }
    .resumen dd { margin: 0; font-variant-numeric: tabular-nums; }
    .resumen .total { padding-top: 10px; border-top: var(--sa-border) solid var(--sa-line);
      font-size: var(--sa-text-title); font-weight: 700; }
    .resumen .total dt { color: var(--sa-ink); }
    .resumen__acciones { display: flex; flex-direction: column; gap: 10px; margin-top: var(--sa-space-5); }
    .resumen__acciones ion-button { margin: 0; min-height: 44px; --border-radius: var(--sa-radius); }
    .resumen__nota { margin: 14px 0 0; font-size: var(--sa-text-meta); color: var(--sa-ink-soft); }

    @media (max-width: 767.98px) {
      .datos { grid-template-columns: minmax(0, 1fr); }
      .bloque, .lineas__head, .resumen { padding-inline: var(--sa-space-4); }
      .resumen { position: static; flex-basis: 100%; }
      .step, .quitar { inline-size: 44px; block-size: 44px; }
      .resumen__acciones ion-button { min-height: 48px; }
    }
  `],
  template: `
    <app-page-header [title]="esNueva() ? 'Nueva orden de compra' : 'OC ' + (oc()?.numdoc ?? '')"></app-page-header>

    <ion-content>
      <div class="page-content page-content--wide" data-area="compras">
        @if (cargando()) {
          <div class="sa-skeleton">
            <ion-skeleton-text [animated]="true"></ion-skeleton-text>
            <ion-skeleton-text [animated]="true"></ion-skeleton-text>
            <ion-skeleton-text [animated]="true"></ion-skeleton-text>
            <ion-skeleton-text [animated]="true"></ion-skeleton-text>
          </div>
        } @else if (esNueva()) {
          <a class="volver" routerLink="/f/CON_DOC_EMI">
            <sa-icon name="arrow-left" [size]="16" />Órdenes de compra
          </a>
          <sa-page-head title="Nueva orden de compra" area="compras" icon="orders"
                        subtitle="Elige el proveedor, revisa las líneas y emítela. Queda por aprobar." />

          @if (error()) { <div class="sa-notice sa-notice--crit" role="alert">{{ error() }}</div> }
          @if (mensaje()) { <div class="sa-notice sa-notice--info" role="status">{{ mensaje() }}</div> }

          <div class="nueva">
            <div class="nueva__main">
              <section class="sa-panel bloque" aria-labelledby="oc-datos">
                <h2 id="oc-datos" class="bloque__titulo">Datos de la orden</h2>
                <div class="datos">
                  <ion-input label="Código de proveedor" labelPlacement="stacked" fill="outline"
                             type="number" inputmode="numeric" [(ngModel)]="nuevo.cliente"></ion-input>
                  <ion-input label="RUT del proveedor" labelPlacement="stacked" fill="outline" [(ngModel)]="nuevo.rut"></ion-input>
                  <ion-input label="Centro de costo" labelPlacement="stacked" fill="outline" [(ngModel)]="nuevo.ccosto"></ion-input>
                  <ion-input label="Fecha" labelPlacement="stacked" fill="outline" type="date" [(ngModel)]="nuevo.fecha"></ion-input>
                  <ion-input class="ancho" label="Observación" labelPlacement="stacked" fill="outline" [(ngModel)]="nuevo.obs"></ion-input>
                </div>
              </section>

              <section class="sa-panel lineas" aria-labelledby="oc-lineas">
                <div class="lineas__head">
                  <h2 id="oc-lineas">Líneas</h2>
                  <ion-button size="small" fill="outline" (click)="agregarLinea()">
                    <sa-icon name="plus" slot="start" [size]="16" />Agregar línea
                  </ion-button>
                </div>
                @if (nuevo.lineas.length) {
                  <sa-table-wrap label="Líneas de la nueva orden">
                    <table class="sa-table">
                      <thead><tr>
                        <th>Descripción</th><th class="num">Cantidad</th><th>Unidad</th>
                        <th class="num">Precio unitario</th><th class="num">Total</th>
                        <th><span class="oculto">Quitar</span></th>
                      </tr></thead>
                      <tbody>
                        @for (l of nuevo.lineas; track $index; let i = $index) {
                          <tr>
                            <td data-label="Descripción">
                              <ion-input fill="outline" [attr.aria-label]="'Descripción de la línea ' + (i + 1)" [(ngModel)]="l.nombre"></ion-input>
                            </td>
                            <td class="num" data-label="Cantidad">
                              <span class="stepper">
                                <button type="button" class="step" (click)="cambiarCantidad(l, -1)"
                                        [disabled]="totalCantidad(l) <= 0"
                                        [attr.aria-label]="'Restar una unidad a la línea ' + (i + 1)">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                       stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
                                </button>
                                <ion-input fill="outline" type="number" inputmode="decimal" min="0"
                                           [attr.aria-label]="'Cantidad de la línea ' + (i + 1)" [(ngModel)]="l.cantidad"></ion-input>
                                <button type="button" class="step" (click)="cambiarCantidad(l, 1)"
                                        [attr.aria-label]="'Sumar una unidad a la línea ' + (i + 1)">
                                  <sa-icon name="plus" [size]="16" [stroke]="2" />
                                </button>
                              </span>
                            </td>
                            <td data-label="Unidad">
                              <ion-input fill="outline" [attr.aria-label]="'Unidad de la línea ' + (i + 1)" [(ngModel)]="l.unidad"></ion-input>
                            </td>
                            <td class="num" data-label="Precio unitario">
                              <ion-input fill="outline" type="number" inputmode="numeric" min="0"
                                         [attr.aria-label]="'Precio unitario de la línea ' + (i + 1)" [(ngModel)]="l.precio_uni"></ion-input>
                            </td>
                            <td class="num" data-label="Total"><strong>{{ moneda(totalLinea(l)) }}</strong></td>
                            <td>
                              <button type="button" class="quitar" (click)="quitarLinea(i)"
                                      [attr.aria-label]="'Quitar la línea ' + (i + 1)">
                                <sa-icon name="x" [size]="16" />
                              </button>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </sa-table-wrap>
                } @else {
                  <p class="sin-lineas">Sin líneas. Agrega una para poder emitir la orden.</p>
                }
              </section>
            </div>

            <aside class="sa-panel resumen" aria-labelledby="oc-resumen">
              <h2 id="oc-resumen">Resumen</h2>
              <dl>
                <div><dt>Neto</dt><dd>{{ moneda(netoNuevo()) }}</dd></div>
                <div><dt>IVA 19 %</dt><dd>{{ moneda(ivaNuevo()) }}</dd></div>
                <div class="total"><dt>Total</dt><dd>{{ moneda(netoNuevo() + ivaNuevo()) }}</dd></div>
              </dl>
              <div class="resumen__acciones">
                <ion-button color="compras" expand="block" (click)="crear()" [disabled]="trabajando()">
                  Emitir orden · {{ moneda(netoNuevo() + ivaNuevo()) }}
                </ion-button>
                <ion-button fill="outline" expand="block" routerLink="/f/CON_DOC_EMI">Cancelar</ion-button>
              </div>
              <p class="resumen__nota">
                Al emitirla queda "Por aprobar". Quien tenga permiso la aprueba desde Órdenes o desde el Inicio.
              </p>
            </aside>
          </div>

        } @else if (oc(); as o) {
          <sa-page-head [title]="'OC ' + o.numdoc" area="compras" icon="orders"
                        [subtitle]="o.proveedor + ' · ' + badge(o).texto">
            <div saActions>
              <ion-button fill="outline" routerLink="/f/CON_DOC_EMI">Volver a órdenes</ion-button>
              @if (puede('ANULAR_ORDEN_COMPRA') && o.estado !== 'ELIMINADO' && o.estado !== 'ANULADO') {
                <ion-button color="danger" fill="outline" (click)="anular()" [disabled]="trabajando()">Anular</ion-button>
              }
              @if (o.estado === 'PENDIENTE' && puede('APRUEBA_ORDEN_COMPRA')) {
                <ion-button color="compras" (click)="aprobar()" [disabled]="trabajando()">Aprobar</ion-button>
              }
              @if (o.estado === 'EMITIDO' && puede('EMITE_HES') && !recibiendo()) {
                <ion-button color="bodega" (click)="recibiendo.set(true)">Emitir HES</ion-button>
              }
            </div>
          </sa-page-head>

          @if (error()) { <div class="sa-notice sa-notice--crit" role="alert">{{ error() }}</div> }
          @if (mensaje()) { <div class="sa-notice sa-notice--ok" role="status">{{ mensaje() }}</div> }

          <section class="sa-panel ficha" aria-label="Datos de la orden">
            <dl class="ficha__meta">
              <div><dt>Estado</dt><dd><span class="sa-badge" [class]="'sa-badge sa-badge--' + badge(o).tono">{{ badge(o).texto }}</span></dd></div>
              <div><dt>Proveedor</dt><dd>{{ o.proveedor }}</dd></div>
              <div><dt>RUT</dt><dd>{{ o.rut || 'Sin RUT' }}</dd></div>
              <div><dt>Fecha</dt><dd>{{ fecha(o.fecha) }}</dd></div>
              <div><dt>Centro de costo</dt><dd>{{ o.ccosto || 'Sin centro' }}</dd></div>
              <div><dt>HES emitidas</dt><dd>{{ hesEmitidas(o) }}</dd></div>
            </dl>
            @if (o.obs) {
              <div class="obs"><strong>Observación</strong>{{ o.obs }}</div>
            }
          </section>

          <sa-kpis [items]="montos(o)" />

          @if (recibiendo()) {
            <div class="sa-notice sa-notice--info" role="status">
              Escribe en la columna Recibir lo que llegó de cada línea y confirma la recepción.
            </div>
          }

          <div class="sa-query">
            <div class="sa-query__bar">
              <h2 class="seccion">Líneas <span class="seccion__n">{{ o.detalle.length }}</span></h2>
            </div>
            <sa-table-wrap label="Líneas de la orden">
              <table class="sa-table">
                <thead><tr>
                  <th>Descripción</th><th class="num">Cantidad</th><th>Unidad</th>
                  <th class="num">Precio</th><th class="num">Total</th><th class="num">Avance</th>
                  @if (recibiendo()) { <th class="num">Recibir</th> }
                </tr></thead>
                <tbody>
                  @for (l of o.detalle; track l.id) {
                    <tr>
                      <th scope="row">{{ l.nombre }}</th>
                      <td class="num" data-label="Cantidad">{{ cantidad(l.cantidad) }}</td>
                      <td data-label="Unidad">{{ l.unidad }}</td>
                      <td class="num" data-label="Precio">{{ moneda(l.precio_uni) }}</td>
                      <td class="num" data-label="Total">{{ moneda(l.total) }}</td>
                      <td class="num" data-label="Avance">{{ pct(l.OC_avance) }}%</td>
                      @if (recibiendo()) {
                        <td class="num" data-label="Recibir">
                          <ion-input fill="outline" type="number" inputmode="decimal"
                                     [attr.aria-label]="'Cantidad recibida de ' + l.nombre"
                                     [(ngModel)]="recepcion[l.id]"
                                     [placeholder]="pendiente(l).toString()"></ion-input>
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </sa-table-wrap>
            @if (recibiendo()) {
              <div class="sa-actionbar recepcion" role="region" aria-label="Recepción">
                <p>
                  Neto de la HES: <strong class="num">{{ moneda(netoHes()) }}</strong>
                  <small>Avance que sumará a la OC: {{ avanceHes() }}%</small>
                </p>
                <span class="recepcion__acciones">
                  <ion-button fill="outline" (click)="recibiendo.set(false)">Cancelar</ion-button>
                  <ion-button color="bodega" (click)="emitirHes()" [disabled]="trabajando() || netoHes() <= 0">
                    Confirmar recepción
                  </ion-button>
                </span>
              </div>
            }
          </div>

          <div class="sa-query">
            <div class="sa-query__bar">
              <h2 class="seccion">Recepciones (HES) <span class="seccion__n">{{ hes().length }}</span></h2>
            </div>
            @if (!hes().length) {
              <div class="sa-empty">
                <div class="title">Sin recepciones</div>
                <div class="text">
                  {{ o.estado === 'EMITIDO' ? 'Usa "Emitir HES" cuando llegue lo pedido.' : 'Esta orden todavía no tiene HES.' }}
                </div>
              </div>
            } @else {
              <sa-table-wrap label="Recepciones de la orden">
                <table class="sa-table">
                  <thead><tr>
                    <th>HES</th><th>Fecha</th><th class="num">Neto</th>
                    <th class="num">Avance</th><th>Usuario</th><th><span class="oculto">Acciones</span></th>
                  </tr></thead>
                  <tbody>
                    @for (h of hes(); track h.id) {
                      <tr>
                        <th scope="row">{{ h.numdoc }}</th>
                        <td data-label="Fecha">{{ fecha(h.fecha) }}</td>
                        <td class="num" data-label="Neto">{{ moneda(h.neto) }}</td>
                        <td class="num" data-label="Avance">{{ pct(h.OC_avance) }}%</td>
                        <td data-label="Usuario">{{ h.usuario }}</td>
                        <td>
                          @if (puede('ELIMINA_HES')) {
                            <ion-button size="small" fill="outline" color="danger" [disabled]="trabajando()"
                                        (click)="eliminarHes(h)">Eliminar</ion-button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </sa-table-wrap>
            }
          </div>
        } @else if (error()) {
          <div class="sa-notice sa-notice--crit" role="alert">{{ error() }}</div>
        }
      </div>
    </ion-content>
  `,
})
export class OrdenPage {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly alerts = inject(AlertController);
  private readonly ruta = inject(ActivatedRoute);

  readonly param = toSignal(
    this.ruta.paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );
  readonly esNueva = computed(() => this.param() === 'nueva');

  readonly oc = signal<OcDetalle | null>(null);
  readonly hes = signal<Hes[]>([]);
  readonly cargando = signal(false);
  readonly trabajando = signal(false);
  readonly recibiendo = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');

  /** Cantidad a recibir por id de linea. */
  recepcion: Record<number, number> = {};

  nuevo = {
    cliente: null as number | null, rut: '', fecha: new Date().toISOString().slice(0, 10),
    ccosto: '', obs: '',
    lineas: [lineaVacia()] as LineaNueva[],
  };

  readonly moneda = clp;
  readonly fecha = fechaTabla;
  readonly badge = (o: Oc) => estadoOc(o.estado);
  pct = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;
  ancho = (v: unknown) => Math.max(0, Math.min(100, this.pct(v)));
  montos(o: OcDetalle): SaKpiItem[] {
    return [
      { label: 'Neto', value: this.moneda(o.neto), hint: 'Antes de impuestos', icon: 'cash-outline' },
      { label: 'IVA', value: this.moneda(o.iva), hint: this.tasa(o), icon: 'pricetag-outline' },
      { label: 'Total', value: this.moneda(o.total), hint: 'Monto de la orden', icon: 'wallet-outline' },
      {
        label: 'Avance de recepción',
        value: `${this.pct(o.OC_avance)}%`,
        hint: this.textoAvance(o),
        ok: this.ancho(o.OC_avance) >= 100,
        bar: this.ancho(o.OC_avance),
      },
    ];
  }
  puede = (f: string) => (this.auth.sesion()?.permisos ?? []).includes(f);
  cantidad = (n: unknown) => Number(n).toLocaleString('es-CL', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  tasa(o: OcDetalle): string {
    const neto = Number(o.neto);
    if (!neto) return '';
    return `${Math.round(Number(o.iva) / neto * 100)}% sobre el neto`;
  }

  hesEmitidas(o: OcDetalle): string {
    const nums = this.hes().map((h) => h.numdoc).filter((n) => n != null);
    if (nums.length) return nums.join(', ');
    const texto = String(o.HES ?? '').trim();
    return texto || 'Sin HES';
  }

  textoAvance(o: OcDetalle): string {
    const n = this.hes().length;
    const cubre = this.ancho(o.OC_avance) >= 100;
    if (n === 0) return 'Sin recepciones';
    if (n === 1) {
      return cubre
        ? '1 recepción (HES) cubre el total de la orden'
        : '1 recepción (HES) registrada';
    }
    return cubre
      ? `${n} recepciones (HES) cubren el total de la orden`
      : `${n} recepciones (HES) registradas`;
  }

  private ultimo = '';
  /** "Recibir (HES)" in the list opens the reception once, on the first load. */
  private abrirRecepcion = false;

  constructor() {
    this.abrirRecepcion = this.ruta.snapshot.queryParamMap.get('recibir') === '1';
    effect(() => {
      const p = this.param();
      if (!p || p === this.ultimo) return;
      this.ultimo = p;
      if (p !== 'nueva') void this.cargar(Number(p));
      else this.precargarReposicion();
    });
  }

  /**
   * Stock opens /oc/nueva with the selected materials in the navigation state.
   * The lines arrive filled in; the user still picks the provider and emits the order.
   */
  private precargarReposicion(): void {
    const orden = (history.state ?? {}).reposicion as
      | { ccosto: string; lineas: { nombre: string; cantidad: number; unidad: string; precio_uni: number }[] }
      | undefined;
    if (!orden?.lineas?.length) return;
    this.nuevo.ccosto = orden.ccosto ?? '';
    this.nuevo.obs = 'Reposición de stock';
    this.nuevo.lineas = orden.lineas.map((l) => ({ ...l }));
    this.mensaje.set(`Se cargaron ${orden.lineas.length} ${orden.lineas.length === 1 ? 'material' : 'materiales'} desde Stock. Revisa cantidades, elige el proveedor y emite la orden.`);
  }

  // ------------------------------------------------------------------ carga

  private async cargar(id: number): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const o = await firstValueFrom(this.http.get<OcDetalle>(`${API}/compras/oc/${id}`));
      this.oc.set(o);
      this.recepcion = {};
      this.hes.set(
        await firstValueFrom(this.http.get<Hes[]>(`${API}/compras/oc/${o.numdoc}/hes`)),
      );
      if (this.abrirRecepcion) {
        this.abrirRecepcion = false;
        if (o.estado === 'EMITIDO' && this.puede('EMITE_HES')) this.recibiendo.set(true);
      }
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo cargar la orden');
    } finally {
      this.cargando.set(false);
    }
  }

  // --------------------------------------------------------------- recepcion

  /** Lo que falta recibir de una linea, con la regla de porcentaje del ERP. */
  pendiente(l: Linea): number {
    const falta = Number(l.cantidad) * (100 - Number(l.OC_avance)) / 100;
    return Math.round(falta * 100) / 100;
  }

  private lineasRecibidas() {
    const o = this.oc();
    if (!o) return [];
    return o.detalle
      .map((l) => {
        const cant = Number(this.recepcion[l.id] ?? 0);
        if (!cant || cant <= 0 || !Number(l.cantidad)) return null;
        const avance = Math.round((cant / Number(l.cantidad)) * 100 * 10000) / 10000;
        const monto = Math.round(Number(l.total) * cant / Number(l.cantidad));
        return { id_linea: l.id, cantidad: cant, avance, monto, ccosto_ap: l.ccosto_ap };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  netoHes(): number {
    return this.lineasRecibidas().reduce((s, l) => s + l.monto, 0);
  }

  /** Solo informativo: el valor que manda es el que calcula el backend. */
  avanceHes(): number {
    const o = this.oc();
    if (!o || !Number(o.neto)) return 0;
    const cambio = Number(o.tipo_cambio) || 1;
    return Math.round((this.netoHes() / (Number(o.neto) / cambio)) * 100 * 10000) / 10000;
  }

  async emitirHes(): Promise<void> {
    const o = this.oc();
    if (!o) return;
    const lineas = this.lineasRecibidas();
    if (!lineas.length) { this.error.set('No hay cantidades para recibir'); return; }

    const neto = this.netoHes();
    const iva = o.tipo_doc === '999' ? 0 : Math.round(neto * 0.19);
    await this.accion(
      () => firstValueFrom(this.http.post(`${API}/compras/hes`, {
        id_OC: o.id, fecha: new Date().toISOString().slice(0, 10),
        neto, iva, total: neto + iva, obs: '', lineas,
      })),
      'Recepción registrada',
    );
    this.recibiendo.set(false);
  }

  async eliminarHes(h: Hes): Promise<void> {
    const si = await confirmar(
      this.alerts, `¿Eliminar la HES ${h.numdoc}?`,
      `Se descuenta su avance de la orden (${this.moneda(h.neto)} neto).`, 'Eliminar HES', true,
    );
    if (!si) return;
    await this.accion(
      () => firstValueFrom(this.http.delete(`${API}/compras/hes/${h.numdoc}`)),
      `HES ${h.numdoc} eliminada`,
    );
  }

  // --------------------------------------------------------------- acciones

  async aprobar(): Promise<void> {
    const o = this.oc(); if (!o) return;
    await this.accion(
      () => firstValueFrom(this.http.post(`${API}/compras/oc/${o.numdoc}/aprobar`, {})),
      'Orden aprobada. Ahora está por recibir.',
    );
  }

  async anular(): Promise<void> {
    const o = this.oc(); if (!o) return;
    const si = await confirmar(
      this.alerts, `¿Anular la OC ${o.numdoc}?`,
      `${o.proveedor} · ${this.moneda(o.total)}. La orden queda eliminada y no se puede recibir.`,
      'Anular orden', true,
    );
    if (!si) return;
    await this.accion(
      () => firstValueFrom(
        this.http.post(`${API}/compras/oc/${o.numdoc}/anular`, { cliente: o.cliente }),
      ),
      'Orden anulada',
    );
  }

  private async accion(fn: () => Promise<unknown>, ok: string): Promise<void> {
    this.trabajando.set(true);
    this.error.set(''); this.mensaje.set('');
    try {
      await fn();
      this.mensaje.set(ok);
      const o = this.oc();
      if (o) await this.cargar(o.id);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo completar la operación');
    } finally {
      this.trabajando.set(false);
    }
  }

  // ------------------------------------------------------------------ nueva

  agregarLinea(): void {
    this.nuevo.lineas = [...this.nuevo.lineas, lineaVacia()];
  }

  quitarLinea(i: number): void {
    this.nuevo.lineas = this.nuevo.lineas.filter((_, j) => j !== i);
  }

  totalCantidad = (l: LineaNueva) => Number(l.cantidad || 0);

  cambiarCantidad(l: LineaNueva, paso: number): void {
    l.cantidad = Math.max(0, this.totalCantidad(l) + paso);
  }

  totalLinea(l: LineaNueva): number {
    return Number(l.cantidad || 0) * Number(l.precio_uni || 0);
  }

  netoNuevo(): number {
    return this.nuevo.lineas.reduce((s, l) => s + this.totalLinea(l), 0);
  }

  ivaNuevo(): number {
    return Math.round(this.netoNuevo() * IVA);
  }

  async crear(): Promise<void> {
    const lineas = this.nuevo.lineas
      .filter((l) => l.nombre.trim() && Number(l.cantidad) > 0)
      .map((l, i) => ({
        producto: i + 1, nombre: l.nombre.trim(), cantidad: Number(l.cantidad),
        unidad: l.unidad || 'UNI', precio_uni: Number(l.precio_uni),
        total: Number(l.cantidad) * Number(l.precio_uni),
      }));
    if (!lineas.length) { this.error.set('La OC necesita al menos una línea'); return; }
    if (!this.nuevo.cliente) { this.error.set('Falta el código de proveedor'); return; }

    this.trabajando.set(true);
    this.error.set('');
    try {
      const creada = await firstValueFrom(this.http.post<OcDetalle>(`${API}/compras/oc`, {
        tipo_doc: '801', cliente: Number(this.nuevo.cliente), rut: this.nuevo.rut,
        fecha: this.nuevo.fecha, ccosto: this.nuevo.ccosto, obs: this.nuevo.obs, lineas,
      }));
      void this.router.navigate(['/oc', creada.id]);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo emitir la orden');
    } finally {
      this.trabajando.set(false);
    }
  }
}
