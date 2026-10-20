/**
 * BODEGA_MOVIMIENTOS: libro de movimientos.
 *
 * mov_bodega es polimorfica: una misma tabla guarda material, vehiculos,
 * equipos y once tipos mas. Por eso el filtro principal es tipo_vhe.
 */
import { Component, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  IonButton, IonContent, IonInput, IonSearchbar, IonSelect, IonSelectOption,
} from '@ionic/angular/standalone';

import { API, AuthService } from '../core/auth.service';
import { fechaTabla, rangoLista } from '../shared/format';
import type { Bodega } from './stock.page';
import { PageHeaderComponent } from '../shared/page-header.component';
import { SaIcon } from '../shared/sa-icon.component';
import { SaList } from '../shared/sa-list.component';
import { SaPageHead } from '../shared/sa-page-head.component';
import { SaTableWrap } from '../shared/sa-table-wrap.component';
import { pestanasRegistro } from '../shared/workspace-navigation';
import { BodegaCombobox } from './bodega-combobox.component';

interface Mov {
  id: number; numdoc: number; tipoDoc: string; id_bodega: number;
  id_responsable: number; tipo_mov: string; fecha: string; fechaFin: string;
  ccosto: string; tarifa: number; ccosto_ap: string;
  tipo_vhe: string; id_vhe: string; cantidad: number; unidad: string;
  estado: string; nombre: string; descr: string;
}

