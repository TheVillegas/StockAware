/**
 * Panel "Precios de mercado": lo que cuestan en tiendas externas los productos
 * parecidos a un material. Vive dentro de Stock. Ver es MATERIAL_X_BODEGA;
 * confirmar, rechazar, asociar una URL y marcar cotizable exigen MOD_MATERIALES.
 */
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { IonButton, IonInput, IonToggle } from '@ionic/angular/standalone';

import { API, AuthService } from '../core/auth.service';
import { clp, fechaTabla } from '../shared/format';
import {
  FUENTES, FUENTES_CON_URL, crearPreciosApi, mensajeError, textoFuente, textoIva,
} from './precios-api';

export interface Publicacion {
  publicacion_id: number; vinculo_id: number; nombre: string; marca: string | null;
  ean: string | null; url: string; precio_normal: number; precio_oferta: number | null;
  disponible: boolean; iva_incluido: boolean | null; parcial: boolean; puntaje: number;
  vinculo: 'propuesto' | 'confirmado'; obtenido_en: string; verificado_en: string;
}
export interface FuentePrecios {
  fuente: keyof typeof FUENTES; estado: 'ok' | 'sin_resultados' | 'desactualizada' | 'sin_datos';
  motivo?: string; parcial?: boolean; desactualizado?: boolean; obtenido_en?: string;
  publicaciones: Publicacion[];
}
export interface RespuestaPrecios {
  cod_material: string; nombre: string; cotizable: boolean; motivo?: string;
  desactualizado?: boolean; fuentes: FuentePrecios[];
}

