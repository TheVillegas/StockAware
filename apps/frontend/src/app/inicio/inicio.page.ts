/**
 * Inicio: the supply flow with real totals and the three lists that ask for
 * action today (stock that ran out, orders to approve, invoices to split).
 *
 * Every number comes from the backend; a block the profile cannot act on is
 * not rendered (pendientesPerfil / construirNavegacion decide that).
 */
import { Component, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IonButton, IonContent, IonSkeletonText } from '@ionic/angular/standalone';
import { API, AuthService } from '../core/auth.service';
import { clp, fechaTabla } from '../shared/format';
import { PageHeaderComponent } from '../shared/page-header.component';
import { SaIcon } from '../shared/sa-icon.component';
import { SaPageHead } from '../shared/sa-page-head.component';
import { daysSince, suggestedOrderQty } from '../shared/consulta';
import { accionesCrear, construirNavegacion, pendientesPerfil } from '../shared/workspace-navigation';

interface Oc {
  id: number; numdoc: number; fecha: string; proveedor: string; ccosto: string | null; total: number | string;
}
interface Factura { id: number; numdoc: number; fecha: string; proveedor: string; total: number | string; }
interface FilaStock {
  cod_material: string; nombre: string; bodega: string; id_bodega: number; unidad: string;
  stock: number | string; stock_minimo: number | string; consumo_diario: number | string | null;
}
interface Pagina<T> { datos: T[]; total: number; conteos?: Record<string, number>; }
type Carga = 'cargando' | 'listo' | 'error';

interface Etapa {
  key: string; valor: number | null; estado: Carga; titulo: string; detalle: string;
  ruta: string; query: Record<string, string> | null; alerta: boolean;
}

/** Rows the backend returns at most from bodega/stock. */
const TOPE_STOCK = 500;
/** Largest page the list endpoints accept. */
const PAGINA_MAX = 200;
const FILAS = 3;

const num = (n: unknown): string => Number(n ?? 0).toLocaleString('es-CL');
const dias = (n: number): string => (n === 1 ? '1 día' : `${num(n)} días`);
const porFecha = <T extends { fecha: string; numdoc: number }>(a: T, b: T): number =>
  String(a.fecha).localeCompare(String(b.fecha)) || a.numdoc - b.numdoc;
const mensaje = (e: unknown, defecto: string): string => {
  const m = (e as { error?: { message?: unknown } })?.error?.message;
  return Array.isArray(m) ? m.join('. ') : typeof m === 'string' && m ? m : defecto;
};

