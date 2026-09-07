/**
<<<<<<< Updated upstream
 * Libro de movimientos de bodega, con las tres operaciones que lo alimentan:
 * entrega a persona, traspaso entre bodegas y ajuste de stock.
 *
 * En el listado, una entrega a persona aparece como DOS filas con el mismo
 * número de documento: la salida real y la imputación de costo. Se muestran
 * las dos porque así están en la base, y esconder una haría creer que el libro
 * cuadra con el saldo, cosa que no ocurre en este diseño.
 */
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem,
  IonList, IonMenuButton, IonModal, IonSearchbar, IonSelect, IonSelectOption,
  IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, swapHorizontalOutline, trashOutline, buildOutline } from 'ionicons/icons';

import { ApiService, mensajeDeError } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { clp, type FilaStock, type MovimientoBodega } from '../core/modelos';

type Operacion = 'entrega' | 'traspaso' | 'ajuste';

interface LineaOp {
  materialId: number | null;
  cantidad: number | null;
}

/** Campos de las tres operaciones; cada una usa los suyos. */
interface FormOperacion {
  bodegaId: number | null;
  bodegaOrigenId: number | null;
  bodegaDestinoId: number | null;
  ccostoDestinoId: number | null;
  responsableId: number | null;
  materialId: number | null;
  nuevoStock: number | null;
  motivo: string;
  observacion: string;
}

const formVacio = (): FormOperacion => ({
  bodegaId: null, bodegaOrigenId: null, bodegaDestinoId: null,
  ccostoDestinoId: null, responsableId: null, materialId: null,
  nuevoStock: null, motivo: '', observacion: '',
});