@Component({
  selector: 'app-precios-panel',
  imports: [FormsModule, IonButton, IonInput, IonToggle],
  styles: [`
    .precios { padding: var(--sa-space-5); }
    .precios__cab { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sa-space-3); flex-wrap: wrap; }
    .precios h2, .precios h3 { margin: 0; font-size: var(--sa-text-title); }
    .precios h3 { font-size: var(--sa-text-body); }
    .precios__sub { margin: var(--sa-space-1) 0 var(--sa-space-4); color: var(--sa-ink-soft); }
    .fuente { margin-top: var(--sa-space-5); }
    .fuente__cab { display: flex; align-items: center; gap: var(--sa-space-2); flex-wrap: wrap; }
    .fuente__texto { margin: var(--sa-space-2) 0 0; color: var(--sa-ink-soft); }
    .pubs { list-style: none; margin: var(--sa-space-3) 0 0; padding: 0; display: grid; gap: var(--sa-space-3); }
    .pub { border: var(--sa-border) solid var(--sa-border-input); border-radius: var(--sa-radius); padding: var(--sa-space-3); }
    .pub__precio { font-size: var(--sa-text-title); font-weight: 700; font-variant-numeric: tabular-nums; }
    .pub__normal { text-decoration: line-through; color: var(--sa-ink-soft); margin-inline-start: var(--sa-space-2); }
    .pub__datos { display: flex; gap: var(--sa-space-2); flex-wrap: wrap; align-items: center; color: var(--sa-ink-soft); }
    .pub__acciones, .fuente__url { display: flex; gap: var(--sa-space-2); flex-wrap: wrap; align-items: center; margin-top: var(--sa-space-3); }
    .fuente__url ion-input { flex: 1 1 18rem; }
    .cotizable { display: flex; align-items: center; gap: var(--sa-space-3); flex-wrap: wrap; margin-top: var(--sa-space-4); }
  `],
  template: `
    <section class="sa-panel precios" aria-labelledby="precios-titulo" [attr.aria-busy]="cargando()">
      <div class="precios__cab">
        <div>
          <h2 id="precios-titulo">Precios de mercado</h2>
          <p class="precios__sub"><span class="code">{{ codMaterial() }}</span> {{ nombre() }}</p>
        </div>
        <ion-button fill="outline" (click)="cerrar.emit()">Volver al stock</ion-button>
      </div>

      @if (error()) { <div class="sa-notice sa-notice--crit" role="alert">{{ error() }}</div> }
      @if (aviso()) { <div class="sa-notice sa-notice--ok" role="status">{{ aviso() }}</div> }

      @if (cargando()) {
        <p role="status">Consultando las fuentes de precios. La primera consulta puede tardar hasta 20 segundos.</p>
      } @else if (datos(); as d) {
        @if (d.desactualizado) {
          <div class="sa-notice sa-notice--warn">Algunos precios no se pudieron actualizar y pueden estar desactualizados.</div>
        }
        <div class="cotizable">
          <ion-toggle [checked]="d.cotizable" [disabled]="!puedeEscribir() || trabajando()"
                      (ionChange)="cambiarCotizable($any($event))">Se cotiza en el mercado</ion-toggle>
          @if (puedeEscribir() && d.cotizable) {
            <ion-input label="Motivo si se desactiva" labelPlacement="stacked" fill="outline"
                       maxlength="100" [(ngModel)]="motivo"></ion-input>
          }
        </div>
        @if (!d.cotizable) {
          <p class="fuente__texto">No se consultan precios para este material{{ d.motivo ? ': ' + d.motivo : '' }}.</p>
        }

        @for (f of d.fuentes; track f.fuente) {
          <div class="fuente">
            <div class="fuente__cab">
              <h3>{{ nombreFuente(f.fuente) }}</h3>
              @if (f.estado === 'desactualizada' || f.desactualizado) {
                <span class="sa-pill sa-pill--warn">DESACTUALIZADO</span>
              }
            </div>
            @if (textoDe(f); as t) { <p class="fuente__texto">{{ t }}</p> }
            @if (f.publicaciones.length) {
              <ul class="pubs">
                @for (p of f.publicaciones; track p.publicacion_id) {
                  <li class="pub">
                    <a [href]="p.url" target="_blank" rel="noopener noreferrer">{{ p.nombre }}</a>
                    @if (p.marca) { <span class="sa-sub"> · {{ p.marca }}</span> }
                    <div>
                      <span class="pub__precio">{{ moneda(p.precio_oferta ?? p.precio_normal) }}</span>
                      @if (p.precio_oferta !== null) { <span class="pub__normal">{{ moneda(p.precio_normal) }}</span> }
                    </div>
                    <div class="pub__datos">
                      <span>{{ iva(p.iva_incluido) }}</span>
                      <span>{{ p.disponible ? 'Disponible' : 'No disponible' }}</span>
                      <span>Obtenido el {{ fecha(p.obtenido_en) }}</span>
                      @if (p.parcial) { <span class="sa-pill sa-pill--warn">PARCIAL</span> }
                      @if (p.vinculo === 'propuesto') {
                        <span class="sa-pill sa-pill--info">SIN CONFIRMAR</span>
                      } @else {
                        <span class="sa-pill sa-pill--ok">CONFIRMADO</span>
                      }
                    </div>
                    @if (puedeEscribir()) {
                      <div class="pub__acciones">
                        @if (p.vinculo === 'propuesto') {
                          <ion-button size="small" color="bodega" [disabled]="trabajando()"
                                      (click)="resolver(f, p, 'confirmado')">Confirmar</ion-button>
                        }
                        <ion-button size="small" fill="outline" [disabled]="trabajando()"
                                    (click)="resolver(f, p, 'rechazado')">Rechazar</ion-button>
                      </div>
                    }
                  </li>
                }
              </ul>
            }
            @if (necesitaUrl(f.fuente)) {
              @if (puedeEscribir()) {
                <div class="fuente__url">
                  <ion-input [label]="'Dirección del listado en ' + nombreFuente(f.fuente)" labelPlacement="stacked"
                             fill="outline" type="url" placeholder="https://"
                             [(ngModel)]="urls[f.fuente]"></ion-input>
                  <ion-button size="small" color="bodega" [disabled]="trabajando() || !urls[f.fuente]?.trim()"
                              (click)="asociarUrl(f.fuente)">Guardar dirección</ion-button>
                </div>
              } @else if (f.estado === 'sin_datos') {
                <p class="fuente__texto">Pide a quien administra los materiales que asocie la dirección del listado.</p>
              }
            }
          </div>
        }
      }
    </section>
  `,
})
export class PreciosPanel {
  private readonly auth = inject(AuthService);
  private readonly api = crearPreciosApi(inject(HttpClient), API);

