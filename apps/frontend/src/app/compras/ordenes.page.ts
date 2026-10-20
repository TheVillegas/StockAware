/**
 * Listado de ordenes de compra (CON_DOC_EMI / EMITE_OC / EMITE_HES / EDITA_OC).
 *
 * Muestra las OC con su avance y deja trabajar sobre ellas: aprobar, anular,
 * recibir (HES) y aprobar en lote. El avance del encabezado es el ponderado por
 * plata que calcula el backend, no el promedio de las lineas.
 */
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  AlertController, IonButton, IonContent, IonFooter, IonSearchbar,
} from '@ionic/angular/standalone';

import { API, AuthService } from '../core/auth.service';
import { outstandingAmount } from '../shared/consulta';
import { clp, etiquetaEstado, fechaTabla, rangoLista, tonoEstado } from '../shared/format';
import { PageHeaderComponent } from '../shared/page-header.component';
import { SaIcon } from '../shared/sa-icon.component';
import { SaList } from '../shared/sa-list.component';
import { SaPageHead } from '../shared/sa-page-head.component';
import { SaTableWrap } from '../shared/sa-table-wrap.component';

export { clp, etiquetaEstado, fechaTabla, tonoEstado };

export interface Oc {
  id: number; numdoc: number; tipo_doc: string; fecha: string;
  cliente: number; rut: string; estado: string;
  neto: number; iva: number; total: number;
  OC_avance: string; HES: string; ccosto: string; obs: string;
  usuario: string; proveedor: string;
}

export type TonoOc = 'crit' | 'warn' | 'info' | 'ok' | 'muted';

/** Status badge of a purchase order, in the words people use for its next step. */
export const estadoOc = (estado: string): { texto: string; tono: TonoOc } => {
  switch (estado) {
    case 'PENDIENTE': return { texto: 'Por aprobar', tono: 'crit' };
    case 'EMITIDO': return { texto: 'Por recibir', tono: 'info' };
    case 'CERRADO': return { texto: 'Cerrada', tono: 'ok' };
    case 'PAGO': return { texto: 'Pagada', tono: 'ok' };
    case 'ANULADO': return { texto: 'Anulada', tono: 'muted' };
    case 'ELIMINADO': return { texto: 'Eliminada', tono: 'muted' };
    default: return { texto: etiquetaEstado(estado), tono: 'info' };
  }
};

/** Asks before a destructive or bulk action. Resolves true only on the confirm button. */
export async function confirmar(
  alerts: AlertController, header: string, message: string, ok: string, destructivo = false,
): Promise<boolean> {
  const alerta = await alerts.create({
    header, message,
    buttons: [
      { text: 'Volver', role: 'cancel' },
      { text: ok, role: destructivo ? 'destructive' : 'confirm' },
    ],
  });
  await alerta.present();
  const { role } = await alerta.onDidDismiss();
  return role === 'confirm' || role === 'destructive';
}

const ESTADOS = ['PENDIENTE', 'EMITIDO', 'CERRADO'];