@Component({
  selector: 'app-movimientos',
  imports: [
    DatePipe, FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton,
    IonContent, IonSearchbar, IonButton, IonIcon, IonSpinner, IonBadge, IonModal,
    IonList, IonItem, IonInput, IonSelect, IonSelectOption,
  ],
  styles: [
    `
      .barra { display: flex; gap: 10px; align-items: center; padding: 8px 12px; flex-wrap: wrap; }
      .barra ion-searchbar { flex: 1 1 220px; padding: 0; }
      .acciones { display: flex; gap: 8px; padding: 0 12px 8px; flex-wrap: wrap; }
      .envoltura { overflow-x: auto; padding: 0 12px 16px; }
      table { border-collapse: collapse; width: 100%; font-size: 14px; }
      th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--ion-color-light-shade); white-space: nowrap; }
      th { font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--ion-color-medium); font-weight: 600; }
      td.num { text-align: right; font-variant-numeric: tabular-nums; }
      .vacio, .error { padding: 32px 16px; text-align: center; color: var(--ion-color-medium); }
      .error { color: var(--ion-color-danger); }
      .pie { display: flex; align-items: center; gap: 14px; padding: 4px 14px 20px; font-size: 13px; color: var(--ion-color-medium); }
      .nota { font-size: 12px; color: var(--ion-color-medium); padding: 6px 16px 14px; line-height: 1.55; }
      .fila-linea { display: grid; grid-template-columns: 1fr 110px 40px; gap: 8px; align-items: end; margin-bottom: 8px; padding: 0 16px; }
      @media (max-width: 640px) { .fila-linea { grid-template-columns: 1fr; } }
    `,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>Movimientos de bodega</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="acciones">
        @if (puede('Movimientos')) {
          <ion-button size="small" (click)="abrir('entrega')">
            <ion-icon slot="start" name="add-outline"></ion-icon> Entregar
          </ion-button>
          <ion-button size="small" fill="outline" (click)="abrir('traspaso')">
            <ion-icon slot="start" name="swap-horizontal-outline"></ion-icon> Traspasar
          </ion-button>
        }
        @if (puede('Ajusta stock')) {
          <ion-button size="small" fill="outline" color="medium" (click)="abrir('ajuste')">
            <ion-icon slot="start" name="build-outline"></ion-icon> Ajustar stock
          </ion-button>
        }
      </div>

      <div class="barra">
        <ion-searchbar placeholder="Material, documento u observación" [debounce]="350"
          (ionInput)="buscar($any($event).detail.value ?? '')"></ion-searchbar>
        <ion-select placeholder="Todas las bodegas" interface="popover" [(ngModel)]="bodega"
          (ionChange)="recargar()" style="min-width:190px">
          <ion-select-option [value]="''">Todas las bodegas</ion-select-option>
          @for (b of bodegas(); track b.codigo) {
            <ion-select-option [value]="b.codigo">{{ b.nombre }}</ion-select-option>
          }
        </ion-select>
      </div>

      @if (aviso()) { <div class="error">{{ aviso() }}</div> }

      @if (cargando()) {
        <div class="vacio"><ion-spinner name="crescent"></ion-spinner></div>
      } @else if (error()) {
        <div class="error">{{ error() }}</div>
      } @else if (movs().length === 0) {
        <div class="vacio">Todavía no hay movimientos.</div>
      } @else {
        <div class="envoltura">
          <table>
            <thead>
              <tr>
                <th style="width:80px">Doc</th>
                <th style="width:90px">Tipo</th>
                <th style="width:70px">Mov</th>
                <th style="width:110px">Fecha</th>
                <th style="width:110px">Código</th>
                <th>Material</th>
                <th>Bodega</th>
                <th style="width:90px">Cantidad</th>
                <th style="width:140px">Centro de costo</th>
                <th>Observación</th>
                <th style="width:100px"></th>
              </tr>
            </thead>
            <tbody>
              @for (m of movs(); track m.id) {
                <tr>
                  <td>{{ m.numdoc }}</td>
                  <td>{{ m.tipoDoc }}</td>
                  <td>
                    <ion-badge [color]="m.tipoMov === 'IN' ? 'success' : 'warning'">{{ m.tipoMov }}</ion-badge>
                  </td>
                  <td>{{ m.fecha | date: 'dd-MM-yyyy' }}</td>
                  <td>{{ m.codMaterial }}</td>
                  <td>{{ m.material }}</td>
                  <td>{{ m.bodega }}</td>
                  <td class="num">{{ m.cantidad }} {{ m.unidad }}</td>
                  <td>{{ m.ccosto ?? '—' }}</td>
                  <td>{{ m.observacion }}</td>
                  <td>
                    @if (!m.origenTipo && puede('Elimina movimiento')) {
                      <ion-button size="small" fill="clear" color="danger"
                        (click)="eliminar(m.id)" [disabled]="trabajando()">
                        <ion-icon slot="icon-only" name="trash-outline"></ion-icon>
                      </ion-button>
=======
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
>>>>>>> Stashed changes
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

<<<<<<< Updated upstream
        <p class="nota">
          Una entrega a persona deja dos filas con el mismo número de documento: la
          salida de la bodega y la imputación del costo al centro de costo de quien
          recibe. Solo la primera descuenta stock.
        </p>

        <div class="pie">
          <span>{{ total() }} movimiento(s)</span>
          @if (paginas() > 1) {
            <ion-button size="small" fill="clear" [disabled]="pagina() === 1" (click)="irA(pagina() - 1)">Anterior</ion-button>
            <span>Página {{ pagina() }} de {{ paginas() }}</span>
            <ion-button size="small" fill="clear" [disabled]="pagina() === paginas()" (click)="irA(pagina() + 1)">Siguiente</ion-button>
          }
        </div>
      }

      <ion-modal [isOpen]="modal() !== null" (didDismiss)="modal.set(null)">
        <ng-template>
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ titulo() }}</ion-title>
              <ion-buttons slot="end"><ion-button (click)="modal.set(null)">Cerrar</ion-button></ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <ion-list>
              @if (modal() === 'traspaso') {
                <ion-item>
                  <ion-select label="Bodega de origen *" labelPlacement="stacked" interface="popover"
                    [(ngModel)]="form.bodegaOrigenId">
                    @for (b of bodegas(); track b.id) { <ion-select-option [value]="b.id">{{ b.nombre }}</ion-select-option> }
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-select label="Bodega de destino *" labelPlacement="stacked" interface="popover"
                    [(ngModel)]="form.bodegaDestinoId">
                    @for (b of bodegas(); track b.id) { <ion-select-option [value]="b.id">{{ b.nombre }}</ion-select-option> }
                  </ion-select>
                </ion-item>
              } @else {
                <ion-item>
                  <ion-select label="Bodega *" labelPlacement="stacked" interface="popover"
                    [(ngModel)]="form.bodegaId">
                    @for (b of bodegas(); track b.id) { <ion-select-option [value]="b.id">{{ b.nombre }}</ion-select-option> }
                  </ion-select>
                </ion-item>
              }

              @if (modal() === 'entrega') {
                <ion-item>
                  <ion-input label="Id del centro de costo que recibe *" labelPlacement="stacked"
                    type="number" [(ngModel)]="form.ccostoDestinoId"></ion-input>
                </ion-item>
                <ion-item>
                  <ion-input label="Id del usuario que recibe" labelPlacement="stacked"
                    type="number" [(ngModel)]="form.responsableId"></ion-input>
                </ion-item>
              }

              @if (modal() === 'ajuste') {
                <ion-item>
                  <ion-select label="Material *" labelPlacement="stacked" interface="popover"
                    [(ngModel)]="form.materialId">
                    @for (s of stockDeBodega(); track s.materialId) {
                      <ion-select-option [value]="s.materialId">
                        {{ s.codMaterial }} — {{ s.nombre }} (hay {{ s.stock }})
                      </ion-select-option>
                    }
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-input label="Stock que debe quedar *" labelPlacement="stacked" type="number"
                    [(ngModel)]="form.nuevoStock"></ion-input>
                </ion-item>
                <ion-item>
                  <ion-input label="Motivo *" labelPlacement="stacked" [(ngModel)]="form.motivo"
                    placeholder="Diferencia en inventario físico"></ion-input>
                </ion-item>
              } @else {
                <ion-item>
                  <ion-input label="Observación" labelPlacement="stacked" [(ngModel)]="form.observacion"></ion-input>
                </ion-item>
              }
            </ion-list>

            @if (modal() !== 'ajuste') {
              <h3 style="font-size:14px;margin:14px 16px 8px">Materiales</h3>
              @for (l of lineas; track $index) {
                <div class="fila-linea">
                  <ion-select label="Material" labelPlacement="stacked" interface="popover"
                    [(ngModel)]="l.materialId">
                    @for (s of stockDeBodega(); track s.materialId) {
                      <ion-select-option [value]="s.materialId">
                        {{ s.codMaterial }} — {{ s.nombre }} (hay {{ s.stock }})
                      </ion-select-option>
                    }
                  </ion-select>
                  <ion-input label="Cantidad" labelPlacement="stacked" type="number" [(ngModel)]="l.cantidad"></ion-input>
                  <ion-button fill="clear" color="danger" (click)="quitar($index)" [disabled]="lineas.length === 1">
                    <ion-icon slot="icon-only" name="trash-outline"></ion-icon>
                  </ion-button>
                </div>
              }
              <div style="padding:0 16px">
                <ion-button size="small" fill="outline" (click)="agregar()">
                  <ion-icon slot="start" name="add-outline"></ion-icon> Agregar material
                </ion-button>
              </div>
              <p class="nota">La lista muestra solo materiales con saldo en la bodega elegida.</p>
            }

            @if (errorForm()) { <div class="error">{{ errorForm() }}</div> }

            <div style="padding:8px 16px 24px">
              <ion-button expand="block" (click)="confirmar()" [disabled]="trabajando()">
                @if (trabajando()) { <ion-spinner name="crescent"></ion-spinner> } @else { Confirmar }
              </ion-button>
            </div>
          </ion-content>
        </ng-template>
      </ion-modal>
=======
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
>>>>>>> Stashed changes
    </ion-content>
  `,
})
export class MovimientosPage {
<<<<<<< Updated upstream
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly movs = signal<MovimientoBodega[]>([]);
  readonly stock = signal<FilaStock[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly paginas = signal(1);
  readonly cargando = signal(false);
  readonly trabajando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');

  readonly modal = signal<Operacion | null>(null);
  readonly errorForm = signal('');

  bodega = '';
  private texto = '';

  form: FormOperacion = formVacio();
  lineas: LineaOp[] = [];

  readonly moneda = clp;

  puede(p: string): boolean { return this.auth.puede(p); }

  readonly titulo = computed(() =>
    ({ entrega: 'Entregar material', traspaso: 'Traspasar entre bodegas', ajuste: 'Ajustar stock' })[
      this.modal() ?? 'entrega'
    ],
  );

  /** Bodegas deducidas del stock: evita una llamada extra al mantenedor. */
  readonly bodegas = computed(() => {
    const m = new Map<number, { id: number; codigo: number; nombre: string }>();
    for (const s of this.stock()) {
      m.set(s.bodegaId, { id: s.bodegaId, codigo: s.bodegaCodigo, nombre: s.bodega });
    }
    return [...m.values()].sort((a, b) => a.codigo - b.codigo);
  });

  /** Materiales con saldo en la bodega seleccionada dentro del formulario. */
  readonly stockDeBodega = computed(() => {
    const id = Number(this.form.bodegaOrigenId ?? this.form.bodegaId);
    const filas = this.stock().filter((s) => s.stock > 0);
    return Number.isFinite(id) && id > 0 ? filas.filter((s) => s.bodegaId === id) : filas;
  });

  ionViewWillEnter(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const [p, s] = await Promise.all([
        this.api.movimientos({
          pagina: this.pagina(),
          limite: 25,
          buscar: this.texto || undefined,
          bodega: this.bodega || undefined,
        }),
        this.api.stock(),
      ]);
      this.movs.set(p.datos);
      this.total.set(p.total);
      this.paginas.set(p.paginas);
      this.stock.set(s);
    } catch (e) {
      this.error.set(mensajeDeError(e));
=======
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
>>>>>>> Stashed changes
    } finally {
      this.cargando.set(false);
    }
  }

<<<<<<< Updated upstream
  buscar(t: string): void { this.texto = t; this.pagina.set(1); void this.cargar(); }
  recargar(): void { this.pagina.set(1); void this.cargar(); }
  irA(p: number): void { this.pagina.set(p); void this.cargar(); }

  abrir(op: Operacion): void {
    this.form = formVacio();
    this.lineas = [{ materialId: null, cantidad: null }];
    this.errorForm.set('');
    this.modal.set(op);
  }

  agregar(): void { this.lineas.push({ materialId: null, cantidad: null }); }
  quitar(i: number): void { if (this.lineas.length > 1) this.lineas.splice(i, 1); }

  private lineasValidas(): Array<{ materialId: number; cantidad: number }> {
    return this.lineas
      .filter((l) => l.materialId && (l.cantidad ?? 0) > 0)
      .map((l) => ({ materialId: Number(l.materialId), cantidad: Number(l.cantidad) }));
  }

  async confirmar(): Promise<void> {
    const op = this.modal();
    if (!op) return;

    this.trabajando.set(true);
    this.errorForm.set('');
    try {
      if (op === 'ajuste') {
        if (!this.form.bodegaId || !this.form.materialId || !this.form.motivo.trim()) {
          this.errorForm.set('Faltan bodega, material o motivo.');
          return;
        }
        await this.api.crear('bodega/ajustes', {
          bodegaId: Number(this.form.bodegaId),
          materialId: Number(this.form.materialId),
          nuevoStock: Number(this.form.nuevoStock ?? 0),
          motivo: this.form.motivo.trim(),
        });
      } else {
        const lineas = this.lineasValidas();
        if (lineas.length === 0) {
          this.errorForm.set('Agregá al menos un material con cantidad.');
          return;
        }

        if (op === 'entrega') {
          if (!this.form.bodegaId || !this.form.ccostoDestinoId) {
            this.errorForm.set('Faltan la bodega o el centro de costo que recibe.');
            return;
          }
          await this.api.crear('bodega/entregas', {
            bodegaId: Number(this.form.bodegaId),
            ccostoDestinoId: Number(this.form.ccostoDestinoId),
            responsableId: this.form.responsableId ? Number(this.form.responsableId) : undefined,
            observacion: this.form.observacion || undefined,
            lineas,
          });
        } else {
          if (!this.form.bodegaOrigenId || !this.form.bodegaDestinoId) {
            this.errorForm.set('Faltan la bodega de origen o la de destino.');
            return;
          }
          await this.api.crear('bodega/traspasos', {
            bodegaOrigenId: Number(this.form.bodegaOrigenId),
            bodegaDestinoId: Number(this.form.bodegaDestinoId),
            observacion: this.form.observacion || undefined,
            lineas,
          });
        }
      }

      this.modal.set(null);
      await this.cargar();
    } catch (e) {
      this.errorForm.set(mensajeDeError(e));
    } finally {
      this.trabajando.set(false);
    }
  }

  async eliminar(id: number): Promise<void> {
    this.trabajando.set(true);
    this.aviso.set('');
    try {
      await this.api.eliminar(`bodega/movimientos/${id}`);
      await this.cargar();
    } catch (e) {
      this.aviso.set(mensajeDeError(e));
    } finally {
      this.trabajando.set(false);
    }
  }

  constructor() {
    addIcons({ addOutline, swapHorizontalOutline, trashOutline, buildOutline });
  }
=======
  async eliminar(m: Mov): Promise<void> {
    this.error.set('');
    try {
      await firstValueFrom(this.http.delete(`${API}/bodega/movimientos/${m.id}`));
      await this.cargar(this.bodega(), this.tipoVhe(), this.idVhe(), this.pagina());
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo eliminar');
    }
  }
>>>>>>> Stashed changes
}