@Component({
  selector: 'app-inicio',
  imports: [PageHeaderComponent, SaPageHead, SaIcon, IonContent, IonButton, IonSkeletonText, RouterLink],
  styles: [`
    h2 { margin: 0; font-size: var(--sa-text-title); font-weight: 700; }
    .cabeza { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sa-space-3);
      padding: var(--sa-space-4) var(--sa-space-4) var(--sa-space-3); }
    .cabeza p { margin: var(--sa-space-1) 0 0; font-size: var(--sa-text-dense); color: var(--sa-ink-soft); }
    .cabeza p strong { color: var(--sa-ink); }
    .marca { inline-size: 2.25rem; block-size: 2.25rem; flex: none; display: flex; align-items: center;
      justify-content: center; border-radius: var(--sa-radius); color: var(--sa-area); background: var(--sa-area-tint); }

    .flujo { margin-bottom: var(--sa-space-4); }
    .flujo .cabeza { align-items: baseline; flex-wrap: wrap; }
    .flujo .cabeza span { font-size: var(--sa-text-dense); color: var(--sa-ink-soft); }
    .etapas { list-style: none; margin: 0; padding: 0 var(--sa-space-4); display: grid; gap: var(--sa-space-3);
      grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .etapa { display: flex; flex-direction: column; gap: var(--sa-space-1); block-size: 100%; box-sizing: border-box;
      padding: var(--sa-space-3) var(--sa-space-4); border-radius: var(--sa-radius); color: var(--sa-ink);
      text-decoration: none; background: var(--sa-surface-2); border: var(--sa-border) solid var(--sa-line); }
    a.etapa:hover { border-color: var(--sa-area); }
    a.etapa:focus-visible, a.fila:focus-visible, .fila a:focus-visible, .pie a:focus-visible {
      outline: var(--sa-ep1-border-focus) solid var(--sa-ep1-primary); outline-offset: var(--sa-focus-offset); }
    .etapa__valor { font-size: var(--sa-text-kpi); font-weight: 700; line-height: 1.15; letter-spacing: -0.01em; }
    .etapa__titulo { font-size: var(--sa-text-body); font-weight: 600; }
    .etapa__detalle { font-size: var(--sa-text-meta); color: var(--sa-ink-soft); }
    .etapa--alerta { background: var(--sa-warn-bg); border-color: var(--sa-warn-line); }
    .etapa--alerta .etapa__valor, .etapa--alerta .etapa__detalle { color: var(--sa-warn-fg); }
    .etapa--error .etapa__valor { font-size: var(--sa-text-body); color: var(--sa-crit-fg); }
    .etapa ion-skeleton-text { inline-size: 4rem; block-size: var(--sa-text-kpi); margin: 0; }
    .cuello { margin: 0; padding: var(--sa-space-3) var(--sa-space-4) var(--sa-space-4); font-size: var(--sa-text-body); }

    .sa-panel { display: flex; flex-direction: column; overflow: hidden; }
    .fila { display: flex; align-items: center; justify-content: space-between; gap: var(--sa-space-3);
      min-block-size: 2.75rem; padding: var(--sa-space-3) var(--sa-space-4); border-top: var(--sa-border) solid var(--sa-line);
      color: var(--sa-ink); text-decoration: none; font-size: var(--sa-text-body); }
    a.fila:hover { background: var(--sa-surface-2); }
    .fila__texto { display: flex; flex-direction: column; gap: 0.125rem; min-inline-size: 0; }
    .fila__texto a { color: var(--sa-ink); text-decoration: none; }
    .fila__texto a:hover { text-decoration: underline; }
    .fila small { font-size: var(--sa-text-meta); color: var(--sa-ink-soft); }
    .fila__dato { flex: none; font-weight: 700; text-align: end; }
    .fila__accion { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: var(--sa-space-1); }
    .fila__accion ion-button { margin: 0; min-block-size: 2.75rem; --border-radius: var(--sa-radius); }
    .fila__error { font-size: var(--sa-text-meta); color: var(--sa-crit-fg); max-inline-size: 16rem; text-align: end; }
    .codigo { font-family: var(--sa-font-mono); font-size: var(--sa-text-dense); }
    .pie { margin-top: auto; padding: var(--sa-space-3) var(--sa-space-4) var(--sa-space-4);
      border-top: var(--sa-border) solid var(--sa-line); }
    .pie ion-button { margin: 0; min-block-size: 2.75rem; --border-radius: var(--sa-radius); }
    .pie a { display: inline-flex; align-items: center; gap: var(--sa-space-1); min-block-size: 2.75rem;
      font-weight: 600; color: var(--sa-area); text-decoration: none; }
    .pie a:hover { text-decoration: underline; }
    .aviso { margin: 0; padding: var(--sa-space-3) var(--sa-space-4) var(--sa-space-4); border-top: var(--sa-border) solid var(--sa-line);
      font-size: var(--sa-text-body); color: var(--sa-ink-soft); }
    .aviso--error { color: var(--sa-crit-fg); }
    .aviso--ok { color: var(--sa-ok-fg); }
    .carga { padding: var(--sa-space-3) var(--sa-space-4); border-top: var(--sa-border) solid var(--sa-line); }
    .carga ion-skeleton-text { block-size: 2.25rem; margin: var(--sa-space-1) 0; }
    .sin-accesos { color: var(--sa-ink-soft); }

    @media (max-width: 1100px) { .etapas { grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr)); } }
    @media (max-width: 767.98px) {
      .etapas { grid-template-columns: 1fr; padding: 0 var(--sa-space-3); }
      .etapa { flex-direction: row; flex-wrap: wrap; align-items: baseline; column-gap: var(--sa-space-3); }
      .etapa__valor { font-size: var(--sa-text-page); min-inline-size: 4.5rem; }
      .etapa__detalle { flex-basis: 100%; }
      .fila { flex-wrap: wrap; }
      .fila__accion { flex-direction: row; align-items: center; }
    }
  `],
  template: `
    <app-page-header title="Inicio"></app-page-header>

    <ion-content>
      <main class="page-content page-content--wide">
        <sa-page-head [title]="'Hola, ' + (auth.sesion()?.nombre ?? '')" [subtitle]="subtitulo()" area="inicio">
          <div saActions>
            @if (registrar(); as r) {
              <ion-button fill="outline" color="medium" [routerLink]="r.ruta">
                <sa-icon slot="start" name="move" [size]="18" />Registrar movimiento
              </ion-button>
            }
            @if (nuevaOc(); as oc) {
              <ion-button color="compras" [routerLink]="oc.ruta">
                <sa-icon slot="start" name="plus" [size]="18" />Nueva orden de compra
              </ion-button>
            }
          </div>
        </sa-page-head>

        @if (etapas().length) {
          <section class="sa-panel flujo" aria-labelledby="flujo">
            <div class="cabeza">
              <h2 id="flujo">Flujo de abastecimiento</h2>
              <span>De la orden de compra al gasto por centro de costo</span>
            </div>
            <ol class="etapas">
              @for (e of etapas(); track e.key) {
                <li>
                  <a class="etapa" [class.etapa--alerta]="e.alerta" [class.etapa--error]="e.estado === 'error'"
                     [attr.data-area]="e.key.startsWith('oc') ? 'compras' : 'finanzas'"
                     [routerLink]="e.ruta" [queryParams]="e.query">
                    @switch (e.estado) {
                      @case ('cargando') { <ion-skeleton-text [animated]="true" /> }
                      @case ('error') { <span class="etapa__valor">Sin datos</span> }
                      @default { <strong class="etapa__valor num">{{ num(e.valor) }}</strong> }
                    }
                    <span class="etapa__titulo">{{ e.titulo }}</span>
                    <span class="etapa__detalle">{{ e.detalle }}</span>
                  </a>
                </li>
              }
            </ol>
            @if (cuello(); as frase) { <p class="cuello">{{ frase }}</p> }
          </section>
        }

        @if (paneles().size) {
          <div class="sa-panels">
            @if (paneles().has('reponer')) {
              <section class="sa-panel" data-area="bodega" aria-labelledby="agotados">
                <div class="cabeza">
                  <div>
                    <h2 id="agotados">Se agotó y se sigue usando</h2>
                    @if (agotados(); as a) {
                      <p><strong class="num">{{ num(a.length) }}{{ stockTope() ? '+' : '' }}</strong>
                        {{ a.length === 1 ? 'material' : 'materiales' }} sin stock con consumo en el último año</p>
                    }
                  </div>
                  <span class="marca"><sa-icon name="warehouse" [size]="18" /></span>
                </div>
                @switch (cargaStock()) {
                  @case ('cargando') { <div class="carga"><ion-skeleton-text [animated]="true" /><ion-skeleton-text [animated]="true" /><ion-skeleton-text [animated]="true" /></div> }
                  @case ('error') { <p class="aviso aviso--error" role="alert">{{ errorStock() }}</p> }
                  @default {
                    @for (f of agotados()!.slice(0, FILAS); track f.cod_material + f.id_bodega) {
                      <a class="fila" routerLink="/f/MATERIAL_X_BODEGA" [queryParams]="{ bajo: '1' }">
                        <span class="fila__texto">
                          <span><span class="codigo">{{ f.cod_material }}</span> {{ f.nombre }}</span>
                          <small>Usa {{ semanal(f) }} {{ f.unidad }} por semana · {{ f.bodega }}</small>
                        </span>
                        <strong class="fila__dato num">Pedir {{ num(pedir(f)) }}</strong>
                      </a>
                    } @empty {
                      <p class="aviso aviso--ok">Ningún material en uso está agotado.</p>
                    }
                    <div class="pie">
                      <ion-button color="bodega" routerLink="/f/MATERIAL_X_BODEGA" [queryParams]="{ bajo: '1' }">
                        {{ agotados()!.length ? 'Revisar y pedir' : 'Ver stock bajo el mínimo' }}
                      </ion-button>
                    </div>
                  }
                }
              </section>
            }

            @if (paneles().has('oc-aprobar')) {
              <section class="sa-panel" data-area="compras" aria-labelledby="aprobar">
                <div class="cabeza">
                  <div>
                    <h2 id="aprobar">Órdenes por aprobar</h2>
                    @if (porAprobar() !== null) {
                      <p><strong class="num">{{ num(porAprobar()) }}</strong>
                        {{ porAprobar() === 1 ? 'orden' : 'órdenes' }}@if (montoPendiente(); as m) { · {{ m }} en total }</p>
                    }
                  </div>
                  <span class="marca"><sa-icon name="orders" [size]="18" /></span>
                </div>
                @switch (cargaOc()) {
                  @case ('cargando') { <div class="carga"><ion-skeleton-text [animated]="true" /><ion-skeleton-text [animated]="true" /><ion-skeleton-text [animated]="true" /></div> }
                  @case ('error') { <p class="aviso aviso--error" role="alert">{{ errorOc() }}</p> }
                  @default {
                    @for (o of ocsPendientes(); track o.numdoc) {
                      @let hecha = aprobadas().has(o.numdoc);
                      <div class="fila">
                        <span class="fila__texto">
                          <a [routerLink]="['/oc', o.id]">OC <span class="num">{{ o.numdoc }}</span> · {{ o.proveedor || 'Sin proveedor' }}</a>
                          <small>{{ fecha(o.fecha) }}@if (o.ccosto) { · <span class="codigo">{{ o.ccosto }}</span> }</small>
                        </span>
                        <span class="fila__accion">
                          <strong class="fila__dato num">{{ clp(o.total) }}</strong>
                          <ion-button size="small" [color]="hecha ? 'medium' : 'compras'" [fill]="hecha ? 'outline' : 'solid'"
                                      [disabled]="hecha || aprobando() === o.numdoc" (click)="aprobar(o)"
                                      [attr.aria-label]="(hecha ? 'Orden aprobada: ' : 'Aprobar orden ') + o.numdoc">
                            @if (hecha) { <sa-icon slot="start" name="check" [size]="16" />Aprobada }
                            @else { {{ aprobando() === o.numdoc ? 'Aprobando…' : 'Aprobar' }} }
                          </ion-button>
                          @if (errores()[o.numdoc]; as err) { <span class="fila__error" role="alert">{{ err }}</span> }
                        </span>
                      </div>
                    } @empty {
                      <p class="aviso aviso--ok">No hay órdenes esperando aprobación.</p>
                    }
                    @if (ordenes(); as r) {
                      <div class="pie">
                        <a [routerLink]="r.ruta" [queryParams]="{ estado: 'PENDIENTE' }">
                          {{ porAprobar() ? 'Ver las ' + num(porAprobar()) + ' órdenes' : 'Ver órdenes de compra' }}
                          <sa-icon name="chevron-right" [size]="16" />
                        </a>
                      </div>
                    }
                  }
                }
              </section>
            }

            @if (paneles().has('facturas')) {
              <section class="sa-panel" data-area="finanzas" aria-labelledby="facturas">
                <div class="cabeza">
                  <div>
                    <h2 id="facturas">Facturas esperando reparto</h2>
                    @if (aceptadas() !== null) {
                      <p><strong class="num">{{ num(aceptadas()) }}</strong>
                        {{ aceptadas() === 1 ? 'factura' : 'facturas' }} · las más antiguas primero</p>
                    }
                  </div>
                  <span class="marca"><sa-icon name="split" [size]="18" /></span>
                </div>
                @switch (cargaFacturas()) {
                  @case ('cargando') { <div class="carga"><ion-skeleton-text [animated]="true" /><ion-skeleton-text [animated]="true" /><ion-skeleton-text [animated]="true" /></div> }
                  @case ('error') { <p class="aviso aviso--error" role="alert">{{ errorFacturas() }}</p> }
                  @default {
                    @for (f of antiguas(); track f.id) {
                      <a class="fila" routerLink="/f/DOC_DISTRIBUIR" [queryParams]="{ estado: 'ACEPTADO' }">
                        <span class="fila__texto">
                          <span>Factura <span class="num">{{ f.numdoc }}</span> · {{ f.proveedor || 'Sin proveedor' }}</span>
                          <small>{{ fecha(f.fecha) }} · {{ clp(f.total) }}</small>
                        </span>
                        @let d = espera(f);
                        @if (d !== null) { <strong class="fila__dato num">{{ dias(d) }}</strong> }
                      </a>
                    } @empty {
                      <p class="aviso aviso--ok">Todas las facturas aceptadas ya están distribuidas.</p>
                    }
                    <div class="pie">
                      <a routerLink="/f/DOC_DISTRIBUIR" [queryParams]="{ estado: 'ACEPTADO' }">
                        Ir a distribuir <sa-icon name="chevron-right" [size]="16" />
                      </a>
                    </div>
                  }
                }
              </section>
            }
          </div>
        }

        @if (!etapas().length && !paneles().size && !registrar() && !nuevaOc()) {
          <p class="sin-accesos">Tu perfil no tiene tareas de abastecimiento. Usa el menú para abrir tus pantallas.</p>
        }
      </main>
    </ion-content>
  `,
})
export class InicioPage {
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  readonly FILAS = FILAS;
  readonly num = num;
  readonly dias = dias;
  readonly clp = clp;
  readonly fecha = fechaTabla;

