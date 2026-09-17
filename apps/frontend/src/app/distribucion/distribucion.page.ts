/**
 * DOC_DISTRIBUIR: reparte una factura entre centros de costo.
 *
 * Listado de facturas y, al elegir una, el reparto. La pantalla insiste en dos
 * cosas del ERP: solo se distribuye una factura ACEPTADA, y la distribucion es
 * un acto unico — para cambiar el reparto hay que deshacer el anterior.
 */
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonMenuButton,
  IonNote, IonSearchbar, IonSegment, IonSegmentButton, IonSelect, IonSelectOption,
  IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';

import { API } from '../core/auth.service';

interface Factura {
  id: number; numdoc: number; tipo_doc: string; fecha: string; cliente: number;
  rut: string; estado: string; neto: number; iva: number; total: number;
  ccosto: string; proveedor: string; hijos: number;
}
interface LineaDet {
  id: number; nombre: string; descripcion: string; total: number;
  unidad: string; ccosto: string; ccosto_ap: string;
}
interface Hijo {
  id: number; numdoc: number; ccosto: string; neto: number;
  iva: number; total: number; estado: string; usuario: string;
}
interface Detalle extends Factura { detalle: LineaDet[]; hijos_docs?: Hijo[]; }

interface Reparto { id_detalle: number; ccosto: string; neto: number | null; exento: 'SI' | 'NO'; }

const clp = (n: unknown) => n == null ? '' : '$' + Math.round(Number(n)).toLocaleString('es-CL');

