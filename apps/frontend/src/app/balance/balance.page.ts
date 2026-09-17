/**
 * BALANCE_CCOSTO: presupuesto contra gasto por centro de costo.
 *
 * El gasto no sale de una tabla: el backend lo arma como union de cuatro
 * origenes (facturas, rendiciones, vehiculos y consumo de bodega). La pantalla
 * muestra ese desglose a proposito, y deja a la vista que el quinto origen del
 * ERP —costos de personal— no esta, porque el modulo quedo fuera de la replica.
 */
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonMenuButton,
  IonNote, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonSpinner,
  IonTitle, IonToolbar,
} from '@ionic/angular/standalone';

import { API } from '../core/auth.service';

interface FilaResumen {
  ccosto: string; proyecto: string; estado: string;
  presupuesto: string; presupuesto_neto: string;
  responsable: string; gasto: string; movimientos: number;
}
interface Resumen {
  desde: string; hasta: string;
  origenes: string[]; origenesFuera: string[];
  filas: FilaResumen[];
}
interface Origen { origen: string; total: string; movimientos: number; excluido?: boolean; }
interface Categoria { ccosto_ap: string; glosa: string; total: string; movimientos: number; }
interface Movimiento {
  origen: string; fecha: string; numdoc: string; tipo_doc: string;
  total: number; ccosto: string; ccosto_ap: string; glosa: string; nombre: string;
}
interface CentroCosto { ccosto: string; proyecto: string; }

const clp = (n: unknown) => n == null ? '' : '$' + Math.round(Number(n)).toLocaleString('es-CL');