@Component({
  selector: 'app-movimientos',
  imports: [
    RouterLink, PageHeaderComponent, IonContent, IonSearchbar, IonSelect, IonSelectOption,
    IonButton, IonInput, SaIcon, SaList, SaPageHead, SaTableWrap, BodegaCombobox,
  ],
  styles: [`
    ion-select { max-inline-size: 16rem; }
    ion-input[type="date"] { max-inline-size: 11rem; }
    .sa-chips .sa-chip { min-block-size: 2.75rem; display: inline-flex; align-items: center; gap: var(--sa-space-2); }
    .sa-chips .num { font-weight: 700; }
    .sa-stats { margin-top: var(--sa-space-4); }
    .fila-accion {
      appearance: none; font: inherit; font-size: var(--sa-text-dense); font-weight: 600; cursor: pointer;
      min-block-size: var(--sa-control-h-sm); padding: 0 var(--sa-space-3);
      background: var(--sa-surface); color: var(--sa-crit-fg);
      border: var(--sa-border) solid var(--sa-crit-line); border-radius: var(--sa-radius);
    }
    .fila-accion:hover { background: var(--sa-crit-bg); }
    .fila-accion:focus-visible { outline: var(--sa-focus-ring); outline-offset: var(--sa-focus-offset); }
    .fila-accion--confirmar { background: var(--sa-crit-fg); color: var(--sa-surface); border-color: var(--sa-crit-fg); }
    .fila-accion--confirmar:hover { background: var(--sa-crit-fg); }
    .fila-accion--neutral { color: var(--sa-ink); border-color: var(--sa-border-input); }
    .fila-accion--neutral:hover { background: var(--sa-surface-2); }
    .confirmar { display: inline-flex; align-items: center; gap: var(--sa-space-2); flex-wrap: wrap; }
    .confirmar span { font-size: var(--sa-text-meta); color: var(--sa-ink-soft); }
    @media (pointer: coarse) { .fila-accion { min-block-size: 2.75rem; } }
    .oculto { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  `],
  template: `
    <app-page-header title="Movimientos"></app-page-header>

    <ion-content>
      <div class="page-content page-content--wide">
      <sa-page-head title="Movimientos" area="bodega" icon="move"
                    subtitle="Qué entró y qué salió de bodega. Los totales cuentan todo el filtro, no solo esta página.">
        <div saActions>
          @if (rutaRegistrar(); as r) {
            <ion-button color="bodega" [routerLink]="r"><sa-icon name="plus" slot="start" />Registrar movimiento</ion-button>
          }
        </div>
      </sa-page-head>

      @if (error()) { <div class="sa-notice sa-notice--crit" role="alert">{{ error() }}</div> }
      @if (mensaje()) { <div class="sa-notice sa-notice--ok" role="status">{{ mensaje() }}</div> }

      <div class="sa-stats">
        <div class="sa-stat">
          <div class="sa-stat__label">Movimientos</div>
          <div class="sa-stat__value num">{{ n('TOTAL') }}</div>
          <div class="sa-stat__hint">Con el filtro actual</div>
        </div>
        <div class="sa-stat">
          <div class="sa-stat__label">Entradas</div>
          <div class="sa-stat__value num">{{ n('IN') }}</div>
          <div class="sa-stat__hint">Ingresos a bodega</div>
        </div>
        <div class="sa-stat">
          <div class="sa-stat__label">Salidas</div>
          <div class="sa-stat__value num">{{ n('OUT') }}</div>
          <div class="sa-stat__hint">Entregas y consumos</div>
        </div>
      </div>

      <sa-list [loading]="cargando()" [empty]="datos().length === 0" emptyTitle="Sin movimientos"
               emptyText="Prueba otro rango de fechas u otro filtro"
               [range]="rango()" [page]="pagina()" [pages]="paginas()" (pageChange)="pagina.set($event)">
        <div saFilters>
          <div class="sa-chips" role="group" aria-label="Tipo de movimiento">
            <button type="button" class="sa-chip" [attr.aria-pressed]="tipoMov() === ''"
                    (click)="tipoMov.set('')">Todos <span class="num">{{ n('TOTAL') }}</span></button>
            @for (t of tiposMov(); track t) {
              <button type="button" class="sa-chip" [attr.aria-pressed]="tipoMov() === t"
                      (click)="tipoMov.set(t)">{{ nombreMov(t) }} <span class="num">{{ n(t) }}</span></button>
            }
          </div>
          <ion-input label="Desde" labelPlacement="stacked" fill="outline" type="date"
                     [value]="desde()" (ionChange)="desde.set($any($event).detail.value ?? '')"></ion-input>
          <ion-input label="Hasta" labelPlacement="stacked" fill="outline" type="date"
                     [value]="hasta()" (ionChange)="hasta.set($any($event).detail.value ?? '')"></ion-input>
          <ion-select label="Tipo de ítem" labelPlacement="stacked" fill="outline" interface="popover"
                      [value]="tipoVhe()" (ionChange)="tipoVhe.set($any($event).detail.value)">
            <ion-select-option value="">Todos</ion-select-option>
            @for (t of tipos(); track t) { <ion-select-option [value]="t">{{ t }}</ion-select-option> }
          </ion-select>
          <app-bodega-combobox [bodegas]="bodegas()" [value]="bodega()" (valueChange)="bodega.set($event)" />
          <ion-searchbar placeholder="Código del ítem" [debounce]="350"
                         (ionInput)="idVhe.set($any($event).detail.value ?? '')"></ion-searchbar>
        </div>
        <sa-table-wrap label="Movimientos de bodega">
            <table class="sa-table">
              <thead><tr>
                <th>Fecha</th><th>Movimiento</th><th>Documento</th><th>Tipo</th><th>Ítem</th>
                <th class="num">Cantidad</th><th>Centro de costo</th>
                <th><span class="oculto">Acciones</span></th>
              </tr></thead>
              <tbody>
                @for (m of datos(); track m.id) {
                  <tr>
                    <th scope="row">{{ fecha(m.fecha) }}</th>
                    <td data-label="Movimiento">
                      <span class="sa-badge" [class]="tonoMov(m.tipo_mov)">{{ filaMov(m.tipo_mov) }}</span>
                    </td>
                    <td data-label="Documento">{{ m.tipoDoc }} <span class="code">{{ m.numdoc }}</span></td>
                    <td data-label="Tipo">{{ m.tipo_vhe }}</td>
                    <td class="name" data-label="Ítem">
                      <span class="code">{{ m.id_vhe }}</span>
                      <span class="sa-sub">{{ m.nombre || m.descr }}</span>
                    </td>
                    <td class="num" data-label="Cantidad">{{ m.cantidad }} {{ m.unidad }}</td>
                    <td data-label="Centro de costo"><span class="code">{{ m.ccosto }}</span></td>
                    <td data-label="Acciones">
                      @if (puedeEliminar()) {
                        @if (confirmando() === m.id) {
                          <span class="confirmar" role="group" [attr.aria-label]="'Confirmar eliminación del movimiento ' + m.numdoc">
                            <span>¿Eliminar este movimiento?</span>
                            <button type="button" class="fila-accion fila-accion--confirmar"
                                    [disabled]="eliminando()" (click)="eliminar(m)">Eliminar</button>
                            <button type="button" class="fila-accion fila-accion--neutral"
                                    (click)="confirmando.set(null)">Cancelar</button>
                          </span>
                        } @else {
                          <button type="button" class="fila-accion"
                                  [attr.aria-label]="'Eliminar movimiento ' + m.tipoDoc + ' ' + m.numdoc"
                                  (click)="confirmando.set(m.id)">Eliminar</button>
                        }
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
        </sa-table-wrap>
      </sa-list>
      </div>
    </ion-content>
  `,
})
export class MovimientosPage {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly bodegas = signal<Bodega[]>([]);
  readonly tipos = signal<string[]>([]);
  readonly datos = signal<Mov[]>([]);
  readonly total = signal(0);
  readonly paginas = signal(1);
  readonly pagina = signal(1);
  readonly bodega = signal(0);
  readonly tipoVhe = signal('');
  readonly idVhe = signal('');
  readonly tipoMov = signal('');
  readonly desde = signal('');
  readonly hasta = signal('');
  readonly conteos = signal<Record<string, number>>({});
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  /** Row waiting for the delete confirmation. */
  readonly confirmando = signal<number | null>(null);
  readonly eliminando = signal(false);
  /** First "Registrar movimiento" screen the profile can open. */
  readonly rutaRegistrar = computed(() => {
    const p = pestanasRegistro(this.auth.menu())[0];
    return p ? `/f/${p.codigo}` : null;
  });