  readonly codMaterial = input.required<string>();
  readonly nombre = input('');
  readonly cerrar = output<void>();

  readonly datos = signal<RespuestaPrecios | null>(null);
  readonly cargando = signal(false);
  readonly trabajando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly puedeEscribir = computed(() => (this.auth.sesion()?.permisos ?? []).includes('MOD_MATERIALES'));
  urls: Record<string, string> = {};
  motivo = '';
  /** Drops the answer of a lookup that was superseded by a newer one. */
  private consulta = 0;

  readonly moneda = clp;
  readonly fecha = fechaTabla;
  readonly iva = textoIva;
  nombreFuente = (f: string) => FUENTES[f as keyof typeof FUENTES] ?? f;
  necesitaUrl = (f: string) => FUENTES_CON_URL.includes(f);
  textoDe = (f: FuentePrecios) => textoFuente(f, fechaTabla);

  constructor() {
    effect(() => { void this.cargar(this.codMaterial()); });
  }

  private async cargar(cod: string): Promise<void> {
    const mia = ++this.consulta;
    this.cargando.set(true);
    this.error.set('');
    this.datos.set(null);
    try {
      const r = await this.api.consultar(cod);
      if (mia === this.consulta) this.datos.set(r);
    } catch (e: any) {
      if (mia === this.consulta) this.error.set(mensajeError(e, 'No se pudieron consultar los precios.'));
    } finally {
      if (mia === this.consulta) this.cargando.set(false);
    }
  }

  /** Runs a write; reports its outcome without inventing data when it fails. */
  private async escribir(accion: () => Promise<unknown>, ok: string, fallo: string): Promise<boolean> {
    this.trabajando.set(true);
    this.error.set(''); this.aviso.set('');
    try {
      await accion();
      this.aviso.set(ok);
      return true;
    } catch (e: any) {
      this.error.set(mensajeError(e, fallo));
      return false;
    } finally {
      this.trabajando.set(false);
    }
  }

  async resolver(f: FuentePrecios, p: Publicacion, estado: 'confirmado' | 'rechazado'): Promise<void> {
    const hecho = await this.escribir(
      () => this.api.cambiarVinculo(p.vinculo_id, estado),
      estado === 'confirmado' ? 'Candidato confirmado.' : 'Candidato rechazado: no se volverá a proponer.',
      'No se pudo guardar el cambio.',
    );
    if (!hecho) return;
    // A rejected link no longer comes back from the API, so it leaves the list.
    this.datos.update((d) => d && {
      ...d,
      fuentes: d.fuentes.map((x) => x.fuente !== f.fuente ? x : {
        ...x,
        publicaciones: estado === 'rechazado'
          ? x.publicaciones.filter((y) => y.vinculo_id !== p.vinculo_id)
          : x.publicaciones.map((y) => y.vinculo_id === p.vinculo_id ? { ...y, vinculo: estado } : y),
      }),
    });
  }

  async asociarUrl(fuente: string): Promise<void> {
    const hecho = await this.escribir(
      () => this.api.asociarUrl(this.codMaterial(), fuente, this.urls[fuente].trim()),
      `Dirección de ${this.nombreFuente(fuente)} guardada.`, 'No se pudo guardar la dirección.',
    );
    if (!hecho) return;
    this.urls[fuente] = '';
    const aviso = this.aviso();
    await this.cargar(this.codMaterial());   // the backend re-reads that source on the next lookup
    this.aviso.set(aviso);
  }

  async cambiarCotizable(ev: { detail: { checked: boolean }; target: { checked: boolean } }): Promise<void> {
    const valor = ev.detail.checked;
    if (valor === this.datos()?.cotizable) return;   // the toggle also fires when the data refreshes
    const hecho = await this.escribir(
      () => this.api.marcarCotizable(this.codMaterial(), valor, valor ? '' : this.motivo.trim()),
      valor ? 'Material marcado como cotizable.' : 'Material marcado como no cotizable.',
      'No se pudo cambiar la marca.',
    );
    if (!hecho) { ev.target.checked = !valor; return; }   // put the toggle back
    const aviso = this.aviso();
    this.motivo = '';
    await this.cargar(this.codMaterial());
    this.aviso.set(aviso);
  }
}
