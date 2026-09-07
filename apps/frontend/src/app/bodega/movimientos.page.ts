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
  IonButton, IonButtons, IonContent, IonHeader, IonMenuButton, IonSearchbar,
  IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';

import { API, AuthService } from '../core/auth.service';
import type { Bodega } from './stock.page';

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
    IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent,
    IonSearchbar, IonSelect, IonSelectOption, IonSpinner, IonButton,
  ],
  styles: [`
    .barra { display: flex; align-items: center; gap: 10px; padding: 4px 8px; flex-wrap: wrap; }
    .barra ion-searchbar { flex: 1; min-width: 200px; }
    ion-select { max-width: 260px; }
    .conteo { font-size: 12px; color: var(--ion-color-medium); white-space: nowrap; padding-right: 12px; }
    .tabla { overflow-x: auto; padding: 0 12px 20px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
         color: var(--ion-color-medium); padding: 8px 10px;
         border-bottom: 1px solid var(--ion-color-light-shade); white-space: nowrap; }
    td { padding: 7px 10px; border-bottom: 1px solid var(--ion-color-light); white-space: nowrap; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .mov { display: inline-block; padding: 1px 8px; border-radius: 9px; font-size: 11px; font-weight: 600; }
    .m-IN { background: #dcf0dc; color: #1d5c26; }
    .m-OUT { background: #f6e2d5; color: #8a4a1c; }
    .vacio { padding: 40px 20px; text-align: center; color: var(--ion-color-medium); }
    .paginas { display: flex; gap: 10px; align-items: center; justify-content: center; padding: 14px; }
    .aviso { color: var(--ion-color-danger); padding: 8px 14px; font-size: 13px; }
  `],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
      <ion-title>Movimientos de bodega</ion-title>
    </ion-toolbar></ion-header>

    <ion-content>
      @if (error()) { <div class="aviso">{{ error() }}</div> }

      <div class="barra">
        <ion-select label="Tipo" labelPlacement="stacked" interface="popover"
                    [value]="tipoVhe()" (ionChange)="tipoVhe.set($any($event).detail.value)">
          <ion-select-option value="">Todos</ion-select-option>
          @for (t of tipos(); track t) { <ion-select-option [value]="t">{{ t }}</ion-select-option> }
        </ion-select>
        <ion-select label="Bodega" labelPlacement="stacked" interface="popover"
                    [value]="bodega()" (ionChange)="bodega.set($any($event).detail.value)">
          <ion-select-option [value]="0">Todas</ion-select-option>
          @for (b of bodegas(); track b.bodega) {
            <ion-select-option [value]="b.bodega">{{ b.descr }}</ion-select-option>
          }
        </ion-select>
        <ion-searchbar placeholder="Código del ítem" [debounce]="350"
                       (ionInput)="idVhe.set($any($event).detail.value ?? '')"></ion-searchbar>
        <span class="conteo">{{ total() }} movimientos</span>
      </div>

      @if (cargando()) {
        <div class="vacio"><ion-spinner></ion-spinner></div>
      } @else if (datos().length === 0) {
        <div class="vacio">Sin movimientos</div>
      } @else {
        <div class="tabla">
          <table>
            <thead><tr>
              <th>Fecha</th><th>Doc</th><th>N°</th><th>Tipo</th><th>Ítem</th>
              <th>Descripción</th><th class="num">Cantidad</th><th>Centro costo</th>
              <th></th><th></th>
            </tr></thead>
            <tbody>
              @for (m of datos(); track m.id) {
                <tr>
                  <td>{{ m.fecha?.slice(0, 10) }}</td>
                  <td>{{ m.tipoDoc }}</td>
                  <td>{{ m.numdoc }}</td>
                  <td>{{ m.tipo_vhe }}</td>
                  <td>{{ m.id_vhe }}</td>
                  <td>{{ m.nombre || m.descr }}</td>
                  <td class="num">{{ m.cantidad }} {{ m.unidad }}</td>
                  <td>{{ m.ccosto }}</td>
                  <td><span class="mov" [class]="'mov m-' + m.tipo_mov">{{ m.tipo_mov }}</span></td>
                  <td>
                    @if (puedeEliminar()) {
                      <ion-button size="small" fill="clear" color="danger"
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
            <ion-button size="small" fill="clear" [disabled]="pagina() <= 1"
                        (click)="pagina.set(pagina() - 1)">Anterior</ion-button>
            <span class="conteo">{{ pagina() }} / {{ paginas() }}</span>
            <ion-button size="small" fill="clear" [disabled]="pagina() >= paginas()"
                        (click)="pagina.set(pagina() + 1)">Siguiente</ion-button>
          </div>
        }
      }
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