  readonly fecha = fechaTabla;
  rango = () => rangoLista(this.pagina(), this.datos().length, this.total(), 'movimientos');
  puedeEliminar = () => (this.auth.sesion()?.permisos ?? []).includes('ELIMINA_MOV_BODEGA');
  tonoMov = (tipo: string) => tipo === 'IN' ? 'sa-badge sa-badge--ok'
    : tipo === 'OUT' ? 'sa-badge sa-badge--warn'
    : 'sa-badge sa-badge--info';
  nombreMov = (tipo: string) => tipo === 'IN' ? 'Entradas' : tipo === 'OUT' ? 'Salidas' : tipo;
  filaMov = (tipo: string) => tipo === 'IN' ? 'Entrada' : tipo === 'OUT' ? 'Salida' : tipo;
  n = (tipo: string) => (this.conteos()[tipo] ?? 0).toLocaleString('es-CL');
  readonly tiposMov = computed(() => {
    const orden = ['IN', 'OUT'];
    const tipos = Object.keys(this.conteos()).filter((t) => t !== 'TOTAL');
    return tipos.sort((a, b) => (orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99) || a.localeCompare(b));
  });
  private ultimoFiltro = '';

  constructor() {
    void this.cargarApoyo();
    effect(() => {
      const b = this.bodega(); const t = this.tipoVhe();
      const i = this.idVhe(); const p = this.pagina();
      const mov = this.tipoMov(); const d = this.desde(); const h = this.hasta();
      const filtro = `${b}|${t}|${i}|${mov}|${d}|${h}`;
      const pg = filtro !== this.ultimoFiltro ? 1 : p;
      this.ultimoFiltro = filtro;
      void this.cargar(b, t, i, pg);
    });
  }

  private async cargarApoyo(): Promise<void> {
    try {
      this.bodegas.set(await firstValueFrom(this.http.get<Bodega[]>(`${API}/bodega/bodegas`)));
      this.tipos.set(await firstValueFrom(this.http.get<string[]>(`${API}/bodega/tipos-vhe`)));
    } catch { /* los filtros son accesorios */ }
  }

  private async cargar(bodega: number, tipo: string, item: string, pagina: number): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const q = new URLSearchParams({ pagina: String(pagina), limite: '50' });
      if (bodega) q.set('bodega', String(bodega));
      if (tipo) q.set('tipo_vhe', tipo);
      if (item.trim()) q.set('id_vhe', item.trim());
      if (this.tipoMov()) q.set('tipo_mov', this.tipoMov());
      if (this.desde()) q.set('desde', this.desde());
      if (this.hasta()) q.set('hasta', this.hasta());
      const r = await firstValueFrom(this.http.get<{
        datos: Mov[]; total: number; paginas: number; conteos?: Record<string, number>;
      }>(`${API}/bodega/movimientos?${q}`));
      this.datos.set(r.datos);
      this.total.set(r.total);
      this.paginas.set(r.paginas);
      this.conteos.set(r.conteos ?? {});
    } catch (e: any) {
      this.datos.set([]);
      this.error.set(e?.error?.message ?? 'No se pudieron cargar los movimientos');
    } finally {
      this.cargando.set(false);
    }
  }

  /** Runs only from the inline confirmation of the row. */
  async eliminar(m: Mov): Promise<void> {
    this.error.set('');
    this.mensaje.set('');
    this.eliminando.set(true);
    try {
      await firstValueFrom(this.http.delete(`${API}/bodega/movimientos/${m.id}`));
      this.confirmando.set(null);
      this.mensaje.set(`Movimiento ${m.tipoDoc} ${m.numdoc} eliminado`);
      await this.cargar(this.bodega(), this.tipoVhe(), this.idVhe(), this.pagina());
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo eliminar');
    } finally {
      this.eliminando.set(false);
    }
  }
}