@Component({
  selector: 'app-ordenes',
  imports: [
    PageHeaderComponent, IonContent, IonSearchbar, IonButton, IonFooter, RouterLink,
    SaIcon, SaList, SaPageHead, SaTableWrap,
  ],
  styles: [`
    .lista { overflow: hidden; }
    .estados .sa-chip {
      display: inline-flex; align-items: center; gap: var(--sa-space-2);
      min-block-size: 40px; padding-inline: var(--sa-space-4); font-weight: 500;
    }
    .estados .sa-chip[aria-pressed="true"] {
      background: var(--sa-ink); border-color: var(--sa-ink); color: var(--sa-surface);
    }
    .estados .sa-chip strong { font-variant-numeric: tabular-nums; }
    .sa-chip:focus-visible, .chk:focus-visible, .oc-num:focus-visible {
      outline: var(--sa-focus-ring); outline-offset: var(--sa-focus-offset);
    }

    .seleccion { border-top: 0; border-bottom: var(--sa-border) solid var(--sa-line-strong);
      background: var(--sa-area-tint); }
    .seleccion__acciones { display: flex; gap: var(--sa-space-2); flex-wrap: wrap; }

    .elegir { inline-size: 3rem; }
    .elegir label { display: inline-flex; align-items: center; justify-content: center;
      inline-size: 44px; block-size: 44px; margin: -12px 0; cursor: pointer; }
    .chk { inline-size: 20px; block-size: 20px; margin: 0; accent-color: var(--sa-area); cursor: pointer; }
    .oculto { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden;
      clip: rect(0 0 0 0); white-space: nowrap; }

    .oc-num { color: var(--sa-ink); font-weight: 700; text-decoration: none; }
    .oc-num:hover { color: var(--sa-area); text-decoration: underline; }
    .avance { display: inline-flex; align-items: center; gap: var(--sa-space-2); }
    .avance__pista {
      inline-size: 4.5rem; block-size: 0.375rem; border-radius: var(--sa-radius-pill);
      background: var(--sa-line); overflow: hidden;
    }
    .avance__pista > i {
      display: block; block-size: 100%; border-radius: inherit; background: var(--sa-area);
    }
    td.acciones-col { text-align: end; }
    .acciones-fila { display: inline-flex; gap: var(--sa-space-2); justify-content: flex-end; flex-wrap: nowrap; }
    .acciones-fila ion-button { margin: 0; min-height: 36px; --border-radius: var(--sa-radius); }
    .nota { margin: 0; padding: var(--sa-space-3) var(--sa-space-4); font-size: var(--sa-text-meta);
      color: var(--sa-ink-soft); border-top: var(--sa-border) solid var(--sa-line); }

    .oc-cards { list-style: none; margin: 0; padding: var(--sa-space-3); display: none;
      flex-direction: column; gap: var(--sa-space-2); }
    .oc-card { padding: 14px var(--sa-space-4); cursor: pointer; }
    .oc-card.is-selected { border-color: var(--sa-area); }
    .oc-card__top { display: flex; justify-content: space-between; align-items: center; gap: var(--sa-space-2); }
    .oc-card__top .oc-num { display: inline-flex; align-items: center; min-block-size: 44px; margin-block: -10px; }
    .oc-card__meta { margin-top: var(--sa-space-1); font-size: var(--sa-text-dense); color: var(--sa-ink-soft); }
    .oc-card__foot { display: flex; justify-content: space-between; align-items: center; gap: var(--sa-space-2);
      margin-top: var(--sa-space-3); font-size: var(--sa-text-meta); color: var(--sa-ink-soft); }
    .oc-card__acciones { display: flex; gap: var(--sa-space-2); margin-top: var(--sa-space-3); }
    .oc-card__acciones ion-button { flex: 1 1 0; margin: 0; min-height: 44px; --border-radius: var(--sa-radius); }

    .barra-movil { display: none; }
    .barra-movil .sa-actionbar { padding: var(--sa-space-3) var(--sa-space-4); }
    .barra-movil ion-button { flex: 1 1 100%; margin: 0; min-height: 48px; --border-radius: var(--sa-radius); }

    @media (max-width: 767.98px) {
      .solo-escritorio { display: none !important; }
      .oc-cards { display: flex; }
      .barra-movil { display: block; }
      .estados { flex-wrap: nowrap; overflow-x: auto; }
      .estados .sa-chip { min-block-size: 44px; white-space: nowrap; }
    }
  `],
  template: `
    <app-page-header title="Órdenes de compra"></app-page-header>

    <ion-content>
      <div class="page-content page-content--wide" data-area="compras">
      <sa-page-head title="Órdenes de compra" area="compras" icon="orders"
                    subtitle="Aprueba, recibe y sigue cada orden hasta su factura.">
        <div saActions>
          @if (puede('EMITE_OC') && puede('MATERIAL_X_BODEGA')) {
            <ion-button fill="outline" routerLink="/f/MATERIAL_X_BODEGA" [queryParams]="{ bajo: '1' }">
              Crear desde stock urgente
            </ion-button>
          }
          @if (puede('EMITE_OC')) {
            <ion-button class="solo-escritorio" color="compras" routerLink="/oc/nueva">
              <sa-icon name="plus" slot="start" />
              Nueva orden de compra
            </ion-button>
          }
        </div>
      </sa-page-head>

      @if (error()) { <div class="sa-notice sa-notice--crit" role="alert">{{ error() }}</div> }
      @if (mensaje()) { <div class="sa-notice sa-notice--ok" role="status">{{ mensaje() }}</div> }

      <section class="lista" aria-label="Órdenes">
      <sa-list [loading]="cargando()" [empty]="datos().length === 0"
               [emptyTitle]="vacioTitulo()" [emptyText]="vacioTexto()"
               [range]="rango()" [page]="pagina()" [pages]="paginas()" (pageChange)="pagina.set($event)">
        <div saFilters>
          <div class="sa-chips estados" role="group" aria-label="Estado de la orden">
            <button type="button" class="sa-chip" [attr.aria-pressed]="estado() === 'PENDIENTE'"
                    (click)="estado.set('PENDIENTE')">Necesitan acción <strong>{{ n('PENDIENTE') }}</strong></button>
            <button type="button" class="sa-chip" [attr.aria-pressed]="estado() === 'EMITIDO'"
                    (click)="estado.set('EMITIDO')">Por recibir <strong>{{ n('EMITIDO') }}</strong></button>
            <button type="button" class="sa-chip" [attr.aria-pressed]="estado() === 'CERRADO'"
                    (click)="estado.set('CERRADO')">Cerradas <strong>{{ n('CERRADO') }}</strong></button>
            <button type="button" class="sa-chip" [attr.aria-pressed]="estado() === ''"
                    (click)="estado.set('')">Todas <strong>{{ n('TOTAL') }}</strong></button>
          </div>
          <ion-searchbar placeholder="Número, proveedor o RUT" [debounce]="350"
                         (ionInput)="buscar.set($any($event).detail.value ?? '')"></ion-searchbar>
        </div>

        @if (seleccionadas().length) {
          <div class="sa-actionbar seleccion" role="region" aria-label="Órdenes seleccionadas">
            <p><strong>{{ textoSeleccion() }}</strong></p>
            <div class="seleccion__acciones">
              <ion-button fill="outline" size="small" (click)="limpiarSeleccion()" [disabled]="trabajando()">
                Quitar selección
              </ion-button>
              <ion-button color="compras" size="small" (click)="aprobarSeleccionadas()" [disabled]="trabajando()">
                Aprobar seleccionadas
              </ion-button>
            </div>
          </div>
        }

        <div class="solo-escritorio">
        <sa-table-wrap label="Órdenes de compra">
            <table class="sa-table">
              <thead><tr>
                @if (puedeAprobar()) {
                  <th class="elegir">
                    @if (pendientesVisibles().length) {
                      <label>
                        <input class="chk" type="checkbox" [checked]="todasElegidas()"
                               (change)="elegirTodas($any($event.target).checked)"
                               aria-label="Elegir todas las órdenes por aprobar de esta página">
                      </label>
                    } @else { <span class="oculto">Elegir</span> }
                  </th>
                }
                <th>Orden</th><th>Proveedor</th><th>Centro de costo</th>
                <th class="num">Total</th><th>Avance</th><th>Estado</th><th class="num">Acciones</th>
              </tr></thead>
              <tbody>
                @for (o of datos(); track o.id) {
                  <tr class="is-click" [class.is-selected]="elegida(o)" (click)="abrir(o)">
                    @if (puedeAprobar()) {
                      <td class="elegir" (click)="$event.stopPropagation()">
                        @if (o.estado === 'PENDIENTE') {
                          <label>
                            <input class="chk" type="checkbox" [checked]="elegida(o)"
                                   (change)="alternar(o)" [attr.aria-label]="'Elegir OC ' + o.numdoc">
                          </label>
                        }
                      </td>
                    }
                    <th scope="row">
                      <a class="oc-num" [routerLink]="['/oc', o.id]" (click)="$event.stopPropagation()">OC {{ o.numdoc }}</a>
                      <span class="sa-sub">{{ fecha(o.fecha) }}</span>
                    </th>
                    <td class="name">
                      {{ o.proveedor }}
                      @if (o.rut) { <span class="sa-sub">{{ o.rut }}</span> }
                    </td>
                    <td>{{ o.ccosto }}</td>
                    <td class="num">{{ moneda(o.total) }}</td>
                    <td>
                      <span class="avance">
                        <span class="avance__pista"><i [style.width.%]="ancho(o.OC_avance)"></i></span>
                        <span class="num">{{ pct(o.OC_avance) }}%</span>
                      </span>
                      @if (o.estado === 'EMITIDO' && porRecibir(o) > 0) {
                        <span class="sa-sub sa-sub--warn">Falta recibir {{ moneda(porRecibir(o)) }}</span>
                      }
                    </td>
                    <td><span class="sa-badge" [class]="'sa-badge sa-badge--' + badge(o).tono">{{ badge(o).texto }}</span></td>
                    <td class="acciones-col" (click)="$event.stopPropagation()">
                      <span class="acciones-fila">
                        @if (o.estado === 'PENDIENTE') {
                          @if (puede('ANULAR_ORDEN_COMPRA')) {
                            <ion-button size="small" fill="outline" color="danger" [disabled]="trabajando()"
                                        (click)="anular(o)">Anular</ion-button>
                          }
                          @if (puede('APRUEBA_ORDEN_COMPRA')) {
                            <ion-button size="small" color="compras" [disabled]="trabajando()"
                                        (click)="aprobar(o)">Aprobar</ion-button>
                          }
                        }
                        @if (o.estado === 'EMITIDO' && puede('EMITE_HES')) {
                          <ion-button size="small" color="bodega" (click)="recibir(o)">Recibir (HES)</ion-button>
                        }
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
        </sa-table-wrap>
        </div>

        <ul class="oc-cards" aria-label="Órdenes de compra">
          @for (o of datos(); track o.id) {
            <li class="sa-panel oc-card" [class.is-selected]="elegida(o)" (click)="abrir(o)">
              <div class="oc-card__top">
                <a class="oc-num" [routerLink]="['/oc', o.id]" (click)="$event.stopPropagation()">OC {{ o.numdoc }}</a>
                <strong class="num">{{ moneda(o.total) }}</strong>
              </div>
              <div class="oc-card__meta">{{ o.proveedor }}@if (o.ccosto) { · {{ o.ccosto }} }</div>
              @if (o.estado === 'EMITIDO' && porRecibir(o) > 0) {
                <span class="sa-sub sa-sub--warn">Falta recibir {{ moneda(porRecibir(o)) }}</span>
              }
              <div class="oc-card__foot">
                <span class="sa-badge" [class]="'sa-badge sa-badge--' + badge(o).tono">{{ badge(o).texto }}</span>
                <span>{{ fecha(o.fecha) }}</span>
              </div>
              @if (accionesEn(o)) {
                <div class="oc-card__acciones" (click)="$event.stopPropagation()">
                  @if (o.estado === 'PENDIENTE') {
                    @if (puede('ANULAR_ORDEN_COMPRA')) {
                      <ion-button fill="outline" color="danger" [disabled]="trabajando()" (click)="anular(o)">Anular</ion-button>
                    }
                    @if (puede('APRUEBA_ORDEN_COMPRA')) {
                      <ion-button color="compras" [disabled]="trabajando()" (click)="aprobar(o)">Aprobar</ion-button>
                    }
                  }
                  @if (o.estado === 'EMITIDO' && puede('EMITE_HES')) {
                    <ion-button color="bodega" (click)="recibir(o)">Recibir (HES)</ion-button>
                  }
                </div>
              }
            </li>
          }
        </ul>
      </sa-list>
      @if (!cargando() && datos().length && estado() === 'PENDIENTE') {
        <p class="nota">Aprobar pasa la orden a "Por recibir"; recibir registra su HES.</p>
      }
      </section>
      </div>
    </ion-content>

    @if (puede('EMITE_OC')) {
      <ion-footer class="barra-movil">
        <div class="sa-actionbar">
          <ion-button color="compras" routerLink="/oc/nueva">
            <sa-icon name="plus" slot="start" />
            Nueva orden de compra
          </ion-button>
        </div>
      </ion-footer>
    }
  `,
})
export class OrdenesPage {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly alerts = inject(AlertController);

