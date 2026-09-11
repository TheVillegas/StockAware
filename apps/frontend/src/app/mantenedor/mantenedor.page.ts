/**
 * Pantalla unica de mantenedores, igual que Mant_Tablas.php.
 *
 * No hay una pantalla por maestro: hay una sola, y el backend le dice que
 * columnas mostrar, cuales son de solo lectura y si el perfil puede editar.
 * Si el codigo de la ruta no corresponde a un mantenedor, se muestra el
 * marcador de "pendiente" en vez de un error.
 */
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonLabel,
  IonMenuButton, IonNote, IonSearchbar, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';

import { API } from '../core/auth.service';

interface Pagina {
  codigo: string;
  titulo: string;
  columnas: string[];
  soloLectura: string[];
  pk: string;
  puedeEditar: boolean;
  datos: Record<string, any>[];
  total: number;
  pagina: number;
  paginas: number;
}

@Component({
  selector: 'app-mantenedor',
  imports: [
    FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton,
    IonContent, IonSearchbar, IonSpinner, IonNote, IonButton, IonItem, IonInput, IonLabel,
  ],
  styles: [`
    .barra { display: flex; align-items: center; gap: 10px; padding: 0 8px; }
    .barra ion-searchbar { flex: 1; }
    .conteo { font-size: 12px; color: var(--ion-color-medium); white-space: nowrap; padding-right: 12px; }
    .tabla { overflow-x: auto; padding: 0 12px 20px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th { text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase;
         letter-spacing: .05em; color: var(--ion-color-medium); padding: 8px 10px;
         border-bottom: 1px solid var(--ion-color-light-shade); white-space: nowrap; }
    td { padding: 7px 10px; border-bottom: 1px solid var(--ion-color-light); white-space: nowrap; }
    tr.editable:hover { background: var(--ion-color-light); cursor: pointer; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .paginas { display: flex; gap: 10px; align-items: center; justify-content: center; padding: 14px; }
    .vacio { padding: 40px 20px; text-align: center; color: var(--ion-color-medium); }
    .ficha { padding: 4px 12px 20px; max-width: 620px; }
    .ficha h3 { font-size: 15px; margin: 14px 0 4px; }
    .acciones { display: flex; gap: 10px; padding: 14px 12px; }
    .aviso { color: var(--ion-color-danger); padding: 0 14px; font-size: 13px; }
  `],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-menu-button></ion-menu-button></ion-buttons>
      <ion-title>{{ pag()?.titulo ?? codigo() }}</ion-title>
      @if (editando()) {
        <ion-buttons slot="end">
          <ion-button (click)="cerrarFicha()">Volver</ion-button>
        </ion-buttons>
      }
    </ion-toolbar></ion-header>

    <ion-content>
      @if (cargando()) {
        <div class="vacio"><ion-spinner></ion-spinner></div>
      } @else if (noEsMantenedor()) {
        <div class="ficha">
          <ion-note>Pendiente de construir</ion-note>
          <p>La opción <code>{{ codigo() }}</code> todavía no tiene pantalla.</p>
        </div>
      } @else if (editando(); as fila) {
        <div class="ficha">
          @for (c of camposEditables(); track c) {
            <ion-item>
              <ion-input [label]="c" labelPlacement="stacked"
                         [(ngModel)]="fila[c]" [disabled]="!pag()!.puedeEditar"></ion-input>
            </ion-item>
          }
          @if (derivadas().length) {
            <h3>Derivados de la vista</h3>
            @for (c of derivadas(); track c) {
              <ion-item lines="none">
                <ion-label>
                  <ion-note>{{ c }}</ion-note>
                  <div>{{ fila[c] }}</div>
                </ion-label>
              </ion-item>
            }
          }
        </div>
        @if (error()) { <div class="aviso">{{ error() }}</div> }
        <div class="acciones">
          <ion-button (click)="guardar()" [disabled]="!pag()!.puedeEditar || guardando()">
            {{ guardando() ? 'Guardando...' : 'Guardar' }}
          </ion-button>
          <ion-button fill="clear" (click)="cerrarFicha()">Cancelar</ion-button>
        </div>
        @if (!pag()!.puedeEditar) {
          <div class="aviso">Tu perfil puede ver este maestro, pero no modificarlo.</div>
        }
      } @else if (pag(); as p) {
        @if (error()) { <div class="aviso">{{ error() }}</div> }
        <div class="barra">
          <ion-searchbar placeholder="Buscar" [debounce]="350"
                         (ionInput)="buscar.set($any($event).detail.value ?? '')"></ion-searchbar>
          <span class="conteo">{{ p.total }} registros</span>
        </div>

        @if (p.datos.length === 0) {
          <div class="vacio">Sin resultados</div>
        } @else {
          <div class="tabla">
            <table>
              <thead><tr>@for (c of p.columnas; track c) { <th>{{ c }}</th> }</tr></thead>
              <tbody>
                @for (f of p.datos; track $index) {
                  <tr class="editable" (click)="abrirFicha(f[p.pk])">
                    @for (c of p.columnas; track c) {
                      <td [class.num]="esNumero(f[c])">{{ f[c] }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (p.paginas > 1) {
            <div class="paginas">
              <ion-button size="small" fill="clear" [disabled]="p.pagina <= 1"
                          (click)="pagina.set(p.pagina - 1)">Anterior</ion-button>
              <span class="conteo">{{ p.pagina }} / {{ p.paginas }}</span>
              <ion-button size="small" fill="clear" [disabled]="p.pagina >= p.paginas"
                          (click)="pagina.set(p.pagina + 1)">Siguiente</ion-button>
            </div>
          }
        }
      } @else {
        <!-- Sin datos y sin spinner: algo fallo. Nunca dejar la pantalla muda. -->
        <div class="vacio">
          <p>No se pudo cargar <code>{{ codigo() }}</code>.</p>
          @if (error()) { <p class="aviso">{{ error() }}</p> }
        </div>
      }
    </ion-content>
  `,
})
export class MantenedorPage {
  private readonly http = inject(HttpClient);

  readonly codigo = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('codigo') ?? '')),
    { initialValue: '' },
  );

  readonly pag = signal<Pagina | null>(null);
  readonly editando = signal<Record<string, any> | null>(null);
  // Arranca en false: si el efecto de carga no llegara a dispararse, la
  // pantalla dice "no se pudo cargar" en vez de girar para siempre.
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly noEsMantenedor = signal(false);
  readonly error = signal('');
  readonly buscar = signal('');
  readonly pagina = signal(1);

  readonly camposEditables = computed(() => {
    const p = this.pag(); const f = this.editando();
    if (!p || !f) return [];
    return Object.keys(f).filter((c) => c !== p.pk && !p.soloLectura.includes(c));
  });
  readonly derivadas = computed(() => {
    const p = this.pag(); const f = this.editando();
    if (!p || !f) return [];
    return p.soloLectura.filter((c) => c in f);
  });

  /** Ultimo mantenedor cargado; sirve para resetear al cambiar de pantalla. */
  private ultimo = '';

  constructor() {
    // Un solo efecto. Dos efectos, donde el primero escribia senales que el
    // segundo leia, dejaban la carga sin disparar segun el orden de ejecucion.
    effect(() => {
      const c = this.codigo();
      const b = this.buscar();
      const pg = this.pagina();
      if (!c) return;
      if (c !== this.ultimo) {
        this.ultimo = c;
        this.editando.set(null);
        void this.cargar(c, '', 1);
        return;
      }
      void this.cargar(c, b, pg);
    });
  }

  private async cargar(codigo: string, buscar: string, pagina: number): Promise<void> {
    this.cargando.set(true);
    this.noEsMantenedor.set(false);
    try {
      const q = new URLSearchParams({ pagina: String(pagina), limite: '50' });
      if (buscar) q.set('buscar', buscar);
      this.pag.set(
        await firstValueFrom(this.http.get<Pagina>(`${API}/mantenedores/${codigo}?${q}`)),
      );
    } catch (e: any) {
      this.pag.set(null);
      this.noEsMantenedor.set(e?.status === 404);
      if (e?.status !== 404) this.error.set(e?.error?.message ?? 'No se pudo cargar');
    } finally {
      this.cargando.set(false);
    }
  }

  async abrirFicha(id: unknown): Promise<void> {
    this.error.set('');
    try {
      this.editando.set(
        await firstValueFrom(
          this.http.get<Record<string, any>>(`${API}/mantenedores/${this.codigo()}/${id}`),
        ),
      );
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo abrir el registro');
    }
  }

  cerrarFicha(): void { this.editando.set(null); this.error.set(''); }

  async guardar(): Promise<void> {
    const p = this.pag(); const f = this.editando();
    if (!p || !f) return;
    this.guardando.set(true);
    this.error.set('');
    try {
      await firstValueFrom(
        this.http.put(`${API}/mantenedores/${p.codigo}/${f[p.pk]}`, f),
      );
      this.editando.set(null);
      await this.cargar(p.codigo, this.buscar(), this.pagina());
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo guardar');
    } finally {
      this.guardando.set(false);
    }
  }

  esNumero(v: unknown): boolean {
    return typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v)));
  }
}