  readonly navegacion = computed(() => construirNavegacion(this.auth.menu()));
  private readonly entradas = computed(() =>
    new Map(this.navegacion().flatMap((s) => s.entradas).map((e) => [e.key, e])));
  /** Keys of the action lists this profile may resolve. */
  readonly paneles = computed(() => new Set(
    pendientesPerfil(this.navegacion(), this.auth.sesion()?.permisos ?? []).map((p) => p.key)));
  readonly ordenes = computed(() => this.entradas().get('ordenes') ?? null);
  readonly registrar = computed(() => this.entradas().get('registrar') ?? null);
  readonly nuevaOc = computed(() => accionesCrear(this.auth.menu()).find((a) => a.key === 'oc') ?? null);

  // Compras
  readonly cargaOc = signal<Carga>('cargando');
  readonly errorOc = signal('');
  readonly conteosOc = signal<Record<string, number> | null>(null);
  private readonly pendientesOc = signal<Oc[]>([]);
  readonly aprobadas = signal<Set<number>>(new Set());
  readonly aprobando = signal<number | null>(null);
  readonly errores = signal<Record<number, string>>({});

  // Finanzas
  readonly cargaFacturas = signal<Carga>('cargando');
  readonly errorFacturas = signal('');
  readonly aceptadas = signal<number | null>(null);
  readonly distribuidas = signal<number | null>(null);
  readonly antiguas = signal<Factura[]>([]);