  readonly datos = signal<Oc[]>([]);
  readonly conteos = signal<Record<string, number>>({});
  readonly total = signal(0);
  readonly paginas = signal(1);
  readonly pagina = signal(1);
  readonly buscar = signal('');
  readonly estado = signal('PENDIENTE');
  readonly cargando = signal(false);
  readonly trabajando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  /** Ids of the PENDIENTE orders checked for bulk approval. */
  readonly seleccion = signal<ReadonlySet<number>>(new Set());

  readonly moneda = clp;
  readonly fecha = fechaTabla;
  readonly badge = (o: Oc) => estadoOc(o.estado);
  puede = (f: string) => (this.auth.sesion()?.permisos ?? []).includes(f);
  puedeAprobar = () => this.puede('APRUEBA_ORDEN_COMPRA');
  pct = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;
  ancho = (v: unknown) => Math.max(0, Math.min(100, this.pct(v)));
  porRecibir = (o: Oc) => outstandingAmount(o.neto, o.OC_avance);
  n = (estado: string) => (this.conteos()[estado] ?? 0).toLocaleString('es-CL');
  elegida = (o: Oc) => this.seleccion().has(o.id);
  accionesEn = (o: Oc) =>
    (o.estado === 'PENDIENTE' && (this.puede('ANULAR_ORDEN_COMPRA') || this.puede('APRUEBA_ORDEN_COMPRA')))
    || (o.estado === 'EMITIDO' && this.puede('EMITE_HES'));