@Component({
  selector: 'app-distribucion',
  imports: [
    FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent,
    IonSearchbar, IonSegment, IonSegmentButton, IonSpinner, IonNote, IonButton,
    IonItem, IonInput, IonSelect, IonSelectOption,
  ],
  styles: [`
    .barra { display: flex; align-items: center; gap: 10px; padding: 4px 8px; flex-wrap: wrap; }
    .barra ion-searchbar { flex: 1; min-width: 220px; }
    .conteo { font-size: 12px; color: var(--ion-color-medium); white-space: nowrap; padding-right: 12px; }
    .tabla { overflow-x: auto; padding: 0 12px 20px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
         color: var(--ion-color-medium); padding: 8px 10px;
         border-bottom: 1px solid var(--ion-color-light-shade); white-space: nowrap; }
    td { padding: 7px 10px; border-bottom: 1px solid var(--ion-color-light); white-space: nowrap; }
    tr.clic:hover { background: var(--ion-color-light); cursor: pointer; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .pastilla { display: inline-block; padding: 2px 9px; border-radius: 10px;
                font-size: 11px; font-weight: 600; }
    .e-ACEPTADO { background: #d9e8ff; color: #14418a; }
    .e-DISTRIBUIDO { background: #dcf0dc; color: #1d5c26; }
    .e-ANULADO, .e-RECHAZADO { background: #f1d6d6; color: #8a1c1c; }
    .vacio { padding: 40px 20px; text-align: center; color: var(--ion-color-medium); }
    .paginas { display: flex; gap: 10px; align-items: center; justify-content: center; padding: 14px; }
    .aviso { color: var(--ion-color-danger); padding: 8px 14px; font-size: 13px; }
    .ok { color: var(--ion-color-success); padding: 8px 14px; font-size: 13px; }
    .cuerpo { padding: 14px 16px 40px; }
    h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em;
         color: var(--ion-color-medium); margin: 22px 0 6px; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 22px; margin: 0; }
    dt { color: var(--ion-color-medium); font-size: 12px; }
    dd { margin: 0; font-size: 14px; }
    .resumen { margin-top: 14px; font-size: 14px; }
    .resumen strong { font-variant-numeric: tabular-nums; }
    .excede { color: var(--ion-color-danger); }
    .acciones { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
  `],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start">
        @if (sel()) { <ion-button (click)="cerrar()">Volver</ion-button> }
        @else { <ion-menu-button></ion-menu-button> }
      </ion-buttons>
      <ion-title>
        {{ sel() ? 'Factura ' + sel()!.numdoc : 'Distribuye factura por centro de costo' }}
      </ion-title>
    </ion-toolbar></ion-header>

    <ion-content>
      @if (error()) { <div class="aviso">{{ error() }}</div> }
      @if (mensaje()) { <div class="ok">{{ mensaje() }}</div> }

      @if (sel(); as f) {
        <div class="cuerpo">
          <dl>
            <dt>Proveedor</dt><dd>{{ f.proveedor }} ({{ f.rut }})</dd>
            <dt>Tipo / fecha</dt><dd>{{ f.tipo_doc }} · {{ f.fecha?.slice(0, 10) }}</dd>
            <dt>Neto / IVA / Total</dt>
            <dd>{{ moneda(f.neto) }} · {{ moneda(f.iva) }} · <strong>{{ moneda(f.total) }}</strong></dd>
            <dt>Estado</dt>
            <dd><span class="pastilla" [class]="'pastilla e-' + f.estado">{{ f.estado }}</span></dd>
          </dl>

          @if (hijos().length) {
            <h3>Reparto actual</h3>
            <div class="tabla">
              <table>
                <thead><tr>
                  <th>N°</th><th>Centro de costo</th><th class="num">Neto</th>
                  <th class="num">IVA</th><th class="num">Total</th><th>Estado</th><th>Usuario</th>
                </tr></thead>
                <tbody>
                  @for (h of hijos(); track h.id) {
                    <tr>
                      <td>{{ h.numdoc }}</td>
                      <td>{{ h.ccosto }}</td>
                      <td class="num">{{ moneda(h.neto) }}</td>
                      <td class="num">{{ moneda(h.iva) }}</td>
                      <td class="num">{{ moneda(h.total) }}</td>
                      <td><span class="pastilla" [class]="'pastilla e-' + h.estado">{{ h.estado }}</span></td>
                      <td>{{ h.usuario }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          @if (f.estado === 'ACEPTADO') {
            <h3>Nuevo reparto</h3>
            @for (r of reparto(); track $index) {
              <div class="barra">
                <ion-select label="Línea de la factura" labelPlacement="stacked" interface="popover"
                            [value]="r.id_detalle"
                            (ionChange)="r.id_detalle = $any($event).detail.value">
                  @for (l of f.detalle; track l.id) {
                    <ion-select-option [value]="l.id">{{ l.nombre || ('línea ' + l.id) }}</ion-select-option>
                  }
                </ion-select>
                <ion-item><ion-input label="Centro de costo" labelPlacement="stacked"
                                     [(ngModel)]="r.ccosto"></ion-input></ion-item>
                <ion-item><ion-input label="Neto" labelPlacement="stacked" type="number"
                                     [(ngModel)]="r.neto"></ion-input></ion-item>
                <ion-select label="Exento" labelPlacement="stacked" interface="popover"
                            [value]="r.exento" (ionChange)="r.exento = $any($event).detail.value">
                  <ion-select-option value="NO">No</ion-select-option>
                  <ion-select-option value="SI">Sí</ion-select-option>
                </ion-select>
                <ion-button size="small" fill="clear" color="danger"
                            (click)="quitar($index)">Quitar</ion-button>
              </div>
            }

            <div class="acciones">
              <ion-button size="small" fill="outline" (click)="agregar()">Agregar centro</ion-button>
            </div>

            <div class="resumen">
              Repartido: <strong [class.excede]="excede()">{{ moneda(sumaNeto()) }}</strong>
              de {{ moneda(f.neto) }} · queda
              <strong>{{ moneda(f.neto - sumaNeto()) }}</strong>
            </div>
            @if (excede()) {
              <div class="aviso">El reparto supera el neto de la factura.</div>
            }

            <div class="acciones">
              <ion-button (click)="distribuir()"
                          [disabled]="trabajando() || excede() || sumaNeto() <= 0">
                Distribuir
              </ion-button>
            </div>
          } @else if (f.estado === 'DISTRIBUIDO') {
            <div class="acciones">
              <ion-button color="danger" fill="outline" (click)="deshacer()"
                          [disabled]="trabajando()">Deshacer distribución</ion-button>
            </div>
            <ion-note>
              La distribución es un acto único. Para cambiar el reparto hay que deshacer este primero.
            </ion-note>
          } @else {
            <ion-note>
              Solo se puede distribuir una factura en estado ACEPTADO. Esta está en {{ f.estado }}.
            </ion-note>
          }
        </div>

      } @else {
        <ion-segment [value]="estado()" (ionChange)="estado.set($any($event).detail.value)">
          <ion-segment-button value="ACEPTADO"><ion-note>Por distribuir</ion-note></ion-segment-button>
          <ion-segment-button value="DISTRIBUIDO"><ion-note>Distribuidas</ion-note></ion-segment-button>
          <ion-segment-button value=""><ion-note>Todas</ion-note></ion-segment-button>
        </ion-segment>

        <div class="barra">
          <ion-searchbar placeholder="Número, proveedor o RUT" [debounce]="350"
                         (ionInput)="buscar.set($any($event).detail.value ?? '')"></ion-searchbar>
          <span class="conteo">{{ total() }} facturas</span>
        </div>

        @if (cargando()) {
          <div class="vacio"><ion-spinner></ion-spinner></div>
        } @else if (datos().length === 0) {
          <div class="vacio">Sin resultados</div>
        } @else {
          <div class="tabla">
            <table>
              <thead><tr>
                <th>N°</th><th>Tipo</th><th>Fecha</th><th>Proveedor</th>
                <th class="num">Neto</th><th class="num">Total</th>
                <th class="num">Repartos</th><th>Estado</th>
              </tr></thead>
              <tbody>
                @for (d of datos(); track d.id) {
                  <tr class="clic" (click)="abrir(d)">
                    <td>{{ d.numdoc }}</td>
                    <td>{{ d.tipo_doc }}</td>
                    <td>{{ d.fecha?.slice(0, 10) }}</td>
                    <td>{{ d.proveedor }}</td>
                    <td class="num">{{ moneda(d.neto) }}</td>
                    <td class="num">{{ moneda(d.total) }}</td>
                    <td class="num">{{ d.hijos || '' }}</td>
                    <td><span class="pastilla" [class]="'pastilla e-' + d.estado">{{ d.estado }}</span></td>
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
      }
    </ion-content>
  `,
})
export class DistribucionPage {
  private readonly http = inject(HttpClient);

  readonly datos = signal<Factura[]>([]);
  readonly total = signal(0);
  readonly paginas = signal(1);
  readonly pagina = signal(1);
  readonly buscar = signal('');
  readonly estado = signal('ACEPTADO');
  readonly cargando = signal(false);
  readonly trabajando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');

  readonly sel = signal<Detalle | null>(null);
  readonly hijos = signal<Hijo[]>([]);
  readonly reparto = signal<Reparto[]>([]);

  readonly moneda = clp;
  readonly sumaNeto = computed(() =>
    this.reparto().reduce((s, r) => s + Number(r.neto ?? 0), 0));
  readonly excede = computed(() => {
    const f = this.sel();
    return !!f && this.sumaNeto() > Number(f.neto);
  });

  private ultimoFiltro = '';

  constructor() {
    effect(() => {
      const b = this.buscar(); const e = this.estado(); const p = this.pagina();
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
      const r = await firstValueFrom(this.http.get<{
        datos: Factura[]; total: number; paginas: number;
      }>(`${API}/distribucion?${q}`));
      this.datos.set(r.datos);
      this.total.set(r.total);
      this.paginas.set(r.paginas);
    } catch (e: any) {
      this.datos.set([]);
      this.error.set(e?.error?.message ?? 'No se pudieron cargar las facturas');
    } finally {
      this.cargando.set(false);
    }
  }

  async abrir(f: Factura): Promise<void> {
    this.error.set(''); this.mensaje.set('');
    try {
      const d = await firstValueFrom(
        this.http.get<Detalle & { hijos: Hijo[] }>(`${API}/distribucion/${f.id}`),
      );
      // El listado trae "hijos" como conteo; el detalle lo trae como arreglo.
      this.hijos.set((d as any).hijos ?? []);
      this.sel.set({ ...d, hijos: f.hijos } as Detalle);
      const primera = d.detalle?.[0]?.id ?? 0;
      this.reparto.set([{ id_detalle: primera, ccosto: '', neto: null, exento: 'NO' }]);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo abrir la factura');
    }
  }

  cerrar(): void {
    this.sel.set(null); this.hijos.set([]); this.reparto.set([]);
    this.error.set(''); this.mensaje.set('');
    void this.cargar(this.buscar(), this.estado(), this.pagina());
  }

  agregar(): void {
    const primera = this.sel()?.detalle?.[0]?.id ?? 0;
    this.reparto.set([...this.reparto(),
      { id_detalle: primera, ccosto: '', neto: null, exento: 'NO' }]);
  }

  quitar(i: number): void {
    this.reparto.set(this.reparto().filter((_, k) => k !== i));
  }

  async distribuir(): Promise<void> {
    const f = this.sel();
    if (!f) return;
    const lineas = this.reparto()
      .filter((r) => r.ccosto.trim() && Number(r.neto) > 0)
      .map((r) => ({
        id_detalle: r.id_detalle, ccosto: r.ccosto.trim(),
        neto: Number(r.neto), exento: r.exento,
      }));
    if (!lineas.length) { this.error.set('Falta indicar centro de costo y monto'); return; }

    this.trabajando.set(true);
    this.error.set(''); this.mensaje.set('');
    try {
      const r = await firstValueFrom(
        this.http.post<{ mensaje: string }>(`${API}/distribucion/${f.id}`, { lineas }),
      );
      this.mensaje.set(r.mensaje);
      await this.abrir({ ...f, estado: 'DISTRIBUIDO' } as Factura);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo distribuir');
    } finally {
      this.trabajando.set(false);
    }
  }

  async deshacer(): Promise<void> {
    const f = this.sel();
    if (!f) return;
    this.trabajando.set(true);
    this.error.set(''); this.mensaje.set('');
    try {
      const r = await firstValueFrom(
        this.http.delete<{ mensaje: string }>(`${API}/distribucion/${f.id}`),
      );
      this.mensaje.set(r.mensaje);
      await this.abrir(f as Factura);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo deshacer');
    } finally {
      this.trabajando.set(false);
    }
  }
}