  // Bodega
  readonly cargaStock = signal<Carga>('cargando');
  readonly errorStock = signal('');
  readonly agotados = signal<FilaStock[] | null>(null);
  readonly stockTope = signal(false);

  readonly porAprobar = computed(() => this.conteosOc()?.['PENDIENTE'] ?? (this.cargaOc() === 'listo' ? 0 : null));

  /** The oldest pending orders first, the ones waiting longest. */
  readonly ocsPendientes = computed(() => [...this.pendientesOc()].sort(porFecha).slice(0, FILAS));

  /** Sum of pending orders, only when every pending order was received. */
  readonly montoPendiente = computed(() => {
    const filas = this.pendientesOc(); const n = this.porAprobar();
    if (!filas.length || n === null || filas.length < n) return '';
    return clp(filas.reduce((s, o) => s + Number(o.total || 0), 0));
  });

  readonly etapas = computed<Etapa[]>(() => {
    const out: Etapa[] = [];
    const ord = this.ordenes();
    if (ord) {
      const c = this.conteosOc(); const estado = this.cargaOc();
      const pend = this.pendientesOc();
      const masAntigua = c && pend.length && pend.length >= (c['PENDIENTE'] ?? 0)
        ? [...pend].sort(porFecha)[0].fecha : '';
      const pagadas = c?.['PAGO'] ?? 0;
      const base = { estado, ruta: ord.ruta, alerta: false };
      out.push(
        { ...base, key: 'oc-pendiente', valor: c?.['PENDIENTE'] ?? 0, titulo: 'Órdenes por aprobar',
          detalle: masAntigua ? `La más antigua espera desde el ${fechaTabla(masAntigua)}` : 'Esperan aprobación para emitirse',
          query: { estado: 'PENDIENTE' } },
        { ...base, key: 'oc-emitido', valor: c?.['EMITIDO'] ?? 0, titulo: 'Emitidas por recibir',
          detalle: 'Falta registrar su HES', query: { estado: 'EMITIDO' } },
        { ...base, key: 'oc-cerrado', valor: c?.['CERRADO'] ?? 0, titulo: 'Recibidas completas',
          detalle: pagadas ? `Más ${num(pagadas)} pagadas` : 'Con toda su HES registrada', query: { estado: 'CERRADO' } },
      );
    }
    const dist = this.entradas().get('distribucion');
    if (dist) {
      const estado = this.cargaFacturas();
      const vieja = this.antiguas()[0];
      const d = vieja ? this.espera(vieja) : null;
      const balance = this.entradas().get('balance');
      out.push(
        { key: 'fac-aceptado', valor: this.aceptadas(), estado, ruta: dist.ruta, query: { estado: 'ACEPTADO' },
          titulo: 'Facturas por distribuir', alerta: this.cuelloEnReparto(),
          detalle: d !== null ? `La más antigua lleva ${dias(d)}` : 'Aceptadas sin reparto a centros de costo' },
        { key: 'fac-distribuido', valor: this.distribuidas(), estado,
          ruta: balance ? balance.ruta : dist.ruta, query: balance ? null : { estado: 'DISTRIBUIDO' },
          titulo: 'Facturas distribuidas', alerta: false, detalle: 'Ya suman al balance por centro de costo' },
      );
    }
    return out;
  });