  readonly pendientesVisibles = computed(() => this.datos().filter((o) => o.estado === 'PENDIENTE'));
  readonly seleccionadas = computed(() => this.pendientesVisibles().filter((o) => this.seleccion().has(o.id)));
  readonly todasElegidas = computed(() =>
    this.pendientesVisibles().length > 0 && this.seleccionadas().length === this.pendientesVisibles().length);
  readonly textoSeleccion = computed(() => {
    const k = this.seleccionadas().length;
    return k === 1 ? '1 orden seleccionada' : `${k} órdenes seleccionadas`;
  });

  vacioTitulo = () => {
    if (this.buscar()) return 'Sin resultados';
    if (this.estado() === 'PENDIENTE') return 'No hay órdenes por aprobar';
    if (this.estado() === 'EMITIDO') return 'No hay órdenes por recibir';
    return 'Sin órdenes';
  };
  vacioTexto = () => this.buscar()
    ? 'Prueba otro estado o otro texto de búsqueda'
    : 'Revisa "Todas" o crea una nueva orden de compra';

  rango = () => {
    const frase = this.estado() === 'PENDIENTE' ? 'órdenes por aprobar'
      : this.estado() === 'EMITIDO' ? 'órdenes por recibir'
      : this.estado() === 'CERRADO' ? 'órdenes cerradas'
      : 'órdenes';
    return rangoLista(this.pagina(), this.datos().length, this.total(), frase);
  };

