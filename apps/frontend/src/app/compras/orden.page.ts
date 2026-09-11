/**
 * Detalle de una OC: lineas, HES emitidas y acciones.
 *
 * La emision de HES calcula el avance como lo hace el ERP: por linea es el
 * porcentaje recibido, y el monto es proporcional al total de esa linea. El
 * avance del encabezado NO se calcula aca; lo devuelve el backend, ponderado
 * por plata.
 *
 * Con id = "nueva" el mismo componente sirve para emitir una OC.
 */
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonNote,
  IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';

import { API, AuthService } from '../core/auth.service';
import { clp, Oc } from './ordenes.page';

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

@Component({
  selector: 'app-orden',
  imports: [
    FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent,
    IonButton, IonNote, IonSpinner, IonItem, IonInput,
  ],
  styles: [`
    .cuerpo { padding: 16px 16px 40px; }
    h3 { font-size: 14px; text-transform: uppercase; letter-spacing: .05em;
         color: var(--ion-color-medium); margin: 26px 0 8px; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 22px; margin: 0; }
    dt { color: var(--ion-color-medium); font-size: 12px; }
    dd { margin: 0; font-size: 14px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
         color: var(--ion-color-medium); padding: 7px 9px;
         border-bottom: 1px solid var(--ion-color-light-shade); }
    td { padding: 6px 9px; border-bottom: 1px solid var(--ion-color-light); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .desplaza { overflow-x: auto; }
    .acciones { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 22px; }
    .aviso { color: var(--ion-color-danger); font-size: 13px; margin: 12px 0; }
    .ok { color: var(--ion-color-success); font-size: 13px; margin: 12px 0; }
    .totalHes { font-size: 14px; margin-top: 12px; }
    .totalHes strong { font-variant-numeric: tabular-nums; }
    ion-input { --padding-start: 0; }
  `],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-button (click)="volver()">Volver</ion-button></ion-buttons>
      <ion-title>{{ esNueva() ? 'Nueva orden de compra' : 'OC ' + (oc()?.numdoc ?? '') }}</ion-title>
    </ion-toolbar></ion-header>

    <ion-content>
      <div class="cuerpo">
        @if (error()) { <div class="aviso">{{ error() }}</div> }
        @if (mensaje()) { <div class="ok">{{ mensaje() }}</div> }

        @if (cargando()) {
          <ion-spinner></ion-spinner>
        } @else if (esNueva()) {
          <h3>Encabezado</h3>
          <ion-item><ion-input label="Código de proveedor" labelPlacement="stacked"
                               type="number" [(ngModel)]="nuevo.cliente"></ion-input></ion-item>
          <ion-item><ion-input label="RUT" labelPlacement="stacked"
                               [(ngModel)]="nuevo.rut"></ion-input></ion-item>
          <ion-item><ion-input label="Fecha" labelPlacement="stacked" type="date"
                               [(ngModel)]="nuevo.fecha"></ion-input></ion-item>
          <ion-item><ion-input label="Centro de costo" labelPlacement="stacked"
                               [(ngModel)]="nuevo.ccosto"></ion-input></ion-item>
          <ion-item><ion-input label="Observación" labelPlacement="stacked"
                               [(ngModel)]="nuevo.obs"></ion-input></ion-item>

          <h3>Líneas</h3>
          <div class="desplaza">
            <table>
              <thead><tr>
                <th>Descripción</th><th class="num">Cantidad</th><th>Unidad</th>
                <th class="num">Precio</th><th class="num">Total</th>
              </tr></thead>
              <tbody>
                @for (l of nuevo.lineas; track $index) {
                  <tr>
                    <td><ion-input [(ngModel)]="l.nombre" placeholder="Detalle"></ion-input></td>
                    <td class="num"><ion-input type="number" [(ngModel)]="l.cantidad"></ion-input></td>
                    <td><ion-input [(ngModel)]="l.unidad"></ion-input></td>
                    <td class="num"><ion-input type="number" [(ngModel)]="l.precio_uni"></ion-input></td>
                    <td class="num">{{ moneda(l.cantidad * l.precio_uni) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="acciones">
            <ion-button size="small" fill="outline" (click)="agregarLinea()">Agregar línea</ion-button>
          </div>
          <div class="totalHes">Neto: <strong>{{ moneda(netoNuevo()) }}</strong></div>
          <div class="acciones">
            <ion-button (click)="crear()" [disabled]="trabajando()">Emitir OC</ion-button>
          </div>

        } @else if (oc(); as o) {
          <dl>
            <dt>Proveedor</dt><dd>{{ o.proveedor }} ({{ o.rut }})</dd>
            <dt>Fecha</dt><dd>{{ o.fecha?.slice(0, 10) }}</dd>
            <dt>Centro de costo</dt><dd>{{ o.ccosto }}</dd>
            <dt>Estado</dt><dd>{{ o.estado }}</dd>
            <dt>Neto / IVA / Total</dt>
            <dd>{{ moneda(o.neto) }} · {{ moneda(o.iva) }} · <strong>{{ moneda(o.total) }}</strong></dd>
            <dt>Avance</dt><dd>{{ pct(o.OC_avance) }}%</dd>
            <dt>HES emitidas</dt><dd>{{ o.HES || '—' }}</dd>
            @if (o.obs) { <dt>Observación</dt><dd>{{ o.obs }}</dd> }
          </dl>

          <h3>Líneas</h3>
          <div class="desplaza">
            <table>
              <thead><tr>
                <th>Descripción</th><th class="num">Cantidad</th><th>Unidad</th>
                <th class="num">Precio</th><th class="num">Total</th><th class="num">Avance</th>
                @if (recibiendo()) { <th class="num">Recibir</th> }
              </tr></thead>
              <tbody>
                @for (l of o.detalle; track l.id) {
                  <tr>
                    <td>{{ l.nombre }}</td>
                    <td class="num">{{ l.cantidad }}</td>
                    <td>{{ l.unidad }}</td>
                    <td class="num">{{ moneda(l.precio_uni) }}</td>
                    <td class="num">{{ moneda(l.total) }}</td>
                    <td class="num">{{ pct(l.OC_avance) }}%</td>
                    @if (recibiendo()) {
                      <td class="num">
                        <ion-input type="number" [(ngModel)]="recepcion[l.id]"
                                   [placeholder]="pendiente(l).toString()"></ion-input>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (recibiendo()) {
            <div class="totalHes">
              Neto de la HES: <strong>{{ moneda(netoHes()) }}</strong>
              · avance que sumará a la OC: <strong>{{ avanceHes() }}%</strong>
            </div>
            <div class="acciones">
              <ion-button (click)="emitirHes()" [disabled]="trabajando() || netoHes() <= 0">
                Confirmar recepción
              </ion-button>
              <ion-button fill="clear" (click)="recibiendo.set(false)">Cancelar</ion-button>
            </div>
          }

          @if (hes().length) {
            <h3>Recepciones</h3>
            <div class="desplaza">
              <table>
                <thead><tr>
                  <th>HES</th><th>Fecha</th><th class="num">Neto</th>
                  <th class="num">Avance</th><th>Usuario</th><th></th>
                </tr></thead>
                <tbody>
                  @for (h of hes(); track h.id) {
                    <tr>
                      <td>{{ h.numdoc }}</td>
                      <td>{{ h.fecha?.slice(0, 10) }}</td>
                      <td class="num">{{ moneda(h.neto) }}</td>
                      <td class="num">{{ pct(h.OC_avance) }}%</td>
                      <td>{{ h.usuario }}</td>
                      <td>
                        @if (puede('ELIMINA_HES')) {
                          <ion-button size="small" fill="clear" color="danger"
                                      (click)="eliminarHes(h)">Eliminar</ion-button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <div class="acciones">
            @if (o.estado === 'PENDIENTE' && puede('APRUEBA_ORDEN_COMPRA')) {
              <ion-button (click)="aprobar()" [disabled]="trabajando()">Aprobar</ion-button>
            }
            @if (o.estado === 'EMITIDO' && puede('EMITE_HES') && !recibiendo()) {
              <ion-button (click)="recibiendo.set(true)">Emitir HES</ion-button>
            }
            @if (puede('ANULAR_ORDEN_COMPRA')) {
              <ion-button color="danger" fill="outline" (click)="anular()"
                          [disabled]="trabajando()">Anular</ion-button>
            }
          </div>
        }
      </div>
    </ion-content>
  `,
})
export class OrdenPage {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly param = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')),
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
    lineas: [{ nombre: '', cantidad: 0, unidad: 'UNI', precio_uni: 0 }],
  };

  readonly moneda = clp;
  pct = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;
  puede = (f: string) => (this.auth.sesion()?.permisos ?? []).includes(f);

  private ultimo = '';

  constructor() {
    effect(() => {
      const p = this.param();
      if (!p || p === this.ultimo) return;
      this.ultimo = p;
      if (p !== 'nueva') void this.cargar(Number(p));
    });
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
      'Orden aprobada',
    );
  }

  async anular(): Promise<void> {
    const o = this.oc(); if (!o) return;
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
    this.nuevo.lineas = [...this.nuevo.lineas,
      { nombre: '', cantidad: 0, unidad: 'UNI', precio_uni: 0 }];
  }

  netoNuevo(): number {
    return this.nuevo.lineas.reduce(
      (s, l) => s + Number(l.cantidad || 0) * Number(l.precio_uni || 0), 0);
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

  volver(): void { void this.router.navigate(['/f', 'CON_DOC_EMI']); }
}