  /** Invoice backlog against what was already split; computed, never fixed text. */
  readonly cuello = computed(() => {
    const a = this.aceptadas(); const d = this.distribuidas();
    if (a === null || d === null) return '';
    if (a === 0) return 'No hay facturas esperando reparto: el flujo está al día.';
    if (d === 0) return `El cuello de botella está en el reparto de facturas: hay ${num(a)} esperando y ninguna distribuida.`;
    const razon = Math.round(a / d);
    if (razon >= 1) {
      return `El cuello de botella está en el reparto de facturas: por cada factura distribuida hay ${num(razon)} esperando.`;
    }
    return `El reparto de facturas avanza: ${num(d)} distribuidas y ${num(a)} por distribuir.`;
  });

  readonly subtitulo = computed(() => {
    const hoy = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
    const fechaHoy = hoy.charAt(0).toUpperCase() + hoy.slice(1);
    const p = this.paneles();
    const frentes = [
      p.has('reponer') && this.cargaStock() === 'listo' ? (this.agotados()?.length ?? 0) : null,
      p.has('oc-aprobar') && this.cargaOc() === 'listo' ? (this.porAprobar() ?? 0) : null,
      p.has('facturas') && this.cargaFacturas() === 'listo' ? (this.aceptadas() ?? 0) : null,
    ].filter((n): n is number => n !== null);
    if (!frentes.length) return fechaHoy;
    const abiertos = frentes.filter((n) => n > 0).length;
    if (!abiertos) return `${fechaHoy} · todo al día`;
    return `${fechaHoy} · ${abiertos} ${abiertos === 1 ? 'frente necesita' : 'frentes necesitan'} tu atención`;
  });

