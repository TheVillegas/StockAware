/**
 * BODEGA_MOVIMIENTOS: libro de movimientos.
 *
 * mov_bodega es polimorfica: una misma tabla guarda material, vehiculos,
 * equipos y once tipos mas. Por eso el filtro principal es tipo_vhe.
 */
import { Component, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  IonButton, IonContent, IonSearchbar,
  IonSelect, IonSelectOption, IonSkeletonText,
} from '@ionic/angular/standalone';

import { API, AuthService } from '../core/auth.service';
import type { Bodega } from './stock.page';
import { PageHeaderComponent } from '../shared/page-header.component';

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
    PageHeaderComponent, IonContent,
    IonSearchbar, IonSelect, IonSelectOption, IonSkeletonText, IonButton,
  ],
  styles: [`
    ion-select { max-width: 260px; }
    .sa-toolbar ion-searchbar { flex: 1; min-width: 200px; }
    .mov { display: inline-block; padding: 1px 6px; border-radius: var(--sa-radius-pill); font-size: var(--sa-text-label); font-weight: 600; }
    .m-IN { background: var(--sa-ok-bg); color: var(--sa-ok-fg); }
    .m-OUT { background: var(--sa-warn-bg); color: var(--sa-warn-fg); }
    .paginas { display: flex; gap: var(--sa-space-2); align-items: center; justify-content: center; padding: var(--sa-space-3); }
    .skeleton-table { padding: 0 var(--sa-space-3) var(--sa-space-5); }
    .skeleton-table ion-skeleton-text { margin-bottom: var(--sa-space-1); }
  `],
  template: `
    <app-page-header title="Movimientos de bodega"></app-page-header>

    <ion-content>
      <div class="page-content page-content--wide">
      @if (error()) { <div class="sa-notice sa-notice--crit">{{ error() }}</div> }

      <div class="sa-toolbar">
        <ion-select label="Tipo" labelPlacement="stacked" fill="outline" interface="popover"
                    [value]="tipoVhe()" (ionChange)="tipoVhe.set($any($event).detail.value)">
          <ion-select-option value="">Todos</ion-select-option>
          @for (t of tipos(); track t) { <ion-select-option [value]="t">{{ t }}</ion-select-option> }
        </ion-select>
        <ion-select label="Bodega" labelPlacement="stacked" fill="outline" interface="popover"
                    [value]="bodega()" (ionChange)="bodega.set($any($event).detail.value)">
          <ion-select-option [value]="0">Todas</ion-select-option>
          @for (b of bodegas(); track b.bodega) {
            <ion-select-option [value]="b.bodega">{{ b.descr }}</ion-select-option>
          }
        </ion-select>
        <ion-searchbar placeholder="Código del ítem" [debounce]="350"
                       (ionInput)="idVhe.set($any($event).detail.value ?? '')"></ion-searchbar>
        <span class="sa-count">{{ total() }} movimientos</span>
      </div>

      @if (cargando()) {
        <div class="skeleton-table">
          <ion-skeleton-text [animated]="true" style="width: 100%; height: 24px;"></ion-skeleton-text>
          <ion-skeleton-text [animated]="true" style="width: 100%; height: 24px;"></ion-skeleton-text>
          <ion-skeleton-text [animated]="true" style="width: 100%; height: 24px;"></ion-skeleton-text>
          <ion-skeleton-text [animated]="true" style="width: 100%; height: 24px;"></ion-skeleton-text>
          <ion-skeleton-text [animated]="true" style="width: 100%; height: 24px;"></ion-skeleton-text>
        </div>
      } @else if (datos().length === 0) {
        <div class="sa-empty">
          <div class="title">Sin movimientos</div>
        </div>
      } @else {
        <div class="sa-table-wrap">
          <table class="sa-table">
            <thead><tr>
              <th>Fecha</th><th>Doc</th><th class="code">Nº</th><th>Tipo</th><th class="code">Ítem</th>
              <th>Descripción</th><th class="num">Cantidad</th><th>Centro costo</th>
              <th></th><th></th>
            </tr></thead>
            <tbody>
              @for (m of datos(); track m.id) {
                <tr>
                  <td>{{ m.fecha?.slice(0, 10) }}</td>
                  <td>{{ m.tipoDoc }}</td>
                  <td class="code">{{ m.numdoc }}</td>
                  <td>{{ m.tipo_vhe }}</td>
                  <td class="code">{{ m.id_vhe }}</td>
                  <td>{{ m.nombre || m.descr }}</td>
                  <td class="num">{{ m.cantidad }} {{ m.unidad }}</td>
                  <td>{{ m.ccosto }}</td>
                  <td><span class="mov" [class]="'mov m-' + m.tipo_mov">{{ m.tipo_mov }}</span></td>
                  <td>
                    @if (puedeEliminar()) {
                      <ion-button size="small" fill="outline" color="danger"
                                  (click)="eliminar(m)">Eliminar</ion-button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (paginas() > 1) {
          <div class="paginas">
            <ion-button size="small" fill="outline" [disabled]="pagina() <= 1"
                        (click)="pagina.set(pagina() - 1)">Anterior</ion-button>
            <span class="sa-count">{{ pagina() }} / {{ paginas() }}</span>
            <ion-button size="small" fill="outline" [disabled]="pagina() >= paginas()"
                        (click)="pagina.set(pagina() + 1)">Siguiente</ion-button>
          </div>
        }
      }
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
  readonly cargando = signal(false);
  readonly error = signal('');

  puedeEliminar = () => (this.auth.sesion()?.permisos ?? []).includes('ELIMINA_MOV_BODEGA');
  private ultimoFiltro = '';

  constructor() {
    void this.cargarApoyo();
    effect(() => {
      const b = this.bodega(); const t = this.tipoVhe();
      const i = this.idVhe(); const p = this.pagina();
      const filtro = `${b}|${t}|${i}`;
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
      const r = await firstValueFrom(this.http.get<{
        datos: Mov[]; total: number; paginas: number;
      }>(`${API}/bodega/movimientos?${q}`));
      this.datos.set(r.datos);
      this.total.set(r.total);
      this.paginas.set(r.paginas);
    } catch (e: any) {
      this.datos.set([]);
      this.error.set(e?.error?.message ?? 'No se pudieron cargar los movimientos');
    } finally {
      this.cargando.set(false);
    }
  }

  async eliminar(m: Mov): Promise<void> {
    this.error.set('');
    try {
      await firstValueFrom(this.http.delete(`${API}/bodega/movimientos/${m.id}`));
      await this.cargar(this.bodega(), this.tipoVhe(), this.idVhe(), this.pagina());
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo eliminar');
    }
  }
}