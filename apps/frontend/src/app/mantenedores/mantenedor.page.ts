/**
 * Pantalla genérica de mantenedor.
 *
 * Una sola pantalla sirve a los cinco mantenedores, leyendo su definición de
 * mantenedor.config.ts. Es la traducción del patrón Mant_Tablas del ERP.
 */
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonMenuButton,
  IonModal,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, createOutline } from 'ionicons/icons';

import { ApiService, mensajeDeError } from '../core/api.service';
import { clp } from '../core/modelos';
import { buscarConfig, type CampoMantenedor, type ConfigMantenedor } from './mantenedor.config';

type Fila = Record<string, unknown>;

@Component({
  selector: 'app-mantenedor',
  imports: [
    FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent,
    IonSearchbar, IonButton, IonIcon, IonSpinner, IonModal, IonList, IonItem,
    IonInput, IonSelect, IonSelectOption,
  ],
  styles: [
    `
      .barra { display: flex; gap: 10px; align-items: center; padding: 8px 12px; flex-wrap: wrap; }
      .barra ion-searchbar { flex: 1 1 240px; padding: 0; }
      .envoltura { overflow-x: auto; padding: 0 12px 16px; }
      table { border-collapse: collapse; width: 100%; font-size: 14px; }
      th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--ion-color-light-shade); white-space: nowrap; }
      th { font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--ion-color-medium); font-weight: 600; }
      td.num { text-align: right; font-variant-numeric: tabular-nums; }
      tr.clic:hover { background: var(--ion-color-light); cursor: pointer; }
      .pie { display: flex; align-items: center; gap: 14px; padding: 4px 14px 20px; font-size: 13px; color: var(--ion-color-medium); }
      .vacio, .error { padding: 32px 16px; text-align: center; color: var(--ion-color-medium); }
      .error { color: var(--ion-color-danger); }
      .ayuda { font-size: 12px; color: var(--ion-color-medium); padding: 0 16px 10px; }
    `,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
        <ion-title>{{ config()?.titulo }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="abrirNuevo()">
            <ion-icon slot="start" name="add-outline"></ion-icon>
            Nuevo
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="barra">
        <ion-searchbar
          placeholder="Buscar"
          [debounce]="350"
          (ionInput)="buscar($any($event).detail.value ?? '')"
        ></ion-searchbar>
      </div>

      @if (cargando()) {
        <div class="vacio"><ion-spinner name="crescent"></ion-spinner></div>
      } @else if (error()) {
        <div class="error">{{ error() }}</div>
      } @else if (filas().length === 0) {
        <div class="vacio">Sin resultados.</div>
      } @else {
        <div class="envoltura">
          <table>
            <thead>
              <tr>
                @for (c of config()!.columnas; track c.clave) {
                  <th [style.width]="c.ancho">{{ c.etiqueta }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (f of filas(); track $index) {
                <tr class="clic" (click)="abrirEdicion(f)">
                  @for (c of config()!.columnas; track c.clave) {
                    <td [class.num]="c.formato === 'moneda' || c.formato === 'numero'">
                      {{ celda(f, c.clave, c.formato) }}
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="pie">
          <span>{{ total() }} registro(s)</span>
          @if (paginas() > 1) {
            <ion-button size="small" fill="clear" [disabled]="pagina() === 1" (click)="irA(pagina() - 1)">Anterior</ion-button>
            <span>Página {{ pagina() }} de {{ paginas() }}</span>
            <ion-button size="small" fill="clear" [disabled]="pagina() === paginas()" (click)="irA(pagina() + 1)">Siguiente</ion-button>
          }
        </div>
      }

      <ion-modal [isOpen]="abierto()" (didDismiss)="abierto.set(false)">
        <ng-template>
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ editandoId() ? 'Modificar' : 'Nuevo' }} — {{ config()?.titulo }}</ion-title>
              <ion-buttons slot="end"><ion-button (click)="abierto.set(false)">Cerrar</ion-button></ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <ion-list>
              @for (campo of camposVisibles(); track campo.clave) {
                <ion-item>
                  @if (campo.tipo === 'select') {
                    <ion-select
                      [label]="campo.etiqueta"
                      labelPlacement="stacked"
                      [(ngModel)]="formulario[campo.clave]"
                      interface="popover"
                    >
                      @for (o of campo.opciones ?? []; track o) {
                        <ion-select-option [value]="o">{{ o }}</ion-select-option>
                      }
                    </ion-select>
                  } @else {
                    <ion-input
                      [label]="campo.etiqueta + (campo.requerido ? ' *' : '')"
                      labelPlacement="stacked"
                      [type]="campo.tipo === 'numero' ? 'number' : 'text'"
                      [(ngModel)]="formulario[campo.clave]"
                    ></ion-input>
                  }
                </ion-item>
                @if (campo.ayuda) {
                  <div class="ayuda">{{ campo.ayuda }}</div>
                }
              }
            </ion-list>

            @if (errorForm()) {
              <div class="error">{{ errorForm() }}</div>
            }

            <div style="padding: 8px 16px 24px">
              <ion-button expand="block" (click)="guardar()" [disabled]="guardando()">
                @if (guardando()) { <ion-spinner name="crescent"></ion-spinner> } @else { Guardar }
              </ion-button>
            </div>
          </ion-content>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
})
export class MantenedorPage {
  private readonly api = inject(ApiService);

  /** Llega desde la ruta con withComponentInputBinding(). */
  readonly tipo = input.required<string>();

  readonly config = computed<ConfigMantenedor | undefined>(() => buscarConfig(this.tipo()));

  readonly filas = signal<Fila[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly paginas = signal(1);
  readonly cargando = signal(false);
  readonly error = signal('');

  readonly abierto = signal(false);
  readonly editandoId = signal<number | null>(null);
  readonly guardando = signal(false);
  readonly errorForm = signal('');
  formulario: Record<string, unknown> = {};

  private texto = '';
  private ultimaRuta = '';

  constructor() {
    addIcons({ addOutline, createOutline });
  }

  ionViewWillEnter(): void {
    // La pantalla se reutiliza entre mantenedores: si cambió la ruta, se
    // reinicia el estado antes de cargar.
    if (this.ultimaRuta !== this.tipo()) {
      this.ultimaRuta = this.tipo();
      this.texto = '';
      this.pagina.set(1);
      this.filas.set([]);
    }
    void this.cargar();
  }

  readonly camposVisibles = computed(() => {
    const campos = this.config()?.campos ?? [];
    return this.editandoId() === null ? campos : campos.filter((c) => !c.soloAlCrear);
  });

  async cargar(): Promise<void> {
    const cfg = this.config();
    if (!cfg) {
      this.error.set('Mantenedor desconocido');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    try {
      const p = await this.api.listar<Fila>(cfg.recurso, {
        pagina: this.pagina(),
        limite: 25,
        buscar: this.texto || undefined,
      });
      this.filas.set(p.datos);
      this.total.set(p.total);
      this.paginas.set(p.paginas);
    } catch (e) {
      this.error.set(mensajeDeError(e));
      this.filas.set([]);
    } finally {
      this.cargando.set(false);
    }
  }

  buscar(t: string): void {
    this.texto = t;
    this.pagina.set(1);
    void this.cargar();
  }

  irA(p: number): void {
    this.pagina.set(p);
    void this.cargar();
  }

  celda(fila: Fila, ruta: string, formato?: string): string {
    const valor = ruta
      .split('.')
      .reduce<unknown>((o, k) => (o == null ? undefined : (o as Fila)[k]), fila);
    if (valor == null || valor === '') return '—';
    if (formato === 'moneda') return clp(Number(valor));
    if (formato === 'numero') return String(Number(valor));
    return String(valor);
  }

  abrirNuevo(): void {
    this.editandoId.set(null);
    this.formulario = {};
    this.errorForm.set('');
    this.abierto.set(true);
  }

  abrirEdicion(fila: Fila): void {
    const cfg = this.config();
    if (!cfg) return;

    // El listado de materiales viene de una vista y trae `materialId`/`id`
    // según el caso; se toma el que exista.
    const id = Number(fila['id'] ?? fila['materialId']);
    this.editandoId.set(Number.isFinite(id) ? id : null);

    this.formulario = {};
    for (const campo of cfg.campos) {
      if (campo.soloAlCrear) continue;
      const v = fila[campo.clave];
      if (v !== undefined && v !== null) this.formulario[campo.clave] = v;
    }
    this.errorForm.set('');
    this.abierto.set(true);
  }

  private limpiar(cfg: ConfigMantenedor): Record<string, unknown> {
    const salida: Record<string, unknown> = {};
    const porClave = new Map<string, CampoMantenedor>(cfg.campos.map((c) => [c.clave, c]));

    for (const [k, v] of Object.entries(this.formulario)) {
      if (v === '' || v === null || v === undefined) continue;
      const campo = porClave.get(k);
      salida[k] = campo?.tipo === 'numero' ? Number(v) : v;
    }
    return salida;
  }

  async guardar(): Promise<void> {
    const cfg = this.config();
    if (!cfg) return;

    const cuerpo = this.limpiar(cfg);
    const faltan = cfg.campos
      .filter((c) => c.requerido && (this.editandoId() === null || !c.soloAlCrear))
      .filter((c) => cuerpo[c.clave] === undefined)
      .map((c) => c.etiqueta);

    if (faltan.length > 0) {
      this.errorForm.set(`Faltan campos obligatorios: ${faltan.join(', ')}`);
      return;
    }

    this.guardando.set(true);
    this.errorForm.set('');
    try {
      const id = this.editandoId();
      if (id === null) await this.api.crear(cfg.recurso, cuerpo);
      else await this.api.actualizar(cfg.recurso, id, cuerpo);

      this.abierto.set(false);
      await this.cargar();
    } catch (e) {
      this.errorForm.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
