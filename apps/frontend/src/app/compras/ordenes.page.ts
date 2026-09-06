/** Listado y creación de órdenes de compra. */
import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem,
  IonList, IonMenuButton, IonModal, IonSearchbar, IonSelect, IonSelectOption,
  IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, trashOutline } from 'ionicons/icons';

import { ApiService, mensajeDeError } from '../core/api.service';
import { clp, type Documento, type EstadoDocumento } from '../core/modelos';

interface LineaNueva {
  nombre: string;
  cantidad: number | null;
  unidad: string;
  precioUni: number | null;
}

export const colorEstado = (e: EstadoDocumento): string =>
  ({
    PENDIENTE: 'warning',
    EMITIDO: 'success',
    CERRADO: 'medium',
    ANULADO: 'danger',
    ELIMINADO: 'danger',
  })[e] ?? 'medium';

@Component({
  selector: 'app-ordenes',
  imports: [
    DatePipe, FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent,
    IonSearchbar, IonButton, IonIcon, IonSpinner, IonBadge, IonModal, IonList, IonItem,
    IonInput, IonSelect, IonSelectOption,
  ],
  styles: [
    `
      .barra { display: flex; gap: 10px; align-items: center; padding: 8px 12px; flex-wrap: wrap; }
      .barra ion-searchbar { flex: 1 1 220px; padding: 0; }
      .envoltura { overflow-x: auto; padding: 0 12px 16px; }
      table { border-collapse: collapse; width: 100%; font-size: 14px; }
      th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--ion-color-light-shade); white-space: nowrap; }
      th { font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--ion-color-medium); font-weight: 600; }
      td.num { text-align: right; font-variant-numeric: tabular-nums; }
      tr.clic:hover { background: var(--ion-color-light); cursor: pointer; }
      .vacio, .error { padding: 32px 16px; text-align: center; color: var(--ion-color-medium); }
      .error { color: var(--ion-color-danger); }
      .pie { display: flex; align-items: center; gap: 14px; padding: 4px 14px 20px; font-size: 13px; color: var(--ion-color-medium); }
      .lineas { padding: 4px 16px 0; }
      .fila-linea { display: grid; grid-template-columns: 1fr 90px 90px 110px 40px; gap: 8px; align-items: end; margin-bottom: 8px; }
      .totales { padding: 12px 16px; font-size: 14px; display: flex; gap: 20px; justify-content: flex-end; font-variant-numeric: tabular-nums; }
      .avance { font-variant-numeric: tabular-nums; }
      @media (max-width: 700px) { .fila-linea { grid-template-columns: 1fr 1fr; } }
    `,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Órdenes de compra</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="abrirNueva()">
            <ion-icon slot="start" name="add-outline"></ion-icon>
            Nueva OC
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="barra">
        <ion-searchbar placeholder="Número o proveedor" [debounce]="350"
          (ionInput)="buscar($any($event).detail.value ?? '')"></ion-searchbar>
        <ion-select placeholder="Estado" interface="popover" [(ngModel)]="estado"
          (ionChange)="recargar()" style="min-width:170px">
          <ion-select-option [value]="''">Todos</ion-select-option>
          @for (e of estados; track e) { <ion-select-option [value]="e">{{ e }}</ion-select-option> }
        </ion-select>
      </div>

      @if (cargando()) {
        <div class="vacio"><ion-spinner name="crescent"></ion-spinner></div>
      } @else if (error()) {
        <div class="error">{{ error() }}</div>
      } @else if (ordenes().length === 0) {
        <div class="vacio">No hay órdenes de compra. Creá una con «Nueva OC».</div>
      } @else {
        <div class="envoltura">
          <table>
            <thead>
              <tr>
                <th style="width:100px">Número</th>
                <th style="width:120px">Estado</th>
                <th>Proveedor</th>
                <th style="width:120px">Fecha</th>
                <th style="width:110px">Neto</th>
                <th style="width:110px">Total</th>
                <th style="width:100px">Avance</th>
              </tr>
            </thead>
            <tbody>
              @for (o of ordenes(); track o.id) {
                <tr class="clic" (click)="abrir(o.id)">
                  <td>{{ o.numdoc }}</td>
                  <td><ion-badge [color]="color(o.estado)">{{ o.estado }}</ion-badge></td>
                  <td>{{ o.proveedor?.nombre }} {{ o.proveedor?.apellido }}</td>
                  <td>{{ o.fecha | date: 'dd-MM-yyyy' }}</td>
                  <td class="num">{{ moneda(o.neto) }}</td>
                  <td class="num">{{ moneda(o.total) }}</td>
                  <td class="num avance">{{ o.ocAvance }} %</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="pie">
          <span>{{ total() }} orden(es)</span>
          @if (paginas() > 1) {
            <ion-button size="small" fill="clear" [disabled]="pagina() === 1" (click)="irA(pagina() - 1)">Anterior</ion-button>
            <span>Página {{ pagina() }} de {{ paginas() }}</span>
            <ion-button size="small" fill="clear" [disabled]="pagina() === paginas()" (click)="irA(pagina() + 1)">Siguiente</ion-button>
          }
        </div>
      }

      <ion-modal [isOpen]="abierta()" (didDismiss)="abierta.set(false)">
        <ng-template>
          <ion-header>
            <ion-toolbar>
              <ion-title>Nueva orden de compra</ion-title>
              <ion-buttons slot="end"><ion-button (click)="abierta.set(false)">Cerrar</ion-button></ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <ion-list>
              <ion-item>
                <ion-input label="Id del proveedor *" labelPlacement="stacked" type="number"
                  [(ngModel)]="nueva.proveedorId"></ion-input>
              </ion-item>
              <ion-item>
                <ion-input label="Id del centro de costo" labelPlacement="stacked" type="number"
                  [(ngModel)]="nueva.ccostoId"></ion-input>
              </ion-item>
              <ion-item>
                <ion-select label="Tipo" labelPlacement="stacked" interface="popover" [(ngModel)]="nueva.tipo">
                  <ion-select-option value="OC">OC afecta (con IVA)</ion-select-option>
                  <ion-select-option value="OC_EXENTA">OC exenta</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-input label="Observación" labelPlacement="stacked" [(ngModel)]="nueva.observacion"></ion-input>
              </ion-item>
            </ion-list>

            <div class="lineas">
              <h3 style="font-size:14px;margin:14px 0 8px">Detalle</h3>
              @for (l of lineas; track $index) {
                <div class="fila-linea">
                  <ion-input label="Descripción" labelPlacement="stacked" [(ngModel)]="l.nombre"
                    placeholder="Guante talla 9/MC_002"></ion-input>
                  <ion-input label="Cantidad" labelPlacement="stacked" type="number" [(ngModel)]="l.cantidad"></ion-input>
                  <ion-input label="Unidad" labelPlacement="stacked" [(ngModel)]="l.unidad"></ion-input>
                  <ion-input label="Precio" labelPlacement="stacked" type="number" [(ngModel)]="l.precioUni"></ion-input>
                  <ion-button fill="clear" color="danger" (click)="quitarLinea($index)" [disabled]="lineas.length === 1">
                    <ion-icon slot="icon-only" name="trash-outline"></ion-icon>
                  </ion-button>
                </div>
              }
              <ion-button size="small" fill="outline" (click)="agregarLinea()">
                <ion-icon slot="start" name="add-outline"></ion-icon>
                Agregar línea
              </ion-button>
              <p style="font-size:12px;color:var(--ion-color-medium);margin-top:10px">
                El código del material va dentro de la descripción, con el formato
                <code>TEXTO/MC_nnn</code>. Así lo hace el ERP y así lo lee la carga a bodega.
              </p>
            </div>

            <div class="totales">
              <span>Neto {{ moneda(netoNuevo()) }}</span>
              <span>IVA {{ moneda(ivaNuevo()) }}</span>
              <strong>Total {{ moneda(netoNuevo() + ivaNuevo()) }}</strong>
            </div>

            @if (errorForm()) { <div class="error">{{ errorForm() }}</div> }

            <div style="padding:8px 16px 24px">
              <ion-button expand="block" (click)="crear()" [disabled]="guardando()">
                @if (guardando()) { <ion-spinner name="crescent"></ion-spinner> } @else { Crear OC }
              </ion-button>
            </div>
          </ion-content>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
})
export class OrdenesPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly estados: EstadoDocumento[] = ['PENDIENTE', 'EMITIDO', 'CERRADO', 'ELIMINADO'];
  readonly ordenes = signal<Documento[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly paginas = signal(1);
  readonly cargando = signal(false);
  readonly error = signal('');

  readonly abierta = signal(false);
  readonly guardando = signal(false);
  readonly errorForm = signal('');

  estado = '';
  private texto = '';

  nueva: { proveedorId: number | null; ccostoId: number | null; tipo: string; observacion: string } = {
    proveedorId: null, ccostoId: null, tipo: 'OC', observacion: '',
  };
  lineas: LineaNueva[] = [];

  readonly moneda = clp;
  readonly color = colorEstado;

  constructor() {
    addIcons({ addOutline, trashOutline });
  }

  ionViewWillEnter(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const p = await this.api.ordenes({
        pagina: this.pagina(),
        limite: 25,
        buscar: this.texto || undefined,
        estado: this.estado || undefined,
      });
      this.ordenes.set(p.datos);
      this.total.set(p.total);
      this.paginas.set(p.paginas);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  buscar(t: string): void { this.texto = t; this.pagina.set(1); void this.cargar(); }
  recargar(): void { this.pagina.set(1); void this.cargar(); }
  irA(p: number): void { this.pagina.set(p); void this.cargar(); }
  abrir(id: number): void { void this.router.navigate(['/compras/ordenes', id]); }

  abrirNueva(): void {
    this.nueva = { proveedorId: null, ccostoId: null, tipo: 'OC', observacion: '' };
    this.lineas = [{ nombre: '', cantidad: null, unidad: 'UNI', precioUni: null }];
    this.errorForm.set('');
    this.abierta.set(true);
  }

  agregarLinea(): void {
    this.lineas.push({ nombre: '', cantidad: null, unidad: 'UNI', precioUni: null });
  }
  quitarLinea(i: number): void {
    if (this.lineas.length > 1) this.lineas.splice(i, 1);
  }

  netoNuevo(): number {
    return this.lineas.reduce((a, l) => a + (l.cantidad ?? 0) * (l.precioUni ?? 0), 0);
  }
  ivaNuevo(): number {
    return this.nueva.tipo === 'OC_EXENTA' ? 0 : Math.round(this.netoNuevo() * 0.19);
  }

  async crear(): Promise<void> {
    const detalle = this.lineas
      .filter((l) => l.nombre.trim() && (l.cantidad ?? 0) > 0 && (l.precioUni ?? 0) >= 0)
      .map((l) => ({
        nombre: l.nombre.trim(),
        cantidad: Number(l.cantidad),
        unidad: l.unidad || 'UNI',
        precioUni: Number(l.precioUni),
      }));

    if (!this.nueva.proveedorId) { this.errorForm.set('Falta el id del proveedor.'); return; }
    if (detalle.length === 0) { this.errorForm.set('Agregá al menos una línea con descripción, cantidad y precio.'); return; }

    this.guardando.set(true);
    this.errorForm.set('');
    try {
      const oc = await this.api.crear<Documento>('compras/ordenes', {
        proveedorId: Number(this.nueva.proveedorId),
        ccostoId: this.nueva.ccostoId ? Number(this.nueva.ccostoId) : undefined,
        tipo: this.nueva.tipo,
        observacion: this.nueva.observacion || undefined,
        detalle,
      });
      this.abierta.set(false);
      await this.router.navigate(['/compras/ordenes', oc.id]);
    } catch (e) {
      this.errorForm.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
