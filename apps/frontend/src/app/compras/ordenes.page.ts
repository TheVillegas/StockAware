/**
 * Listado de ordenes de compra (CON_DOC_EMI / EMITE_OC).
 *
 * Muestra las OC con su avance. El avance del encabezado es el ponderado por
 * plata que calcula el backend, no el promedio de las lineas.
 */
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonMenuButton, IonNote,
  IonSearchbar, IonSegment, IonSegmentButton, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';

import { API, AuthService } from '../core/auth.service';

export interface Oc {
  id: number; numdoc: number; tipo_doc: string; fecha: string;
  cliente: number; rut: string; estado: string;
  neto: number; iva: number; total: number;
  OC_avance: string; HES: string; ccosto: string; obs: string;
  usuario: string; proveedor: string;
}

export const clp = (n: unknown): string =>
  n == null || n === '' ? '' : '$' + Math.round(Number(n)).toLocaleString('es-CL');

@Component({
  selector: 'app-ordenes',
  imports: [
    FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton,
    IonContent, IonSearchbar, IonSpinner, IonNote, IonButton, IonSegment, IonSegmentButton,
  ],
  styles: [`
    .barra { display: flex; align-items: center; gap: 10px; padding: 0 8px; }
    .barra ion-searchbar { flex: 1; }
    .conteo { font-size: 12px; color: var(--ion-color-medium); white-space: nowrap; padding-right: 12px; }
    ion-segment { padding: 4px 12px; }
    .tabla { overflow-x: auto; padding: 0 12px 20px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th { text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase;
         letter-spacing: .05em; color: var(--ion-color-medium); padding: 8px 10px;
         border-bottom: 1px solid var(--ion-color-light-shade); white-space: nowrap; }
    td { padding: 7px 10px; border-bottom: 1px solid var(--ion-color-light); white-space: nowrap; }
    tr.clic:hover { background: var(--ion-color-light); cursor: pointer; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .vacio { padding: 40px 20px; text-align: center; color: var(--ion-color-medium); }
    .paginas { display: flex; gap: 10px; align-items: center; justify-content: center; padding: 14px; }
    .aviso { color: var(--ion-color-danger); padding: 8px 14px; font-size: 13px; }
    .pastilla { display: inline-block; padding: 2px 9px; border-radius: 10px; font-size: 11px;
                font-weight: 600; letter-spacing: .03em; }
    .e-PENDIENTE { background: #fff3cd; color: #7a5a00; }
    .e-EMITIDO   { background: #d9e8ff; color: #14418a; }
    .e-CERRADO   { background: #dcf0dc; color: #1d5c26; }
    .e-ELIMINADO,.e-ANULADO { background: #f1d6d6; color: #8a1c1c; }
    .barraAvance { display: inline-block; width: 74px; height: 6px; border-radius: 3px;
                   background: var(--ion-color-light-shade); vertical-align: middle; margin-right: 7px; }
    .barraAvance > i { display: block; height: 100%; border-radius: 3px; background: var(--ion-color-primary); }
  `],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
      <ion-title>Órdenes de compra</ion-title>
      @if (puedeEmitir()) {
        <ion-buttons slot="end"><ion-button (click)="nueva()">Nueva OC</ion-button></ion-buttons>
      }
    </ion-toolbar></ion-header>

    <ion-content>
      @if (error()) { <div class="aviso">{{ error() }}</div> }

      <ion-segment [value]="estado()" (ionChange)="estado.set($any($event).detail.value)">
        <ion-segment-button value=""><ion-note>Todas</ion-note></ion-segment-button>
        <ion-segment-button value="PENDIENTE"><ion-note>Pendientes</ion-note></ion-segment-button>
        <ion-segment-button value="EMITIDO"><ion-note>Emitidas</ion-note></ion-segment-button>
        <ion-segment-button value="CERRADO"><ion-note>Cerradas</ion-note></ion-segment-button>
      </ion-segment>

      <div class="barra">
        <ion-searchbar placeholder="Número, proveedor o RUT" [debounce]="350"
                       (ionInput)="buscar.set($any($event).detail.value ?? '')"></ion-searchbar>
        <span class="conteo">{{ total() }} órdenes</span>
      </div>

      @if (cargando()) {
        <div class="vacio"><ion-spinner></ion-spinner></div>
      } @else if (datos().length === 0) {
        <div class="vacio">Sin resultados</div>
      } @else {
        <div class="tabla">
          <table>
            <thead><tr>
              <th>N°</th><th>Fecha</th><th>Proveedor</th><th>Centro costo</th>
              <th class="num">Neto</th><th class="num">Total</th><th>Avance</th><th>Estado</th>
            </tr></thead>
            <tbody>
              @for (o of datos(); track o.id) {
                <tr class="clic" (click)="abrir(o)">
                  <td>{{ o.numdoc }}</td>
                  <td>{{ o.fecha?.slice(0, 10) }}</td>
                  <td>{{ o.proveedor }}</td>
                  <td>{{ o.ccosto }}</td>
                  <td class="num">{{ moneda(o.neto) }}</td>
                  <td class="num">{{ moneda(o.total) }}</td>
                  <td>
                    <span class="barraAvance"><i [style.width.%]="pct(o.OC_avance)"></i></span>
                    <span class="num">{{ pct(o.OC_avance) }}%</span>
                  </td>
                  <td><span class="pastilla" [class]="'pastilla e-' + o.estado">{{ o.estado }}</span></td>
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
export class OrdenesPage {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly datos = signal<Oc[]>([]);
  readonly total = signal(0);
  readonly paginas = signal(1);
  readonly pagina = signal(1);
  readonly buscar = signal('');
  readonly estado = signal('');
  readonly cargando = signal(false);
  readonly error = signal('');

  readonly moneda = clp;
  puedeEmitir = () => (this.auth.sesion()?.permisos ?? []).includes('EMITE_OC');
  pct = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;

  private ultimoFiltro = '';

  constructor() {
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
    try {
      const q = new URLSearchParams({ pagina: String(pagina), limite: '50' });
      if (buscar) q.set('buscar', buscar);
      if (estado) q.set('estado', estado);
      const r = await firstValueFrom(
        this.http.get<{ datos: Oc[]; total: number; paginas: number }>(
          `${API}/compras/oc?${q}`,
        ),
      );
      this.datos.set(r.datos);
      this.total.set(r.total);
      this.paginas.set(r.paginas);
    } catch (e: any) {
      this.datos.set([]);
      this.error.set(e?.error?.message ?? 'No se pudieron cargar las órdenes');
    } finally {
      this.cargando.set(false);
    }
  }

  abrir(o: Oc): void { void this.router.navigate(['/oc', o.id]); }
  nueva(): void { void this.router.navigate(['/oc', 'nueva']); }
}
