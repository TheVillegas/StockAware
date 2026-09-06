/**
 * Detalle de una OC: aprobar, anular, emitir HES y ver las recepciones.
 *
 * La pantalla muestra el avance de la cabecera y el de cada línea por separado
 * a propósito: son dos números distintos y el ERP los calcula distinto. El de
 * la línea es por cantidad; el de la cabecera, ponderado por monto.
 */
import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonInput,
  IonItem, IonList, IonModal, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';

import { ApiService, mensajeDeError } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { clp, pendienteDe, type Documento, type LineaDocumento } from '../core/modelos';
import { colorEstado } from './ordenes.page';

@Component({
  selector: 'app-orden-detalle',
  imports: [
    DatePipe, FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent,
    IonButton, IonBadge, IonSpinner, IonModal, IonList, IonItem, IonInput,
  ],
  styles: [
    `
      .cabecera { padding: 14px 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px 22px; border-bottom: 1px solid var(--ion-color-light-shade); }
      .dato small { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--ion-color-medium); margin-bottom: 2px; }
      .dato span { font-size: 15px; font-variant-numeric: tabular-nums; }
      .acciones { display: flex; gap: 8px; padding: 12px 16px; flex-wrap: wrap; border-bottom: 1px solid var(--ion-color-light-shade); }
      h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: var(--ion-color-medium); margin: 18px 16px 6px; }
      .envoltura { overflow-x: auto; padding: 0 12px; }
      table { border-collapse: collapse; width: 100%; font-size: 14px; }
      th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--ion-color-light-shade); white-space: nowrap; }
      th { font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--ion-color-medium); font-weight: 600; }
      td.num { text-align: right; font-variant-numeric: tabular-nums; }
      .vacio, .error { padding: 24px 16px; text-align: center; color: var(--ion-color-medium); }
      .error { color: var(--ion-color-danger); }
      .nota { font-size: 12px; color: var(--ion-color-medium); padding: 6px 16px 20px; line-height: 1.55; }
      .rec { display: grid; grid-template-columns: 1fr 110px 110px; gap: 10px; align-items: end; padding: 4px 16px 10px; }
      @media (max-width: 640px) { .rec { grid-template-columns: 1fr; } }
    `,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/compras/ordenes"></ion-back-button></ion-buttons>
        <ion-title>OC {{ oc()?.numdoc ?? '' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (cargando()) {
        <div class="vacio"><ion-spinner name="crescent"></ion-spinner></div>
      } @else if (error()) {
        <div class="error">{{ error() }}</div>
      } @else if (oc(); as d) {
        <div class="cabecera">
          <div class="dato"><small>Estado</small><ion-badge [color]="color(d.estado)">{{ d.estado }}</ion-badge></div>
          <div class="dato"><small>Proveedor</small><span>{{ d.proveedor?.nombre }} {{ d.proveedor?.apellido }}</span></div>
          <div class="dato"><small>Centro de costo</small><span>{{ d.ccosto?.ccosto ?? '—' }}</span></div>
          <div class="dato"><small>Neto</small><span>{{ moneda(d.neto) }}</span></div>
          <div class="dato"><small>IVA</small><span>{{ moneda(d.iva) }}</span></div>
          <div class="dato"><small>Total</small><span>{{ moneda(d.total) }}</span></div>
          <div class="dato"><small>Avance de la OC</small><span>{{ d.ocAvance }} %</span></div>
        </div>

        <div class="acciones">
          @if (d.estado === 'PENDIENTE' && puede('Aprueba OC')) {
            <ion-button size="small" (click)="aprobar()" [disabled]="trabajando()">Aprobar</ion-button>
          }
          @if (d.estado === 'EMITIDO' && d.ocAvance < 100 && puede('Recepciones (HES)')) {
            <ion-button size="small" color="secondary" (click)="abrirRecepcion()" [disabled]="trabajando()">
              Recibir (emitir HES)
            </ion-button>
          }
          @if (d.estado !== 'ELIMINADO' && puede('Anula OC')) {
            <ion-button size="small" fill="outline" color="danger" (click)="anular()" [disabled]="trabajando()">
              Anular
            </ion-button>
          }
        </div>

        @if (aviso()) { <div class="error">{{ aviso() }}</div> }

        <h3>Detalle</h3>
        <div class="envoltura">
          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th style="width:90px">Cantidad</th>
                <th style="width:80px">Unidad</th>
                <th style="width:110px">Precio</th>
                <th style="width:110px">Total</th>
                <th style="width:100px">Avance</th>
                <th style="width:100px">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              @for (l of d.detalle ?? []; track l.id) {
                <tr>
                  <td>{{ l.nombre }}</td>
                  <td class="num">{{ l.cantidad }}</td>
                  <td>{{ l.unidad }}</td>
                  <td class="num">{{ moneda(l.precioUni) }}</td>
                  <td class="num">{{ moneda(l.total) }}</td>
                  <td class="num">{{ l.ocAvance }} %</td>
                  <td class="num">{{ pendiente(l) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="nota">
          El avance de cada línea es por cantidad recibida. El de la cabecera está
          ponderado por monto, así que no coincide con el promedio de las líneas.
        </p>

        <h3>Recepciones</h3>
        @if (hes().length === 0) {
          <div class="vacio">Todavía no hay recepciones.</div>
        } @else {
          <div class="envoltura">
            <table>
              <thead>
                <tr>
                  <th style="width:100px">HES</th>
                  <th style="width:120px">Fecha</th>
                  <th style="width:120px">Neto</th>
                  <th style="width:110px">Aporta</th>
                  <th style="width:130px">A bodega</th>
                  <th style="width:110px"></th>
                </tr>
              </thead>
              <tbody>
                @for (h of hes(); track h.id) {
                  <tr>
                    <td>{{ h.numdoc }}</td>
                    <td>{{ h.fecha | date: 'dd-MM-yyyy' }}</td>
                    <td class="num">{{ moneda(h.neto) }}</td>
                    <td class="num">{{ h.ocAvance }} %</td>
                    <td>{{ h.cargadaABodega ? 'Sí' : 'No' }}</td>
                    <td>
                      @if (!h.cargadaABodega && puede('Carga desde HES')) {
                        <ion-button size="small" fill="clear"
                          (click)="abrirCarga(h.id)" [disabled]="trabajando()">A bodega</ion-button>
                      }
                      @if (!h.cargadaABodega && puede('Anula HES')) {
                        <ion-button size="small" fill="clear" color="danger"
                          (click)="eliminarHes(h.id)" [disabled]="trabajando()">Eliminar</ion-button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="nota">
            Eliminar una recepción revierte el avance de la OC. No se puede si ya
            fue cargada a bodega.
          </p>
        }
      }

      <ion-modal [isOpen]="cargaAbierta()" (didDismiss)="cargaAbierta.set(false)">
        <ng-template>
          <ion-header>
            <ion-toolbar>
              <ion-title>Cargar a bodega</ion-title>
              <ion-buttons slot="end"><ion-button (click)="cargaAbierta.set(false)">Cerrar</ion-button></ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <p class="nota">
              El material entra a la bodega que elijas. El código de cada material se
              extrae del texto de la línea, con el formato <code>/MC_nnn</code>. Si
              alguna línea no resuelve, la carga completa se rechaza.
            </p>
            <ion-list>
              <ion-item>
                <ion-input label="Id de la bodega *" labelPlacement="stacked" type="number"
                  [(ngModel)]="bodegaCarga" placeholder="1"></ion-input>
              </ion-item>
            </ion-list>
            @if (errorCarga()) { <div class="error">{{ errorCarga() }}</div> }
            <div style="padding:8px 16px 24px">
              <ion-button expand="block" (click)="cargarABodega()" [disabled]="trabajando()">
                @if (trabajando()) { <ion-spinner name="crescent"></ion-spinner> } @else { Cargar }
              </ion-button>
            </div>
          </ion-content>
        </ng-template>
      </ion-modal>

      <ion-modal [isOpen]="recepcionAbierta()" (didDismiss)="recepcionAbierta.set(false)">
        <ng-template>
          <ion-header>
            <ion-toolbar>
              <ion-title>Recibir contra OC {{ oc()?.numdoc }}</ion-title>
              <ion-buttons slot="end"><ion-button (click)="recepcionAbierta.set(false)">Cerrar</ion-button></ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <p class="nota">
              Indicá cuánto llegó de cada línea. Dejá en blanco o en cero las que no
              se reciben. No se puede recibir más de lo pendiente.
            </p>
            @for (l of (oc()?.detalle ?? []); track l.id) {
              @if (pendiente(l) > 0) {
                <div class="rec">
                  <div>
                    <div style="font-size:14px">{{ l.nombre }}</div>
                    <div style="font-size:12px;color:var(--ion-color-medium)">
                      pendiente {{ pendiente(l) }} {{ l.unidad }} de {{ l.cantidad }}
                    </div>
                  </div>
                  <ion-input label="Recibir" labelPlacement="stacked" type="number"
                    [(ngModel)]="recibido[l.id]" placeholder="0"></ion-input>
                  <ion-button size="small" fill="outline" (click)="recibido[l.id] = pendiente(l)">Todo</ion-button>
                </div>
              }
            }

            <ion-list>
              <ion-item>
                <ion-input label="Observación" labelPlacement="stacked" [(ngModel)]="obsRecepcion"></ion-input>
              </ion-item>
            </ion-list>

            @if (errorRecepcion()) { <div class="error">{{ errorRecepcion() }}</div> }

            <div style="padding:8px 16px 24px">
              <ion-button expand="block" (click)="emitirHes()" [disabled]="trabajando()">
                @if (trabajando()) { <ion-spinner name="crescent"></ion-spinner> } @else { Emitir HES }
              </ion-button>
            </div>
          </ion-content>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
})
export class OrdenDetallePage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** Llega de la ruta compras/ordenes/:id con withComponentInputBinding(). */
  id = '';

  readonly oc = signal<Documento | null>(null);
  readonly hes = signal<Documento[]>([]);
  readonly cargando = signal(false);
  readonly trabajando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly recepcionAbierta = signal(false);
  readonly errorRecepcion = signal('');

  recibido: Record<number, number | null> = {};
  obsRecepcion = '';

  readonly cargaAbierta = signal(false);
  readonly errorCarga = signal('');
  hesACargar: number | null = null;
  bodegaCarga: number | null = 1;

  readonly moneda = clp;
  readonly color = colorEstado;
  readonly pendiente = pendienteDe;

  puede(p: string): boolean {
    return this.auth.puede(p);
  }

  ionViewWillEnter(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    const id = Number(this.id);
    if (!Number.isFinite(id)) {
      this.error.set('Identificador de orden inválido');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    try {
      this.oc.set(await this.api.orden(id));
      this.hes.set(await this.api.hesDeOrden(id));
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  private async accionSobreOc(ruta: string): Promise<void> {
    this.trabajando.set(true);
    this.aviso.set('');
    try {
      await this.api.accion(`compras/ordenes/${this.id}/${ruta}`);
      await this.cargar();
    } catch (e) {
      this.aviso.set(mensajeDeError(e));
    } finally {
      this.trabajando.set(false);
    }
  }

  aprobar(): Promise<void> { return this.accionSobreOc('aprobar'); }
  anular(): Promise<void> { return this.accionSobreOc('anular'); }

  abrirRecepcion(): void {
    this.recibido = {};
    this.obsRecepcion = '';
    this.errorRecepcion.set('');
    this.recepcionAbierta.set(true);
  }

  async emitirHes(): Promise<void> {
    const detalle = Object.entries(this.recibido)
      .map(([id, cant]) => ({ detalleOcId: Number(id), cantidad: Number(cant) }))
      .filter((l) => l.cantidad > 0);

    if (detalle.length === 0) {
      this.errorRecepcion.set('Indicá al menos una cantidad recibida.');
      return;
    }

    this.trabajando.set(true);
    this.errorRecepcion.set('');
    try {
      await this.api.crear('compras/hes', {
        ocId: Number(this.id),
        observacion: this.obsRecepcion || undefined,
        detalle,
      });
      this.recepcionAbierta.set(false);
      await this.cargar();
    } catch (e) {
      this.errorRecepcion.set(mensajeDeError(e));
    } finally {
      this.trabajando.set(false);
    }
  }

  abrirCarga(idHes: number): void {
    this.hesACargar = idHes;
    this.errorCarga.set('');
    this.cargaAbierta.set(true);
  }

  async cargarABodega(): Promise<void> {
    if (!this.hesACargar || !this.bodegaCarga) {
      this.errorCarga.set('Indicá la bodega de destino.');
      return;
    }
    this.trabajando.set(true);
    this.errorCarga.set('');
    try {
      await this.api.crear('bodega/cargar-hes', {
        hesId: this.hesACargar,
        bodegaId: Number(this.bodegaCarga),
      });
      this.cargaAbierta.set(false);
      await this.cargar();
    } catch (e) {
      this.errorCarga.set(mensajeDeError(e));
    } finally {
      this.trabajando.set(false);
    }
  }

  async eliminarHes(idHes: number): Promise<void> {
    this.trabajando.set(true);
    this.aviso.set('');
    try {
      await this.api.eliminar(`compras/hes/${idHes}`);
      await this.cargar();
    } catch (e) {
      this.aviso.set(mensajeDeError(e));
    } finally {
      this.trabajando.set(false);
    }
  }
}