  private pedidos = '';

  constructor() {
    effect(() => {
      // The menu arrives after login: load once per set of visible blocks.
      const tieneOc = !!this.ordenes(); const tieneDist = this.entradas().has('distribucion');
      const p = this.paneles();
      const firma = [tieneOc, tieneDist, ...[...p].sort()].join('|');
      if ((!tieneOc && !tieneDist && !p.size) || firma === this.pedidos) return;
      this.pedidos = firma;
      if (tieneOc || p.has('oc-aprobar')) void this.cargarOc(p.has('oc-aprobar'));
      if (tieneDist || p.has('facturas')) void this.cargarFacturas(p.has('facturas'));
      if (p.has('reponer')) void this.cargarStock();
    });
  }

  /** One call: the PENDIENTE page carries `conteos` for every order state. */
  private async cargarOc(conFilas: boolean, refrescar = false): Promise<void> {
    if (!refrescar) this.cargaOc.set('cargando');
    try {
      const r = await firstValueFrom(this.http.get<Pagina<Oc>>(
        `${API}/compras/oc?estado=PENDIENTE&pagina=1&limite=${conFilas ? PAGINA_MAX : 1}`));
      this.conteosOc.set(r.conteos ?? { PENDIENTE: r.total });
      if (conFilas && !refrescar) this.pendientesOc.set(r.datos ?? []);
      this.cargaOc.set('listo');
    } catch (e) {
      if (refrescar) return;
      this.errorOc.set(mensaje(e, 'No se pudieron cargar las órdenes de compra. Recarga la página para intentarlo de nuevo.'));
      this.cargaOc.set('error');
    }
  }