@Component({
  selector: 'app-balance',
  imports: [
    FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent,
    IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonSpinner, IonNote,
    IonButton, IonItem, IonInput,
  ],
  styles: [`
    .barra { display: flex; align-items: flex-end; gap: 12px; padding: 8px 12px; flex-wrap: wrap; }
    .barra > * { min-width: 160px; }
    .tabla { overflow-x: auto; padding: 0 12px 20px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
         color: var(--ion-color-medium); padding: 8px 10px;
         border-bottom: 1px solid var(--ion-color-light-shade); white-space: nowrap; }
    td { padding: 7px 10px; border-bottom: 1px solid var(--ion-color-light); white-space: nowrap; }
    tfoot td { font-weight: 600; border-top: 2px solid var(--ion-color-light-shade); border-bottom: none; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    tr.clic:hover { background: var(--ion-color-light); cursor: pointer; }
    tr.sel { background: var(--ion-color-light); }
    .vacio { padding: 40px 20px; text-align: center; color: var(--ion-color-medium); }
    .aviso { color: var(--ion-color-danger); padding: 8px 14px; font-size: 13px; }
    .nota { padding: 6px 14px 12px; font-size: 12px; color: var(--ion-color-medium); line-height: 1.5; }
    .excluido { opacity: .6; font-style: italic; }
    .paginas { display: flex; gap: 10px; align-items: center; justify-content: center; padding: 14px; }
  `],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
      <ion-title>Balance de centro de costo</ion-title>
    </ion-toolbar></ion-header>

    <ion-content>
      @if (error()) { <div class="aviso">{{ error() }}</div> }

      <div class="barra">
        <ion-item><ion-input label="Desde" labelPlacement="stacked" type="date"
                             [(ngModel)]="desde" (ionChange)="recargar()"></ion-input></ion-item>
        <ion-item><ion-input label="Hasta" labelPlacement="stacked" type="date"
                             [(ngModel)]="hasta" (ionChange)="recargar()"></ion-input></ion-item>
        <ion-select label="Centro de costo" labelPlacement="stacked" interface="popover"
                    [value]="ccosto()" (ionChange)="ccosto.set($any($event).detail.value)">
          <ion-select-option value="">Todos</ion-select-option>
          @for (c of centros(); track c.ccosto) {
            <ion-select-option [value]="c.ccosto">{{ c.ccosto }} — {{ c.proyecto }}</ion-select-option>
          }
        </ion-select>
      </div>

      <ion-segment [value]="vista()" (ionChange)="vista.set($any($event).detail.value)">
        <ion-segment-button value="ccosto"><ion-note>Por centro</ion-note></ion-segment-button>
        <ion-segment-button value="origen"><ion-note>Por origen</ion-note></ion-segment-button>
        <ion-segment-button value="categoria"><ion-note>Por categoría</ion-note></ion-segment-button>
        <ion-segment-button value="detalle"><ion-note>Detalle</ion-note></ion-segment-button>
      </ion-segment>

      @if (cargando()) {
        <div class="vacio"><ion-spinner></ion-spinner></div>
      } @else {

        @switch (vista()) {
          @case ('ccosto') {
            @if (!resumen()?.filas?.length) {
              <div class="vacio">Sin movimientos en el período</div>
            } @else {
              <div class="tabla">
                <table>
                  <thead><tr>
                    <th>Centro de costo</th><th>Proyecto</th><th>Responsable</th>
                    <th class="num">Presupuesto</th><th class="num">Gasto</th>
                    <th class="num">Disponible</th><th class="num">Movs.</th>
                  </tr></thead>
                  <tbody>
                    @for (f of resumen()!.filas; track f.ccosto) {
                      <tr class="clic" [class.sel]="ccosto() === f.ccosto"
                          (click)="ccosto.set(f.ccosto)">
                        <td>{{ f.ccosto }}</td>
                        <td>{{ f.proyecto }}</td>
                        <td>{{ f.responsable }}</td>
                        <td class="num">{{ moneda(f.presupuesto) }}</td>
                        <td class="num">{{ moneda(f.gasto) }}</td>
                        <td class="num">{{ moneda(+f.presupuesto - +f.gasto) }}</td>
                        <td class="num">{{ f.movimientos }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot><tr>
                    <td colspan="3">Total</td>
                    <td class="num">{{ moneda(totalPresupuesto()) }}</td>
                    <td class="num">{{ moneda(totalGasto()) }}</td>
                    <td class="num">{{ moneda(totalPresupuesto() - totalGasto()) }}</td>
                    <td></td>
                  </tr></tfoot>
                </table>
              </div>
              <div class="nota">
                El presupuesto viene en cero porque se anonimizó junto con
                <code>presupuesto_neto</code>.
              </div>
            }
          }

          @case ('origen') {
            <div class="tabla">
              <table>
                <thead><tr>
                  <th>Origen</th><th>Qué agrupa</th>
                  <th class="num">Total</th><th class="num">Movimientos</th>
                </tr></thead>
                <tbody>
                  @for (o of origenes(); track o.origen) {
                    <tr [class.excluido]="o.excluido">
                      <td>{{ o.origen }}</td>
                      <td>{{ glosaOrigen(o.origen) }}</td>
                      <td class="num">{{ moneda(o.total) }}</td>
                      <td class="num">{{ o.movimientos }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="nota">
              El ERP suma cinco orígenes. <strong>RRHH</strong> (costos de personal) aparece
              en cero porque el módulo de Personal quedó fuera de la réplica: su tabla
              <code>rrhh_costos</code> no se migró. No es un error de cálculo.
            </div>
          }

          @case ('categoria') {
            @if (!categorias().length) {
              <div class="vacio">Sin movimientos en el período</div>
            } @else {
              <div class="tabla">
                <table>
                  <thead><tr>
                    <th>Cuenta</th><th>Glosa</th>
                    <th class="num">Total</th><th class="num">Movimientos</th>
                  </tr></thead>
                  <tbody>
                    @for (c of categorias(); track c.ccosto_ap) {
                      <tr>
                        <td>{{ c.ccosto_ap }}</td>
                        <td>{{ c.glosa }}</td>
                        <td class="num">{{ moneda(c.total) }}</td>
                        <td class="num">{{ c.movimientos }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }

          @case ('detalle') {
            @if (!detalle().length) {
              <div class="vacio">Sin movimientos en el período</div>
            } @else {
              <div class="tabla">
                <table>
                  <thead><tr>
                    <th>Fecha</th><th>Origen</th><th>Doc</th><th>N°</th>
                    <th>Centro costo</th><th>Cuenta</th><th>Glosa</th>
                    <th>Tercero</th><th class="num">Total</th>
                  </tr></thead>
                  <tbody>
                    @for (m of detalle(); track $index) {
                      <tr>
                        <td>{{ m.fecha?.slice(0, 10) }}</td>
                        <td>{{ m.origen }}</td>
                        <td>{{ m.tipo_doc }}</td>
                        <td>{{ m.numdoc }}</td>
                        <td>{{ m.ccosto }}</td>
                        <td>{{ m.ccosto_ap }}</td>
                        <td>{{ m.glosa }}</td>
                        <td>{{ m.nombre }}</td>
                        <td class="num">{{ moneda(m.total) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              @if (paginas() > 1) {
                <div class="paginas">
                  <ion-button size="small" fill="clear" [disabled]="pagina() <= 1"
                              (click)="pagina.set(pagina() - 1)">Anterior</ion-button>
                  <ion-note>{{ pagina() }} / {{ paginas() }} · {{ totalDetalle() }} movimientos</ion-note>
                  <ion-button size="small" fill="clear" [disabled]="pagina() >= paginas()"
                              (click)="pagina.set(pagina() + 1)">Siguiente</ion-button>
                </div>
              }
            }
          }
        }
      }
    </ion-content>
  `,
})
export class BalancePage {
  private readonly http = inject(HttpClient);

  desde = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  hasta = new Date().toISOString().slice(0, 10);

  readonly ccosto = signal('');
  readonly vista = signal<'ccosto' | 'origen' | 'categoria' | 'detalle'>('ccosto');
  readonly pagina = signal(1);
  readonly cargando = signal(false);
  readonly error = signal('');

  readonly centros = signal<CentroCosto[]>([]);
  readonly resumen = signal<Resumen | null>(null);
  readonly origenes = signal<Origen[]>([]);
  readonly categorias = signal<Categoria[]>([]);
  readonly detalle = signal<Movimiento[]>([]);
  readonly totalDetalle = signal(0);
  readonly paginas = signal(1);

  readonly moneda = clp;
  readonly totalGasto = computed(() =>
    (this.resumen()?.filas ?? []).reduce((s, f) => s + Number(f.gasto), 0));
  readonly totalPresupuesto = computed(() =>
    (this.resumen()?.filas ?? []).reduce((s, f) => s + Number(f.presupuesto), 0));

  glosaOrigen(o: string): string {
    return ({
      RECIBIDOS: 'Facturas de proveedor',
      RIN_GASTO: 'Rendiciones de gastos',
      MOV_BODEGA: 'Acumulado de vehículos y equipos',
      INV_BODEGA: 'Consumo de material de bodega',
      RRHH: 'Costos de personal — módulo fuera de la réplica',
    } as Record<string, string>)[o] ?? o;
  }

  private ultimo = '';

  constructor() {
    void this.cargarCentros();
    effect(() => {
      const v = this.vista(); const c = this.ccosto(); const p = this.pagina();
      const clave = `${v}|${c}|${this.desde}|${this.hasta}`;
      const pg = clave !== this.ultimo && v === 'detalle' ? 1 : p;
      this.ultimo = clave;
      void this.cargar(v, c, pg);
    });
  }

  recargar(): void {
    this.ultimo = '';
    void this.cargar(this.vista(), this.ccosto(), 1);
  }

  private params(ccosto: string): string {
    const q = new URLSearchParams({ fini: this.desde, ffin: this.hasta });
    if (ccosto) q.set('ccosto', ccosto);
    return q.toString();
  }

  private async cargarCentros(): Promise<void> {
    try {
      this.centros.set(
        await firstValueFrom(this.http.get<CentroCosto[]>(`${API}/balance/ccostos`)),
      );
    } catch { this.centros.set([]); }
  }

  private async cargar(vista: string, ccosto: string, pagina: number): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const p = this.params(ccosto);
      if (vista === 'ccosto') {
        this.resumen.set(await firstValueFrom(
          this.http.get<Resumen>(`${API}/balance/resumen?${p}`)));
      } else if (vista === 'origen') {
        this.origenes.set(await firstValueFrom(
          this.http.get<Origen[]>(`${API}/balance/origenes?${p}`)));
      } else if (vista === 'categoria') {
        this.categorias.set(await firstValueFrom(
          this.http.get<Categoria[]>(`${API}/balance/categorias?${p}`)));
      } else {
        const r = await firstValueFrom(this.http.get<{
          datos: Movimiento[]; total: number; paginas: number;
        }>(`${API}/balance/detalle?${p}&pagina=${pagina}&limite=100`));
        this.detalle.set(r.datos);
        this.totalDetalle.set(r.total);
        this.paginas.set(r.paginas);
      }
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo cargar el balance');
    } finally {
      this.cargando.set(false);
    }
  }
}
