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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import {
  IonButton, IonContent, IonInput,
  IonNote, IonSearchbar, IonSkeletonText,
} from '@ionic/angular/standalone';

import { API } from '../core/auth.service';
import { fechaTabla, rangoLista } from '../shared/format';
import { columnLabel } from '../shared/consulta';
import { PageHeaderComponent } from '../shared/page-header.component';
import { SaIcon } from '../shared/sa-icon.component';
import { SaPageHead } from '../shared/sa-page-head.component';
import { SaList } from '../shared/sa-list.component';
import { SaTableWrap } from '../shared/sa-table-wrap.component';

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
    FormsModule, PageHeaderComponent, RouterLink, SaIcon, SaList, SaPageHead, SaTableWrap,
    IonContent, IonSearchbar, IonSkeletonText, IonNote, IonButton, IonInput,
  ],
  styles: [`
    .ficha { padding: var(--sa-space-5); max-inline-size: 56rem; }
    .ficha h2 { margin: var(--sa-space-6) 0 var(--sa-space-3); font-size: var(--sa-text-body); font-weight: 600; }
    .campos { display: grid; gap: var(--sa-space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); }
    .derivados { display: grid; gap: var(--sa-space-3) var(--sa-space-5); margin: 0;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); }
    .derivados dt { color: var(--sa-ink-soft); font-size: var(--sa-text-meta); }
    .derivados dd { margin: var(--sa-space-1) 0 0; }
    .acciones { display: flex; gap: var(--sa-space-2); margin-top: var(--sa-space-5); }
    .pendiente { padding: var(--sa-space-5); }
  `],
  template: `
    <app-page-header [title]="pag()?.titulo ?? codigo()"></app-page-header>

    <ion-content>
      <div class="page-content page-content--wide">
      <sa-page-head [title]="pag()?.titulo ?? codigo()" area="sistema" icon="settings" [subtitle]="subtitulo()">
        <div saActions>
          @if (editando()) {
            <ion-button fill="outline" (click)="cerrarFicha()">
              <sa-icon slot="start" name="arrow-left" />Volver a la lista
            </ion-button>
          } @else if (!noEsMantenedor()) {
            <ion-button fill="outline" routerLink="/configuracion">
              <sa-icon slot="start" name="arrow-left" />Configuración
            </ion-button>
          }
        </div>
      </sa-page-head>
      @if (cargando()) {
        <div class="sa-skeleton">
          <ion-skeleton-text [animated]="true"></ion-skeleton-text>
          <ion-skeleton-text [animated]="true"></ion-skeleton-text>
          <ion-skeleton-text [animated]="true"></ion-skeleton-text>
          <ion-skeleton-text [animated]="true"></ion-skeleton-text>
          <ion-skeleton-text [animated]="true"></ion-skeleton-text>
        </div>
      } @else if (noEsMantenedor()) {
        <div class="sa-panel pendiente">
          <ion-note>Pendiente de construir</ion-note>
          <p>La opción <code>{{ codigo() }}</code> todavía no tiene pantalla.</p>
        </div>
      } @else if (editando(); as fila) {
        <form class="sa-panel ficha" (ngSubmit)="guardar()">
          @if (!pag()!.puedeEditar) {
            <div class="sa-notice sa-notice--warn">Tu perfil puede ver este registro, pero no modificarlo.</div>
          }
          <div class="campos">
            @for (c of camposEditables(); track c) {
              <ion-input [label]="etiqueta(c)" labelPlacement="stacked" fill="outline"
                         [name]="c" [value]="mostrar(fila[c])" [disabled]="!pag()!.puedeEditar"
                         (ionInput)="fila[c] = $any($event).detail.value"></ion-input>
            }
          </div>
          @if (derivadas().length) {
            <h2>Datos calculados</h2>
            <dl class="derivados">
              @for (c of derivadas(); track c) {
                <div><dt>{{ etiqueta(c) }}</dt><dd>{{ mostrar(fila[c]) || '—' }}</dd></div>
              }
            </dl>
          }
          @if (error()) { <div class="sa-notice sa-notice--crit">{{ error() }}</div> }
          <div class="acciones">
            <ion-button type="submit" [disabled]="!pag()!.puedeEditar || guardando()">
              {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
            </ion-button>
            <ion-button fill="outline" (click)="cerrarFicha()">Cancelar</ion-button>
          </div>
        </form>
      } @else if (pag(); as p) {
        @if (error()) { <div class="sa-notice sa-notice--crit">{{ error() }}</div> }
        <sa-list [empty]="p.datos.length === 0" emptyTitle="Sin resultados"
                 [range]="rango(p)" [page]="p.pagina" [pages]="p.paginas" (pageChange)="pagina.set($event)">
          <div saFilters>
            <ion-searchbar [placeholder]="'Buscar en ' + p.titulo.toLowerCase()" [debounce]="350"
                           (ionInput)="buscar.set($any($event).detail.value ?? '')"></ion-searchbar>
          </div>
          <sa-table-wrap [label]="p.titulo">
              <table class="sa-table">
                <thead><tr>@for (c of p.columnas; track c) { <th [class.num]="esNumero(p.datos[0]?.[c])">{{ etiqueta(c) }}</th> }</tr></thead>
                <tbody>
                  @for (f of p.datos; track $index) {
                    <tr class="is-click" tabindex="0" (click)="abrirFicha(f[p.pk])" (keydown.enter)="abrirFicha(f[p.pk])">
                      @for (c of p.columnas; track c; let first = $first) {
                        @if (first) {
                          <th scope="row" [class.num]="esNumero(f[c])">{{ f[c] }}</th>
                        } @else {
                          <td [attr.data-label]="etiqueta(c)" [class.num]="esNumero(f[c])">{{ f[c] }}</td>
                        }
                      }
                    </tr>
                  }
                </tbody>
              </table>
          </sa-table-wrap>
        </sa-list>
      } @else {
        <!-- Sin datos y sin spinner: algo fallo. Nunca dejar la pantalla muda. -->
        <div class="sa-empty">
          <div class="title">No se pudo cargar {{ codigo() }}</div>
          @if (error()) { <div class="text">{{ error() }}</div> }
        </div>
      }
      </div>
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

  rango(p: Pagina): string {
    return rangoLista(p.pagina, p.datos.length, p.total, 'registros');
  }

  readonly etiqueta = columnLabel;

  /** One line under the title: size of the table and what the profile can do with it. */
  readonly subtitulo = computed(() => {
    const p = this.pag();
    if (this.editando()) return p?.puedeEditar ? 'Edita los campos y guarda los cambios.' : 'Tu perfil puede ver este registro, pero no modificarlo.';
    if (!p) return '';
    const total = `${p.total.toLocaleString('es-CL')} registros.`;
    return p.puedeEditar ? `${total} Busca por cualquier dato y toca una fila para editarla.` : `${total} Tu perfil puede consultarla, pero no modificarla.`;
  });

  /** Shows ISO timestamps as dd-mm-aaaa; untouched fields are saved exactly as loaded. */
  mostrar(v: unknown): string {
    const texto = v == null ? '' : String(v);
    return /^\d{4}-\d{2}-\d{2}T/.test(texto) ? fechaTabla(texto) : texto;
  }

  esNumero(v: unknown): boolean {
    return typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v)));
  }
}