  private async cargarFacturas(conFilas: boolean): Promise<void> {
    this.cargaFacturas.set('cargando');
    const total = (estado: string) => firstValueFrom(this.http.get<Pagina<Factura>>(
      `${API}/distribucion?estado=${estado}&pagina=1&limite=1`)).then((r) => r.total ?? 0);
    try {
      const [a, d] = await Promise.all([total('ACEPTADO'), total('DISTRIBUIDO')]);
      this.aceptadas.set(a);
      this.distribuidas.set(d);
      if (conFilas && a > 0) this.antiguas.set(await this.facturasAntiguas(a));
      this.cargaFacturas.set('listo');
    } catch (e) {
      this.errorFacturas.set(mensaje(e, 'No se pudieron cargar las facturas. Recarga la página para intentarlo de nuevo.'));
      this.cargaFacturas.set('error');
    }
  }

  /**
   * The list endpoint sorts by number, newest first, so the oldest invoices
   * sit on the last pages; those are sorted by date here.
   */
  private async facturasAntiguas(total: number): Promise<Factura[]> {
    const pagina = (n: number) => firstValueFrom(this.http.get<Pagina<Factura>>(
      `${API}/distribucion?estado=ACEPTADO&pagina=${n}&limite=${PAGINA_MAX}`)).then((r) => r.datos ?? []);
    const ultima = Math.max(1, Math.ceil(total / PAGINA_MAX));
    let filas = await pagina(ultima);
    if (filas.length < FILAS && ultima > 1) filas = [...(await pagina(ultima - 1)), ...filas];
    return filas.sort(porFecha).slice(0, FILAS);
  }

  private async cargarStock(): Promise<void> {
    this.cargaStock.set('cargando');
    try {
      const filas = await firstValueFrom(this.http.get<FilaStock[]>(`${API}/bodega/stock?bajoMinimo=true`));
      this.stockTope.set(filas.length >= TOPE_STOCK);
      this.agotados.set(filas
        .filter((f) => Number(f.stock) <= 0 && Number(f.consumo_diario ?? 0) > 0)
        .sort((a, b) => Number(b.consumo_diario) - Number(a.consumo_diario)));
      this.cargaStock.set('listo');
    } catch (e) {
      this.errorStock.set(mensaje(e, 'No se pudo cargar el stock. Recarga la página para intentarlo de nuevo.'));
      this.cargaStock.set('error');
    }
  }

  async aprobar(o: Oc): Promise<void> {
    if (this.aprobando() !== null || this.aprobadas().has(o.numdoc)) return;
    this.aprobando.set(o.numdoc);
    this.errores.update((m) => { const resto = { ...m }; delete resto[o.numdoc]; return resto; });
    try {
      await firstValueFrom(this.http.post(`${API}/compras/oc/${o.numdoc}/aprobar`, {}));
      this.aprobadas.update((s) => new Set(s).add(o.numdoc));
      await this.cargarOc(false, true);
    } catch (e) {
      this.errores.update((m) => ({ ...m, [o.numdoc]: mensaje(e, `No se pudo aprobar la OC ${o.numdoc}.`) }));
    } finally {
      this.aprobando.set(null);
    }
  }

  private cuelloEnReparto(): boolean {
    const a = this.aceptadas(); const d = this.distribuidas();
    return a !== null && d !== null && a > 0 && (d === 0 || a / d >= 1);
  }

  espera(f: Factura): number | null {
    return daysSince(f.fecha);
  }

  pedir(f: FilaStock): number {
    return suggestedOrderQty(f.stock, f.stock_minimo, f.consumo_diario);
  }

  semanal(f: FilaStock): string {
    const s = Number(f.consumo_diario ?? 0) * 7;
    return s >= 10 ? num(Math.round(s)) : s.toLocaleString('es-CL', { maximumFractionDigits: 1 });
  }
}