  private ultimoFiltro = '';
  private conteosListos = false;

  constructor() {
    // El Inicio abre la lista ya filtrada: /f/EMITE_OC?estado=PENDIENTE.
    // Sin parametro se abre lo que necesita accion; EMITE_HES abre lo que falta recibir.
    const ruta = inject(ActivatedRoute);
    const porDefecto = ruta.snapshot.routeConfig?.path === 'f/EMITE_HES' ? 'EMITIDO' : 'PENDIENTE';
    ruta.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      const estado = q.get('estado');
      if (estado && ESTADOS.includes(estado)) this.estado.set(estado);
      else if (estado === 'TODAS') this.estado.set('');
      else this.estado.set(porDefecto);
    });
    effect(() => {
      const b = this.buscar(); const e = this.estado(); const p = this.pagina();
      // Cambiar el filtro vuelve a la primera pagina sin escribir senales aca.
      const filtro = `${b}|${e}`;
      const pg = filtro !== this.ultimoFiltro ? 1 : p;
      this.ultimoFiltro = filtro;
      void this.cargar(b, e, pg);
    });
  }

  private async cargar(buscar: string, estado: string, pagina: number): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    this.seleccion.set(new Set());
    try {
      const q = new URLSearchParams({ pagina: String(pagina), limite: '50' });
      if (buscar) q.set('buscar', buscar);
      if (estado) q.set('estado', estado);
      const r = await firstValueFrom(
        this.http.get<{ datos: Oc[]; total: number; paginas: number; conteos?: Record<string, number> }>(
          `${API}/compras/oc?${q}`,
        ),
      );
      this.datos.set(r.datos);
      this.total.set(r.total);
      this.paginas.set(r.paginas);
      if (r.conteos) this.conteos.set(r.conteos);
      else await this.asegurarConteos();
    } catch (e: any) {
      this.datos.set([]);
      this.error.set(e?.error?.message ?? 'No se pudieron cargar las órdenes');
    } finally {
      this.cargando.set(false);
    }
  }

  /** El proceso en marcha puede no traer conteos; en ese caso se piden los totales una vez. */
  private async asegurarConteos(): Promise<void> {
    if (this.conteosListos) return;
    const pedir = async (estado: string) => {
      const q = new URLSearchParams({ pagina: '1', limite: '1' });
      if (estado) q.set('estado', estado);
      const r = await firstValueFrom(this.http.get<{ total: number }>(`${API}/compras/oc?${q}`));
      return r.total ?? 0;
    };
    const [total, pendiente, emitido, cerrado] = await Promise.all([
      pedir(''), pedir('PENDIENTE'), pedir('EMITIDO'), pedir('CERRADO'),
    ]);
    this.conteos.set({ TOTAL: total, PENDIENTE: pendiente, EMITIDO: emitido, CERRADO: cerrado });
    this.conteosListos = true;
  }

  /** After an action the tab counts change; the rows stay as they are, with their new state. */
  private async refrescarConteos(): Promise<void> {
    try {
      const r = await firstValueFrom(
        this.http.get<{ conteos?: Record<string, number> }>(`${API}/compras/oc?pagina=1&limite=1`),
      );
      if (r.conteos) { this.conteos.set(r.conteos); return; }
      this.conteosListos = false;
      await this.asegurarConteos();
    } catch {
      // The counts are a hint; the action already succeeded.
    }
  }

  private marcar(o: Oc, estado: string): void {
    this.datos.update((ds) => ds.map((d) => (d.id === o.id ? { ...d, estado } : d)));
    this.seleccion.update((s) => { const n = new Set(s); n.delete(o.id); return n; });
  }

  private mensajeError(e: any, fallback: string): string {
    return e?.error?.message ?? fallback;
  }

  // ------------------------------------------------------------- seleccion

  alternar(o: Oc): void {
    this.seleccion.update((s) => {
      const n = new Set(s);
      if (n.has(o.id)) n.delete(o.id); else n.add(o.id);
      return n;
    });
  }

  elegirTodas(si: boolean): void {
    this.seleccion.set(si ? new Set(this.pendientesVisibles().map((o) => o.id)) : new Set());
  }

  limpiarSeleccion(): void { this.seleccion.set(new Set()); }

  // --------------------------------------------------------------- acciones

  async aprobar(o: Oc): Promise<void> {
    this.trabajando.set(true);
    this.error.set(''); this.mensaje.set('');
    try {
      await firstValueFrom(this.http.post(`${API}/compras/oc/${o.numdoc}/aprobar`, {}));
      this.marcar(o, 'EMITIDO');
      this.mensaje.set(`OC ${o.numdoc} aprobada. Ahora está por recibir.`);
      await this.refrescarConteos();
    } catch (e: any) {
      this.error.set(this.mensajeError(e, `No se pudo aprobar la OC ${o.numdoc}`));
    } finally {
      this.trabajando.set(false);
    }
  }

  async anular(o: Oc): Promise<void> {
    const si = await confirmar(
      this.alerts, `¿Anular la OC ${o.numdoc}?`,
      `${o.proveedor} · ${this.moneda(o.total)}. La orden queda eliminada y no se puede recibir.`,
      'Anular orden', true,
    );
    if (!si) return;
    this.trabajando.set(true);
    this.error.set(''); this.mensaje.set('');
    try {
      await firstValueFrom(
        this.http.post(`${API}/compras/oc/${o.numdoc}/anular`, { cliente: o.cliente }),
      );
      this.marcar(o, 'ELIMINADO');
      this.mensaje.set(`OC ${o.numdoc} anulada.`);
      await this.refrescarConteos();
    } catch (e: any) {
      this.error.set(this.mensajeError(e, `No se pudo anular la OC ${o.numdoc}`));
    } finally {
      this.trabajando.set(false);
    }
  }

  /** Approves the checked orders one by one and reports how many went through. */
  async aprobarSeleccionadas(): Promise<void> {
    const lote = this.seleccionadas();
    if (!lote.length) return;
    this.trabajando.set(true);
    this.error.set(''); this.mensaje.set('');
    let ok = 0;
    const fallas: string[] = [];
    for (const o of lote) {
      try {
        await firstValueFrom(this.http.post(`${API}/compras/oc/${o.numdoc}/aprobar`, {}));
        this.marcar(o, 'EMITIDO');
        ok++;
      } catch (e: any) {
        fallas.push(`OC ${o.numdoc}: ${this.mensajeError(e, 'no se pudo aprobar')}`);
      }
    }
    if (ok) this.mensaje.set(ok === 1 ? '1 orden aprobada.' : `${ok} órdenes aprobadas.`);
    if (fallas.length) {
      this.error.set(`${fallas.length === 1 ? '1 orden no se aprobó' : `${fallas.length} órdenes no se aprobaron`}. ${fallas.join(' · ')}`);
    }
    await this.refrescarConteos();
    this.trabajando.set(false);
  }

  recibir(o: Oc): void {
    void this.router.navigate(['/oc', o.id], { queryParams: { recibir: '1' } });
  }

  abrir(o: Oc): void { void this.router.navigate(['/oc', o.id]); }
}
