/**
 * Searchable bodega picker. The profile can see hundreds of bodegas and an
 * ion-select renders every option before opening, so this input filters the
 * loaded list on the client and renders only a dozen matches.
 *
 * The listbox lives in the top layer (popover="manual"): Ionic pages use
 * `contain: layout` and the query panel clips overflow, so an in-flow or
 * fixed dropdown would be cut off.
 */
import {
  Component, ElementRef, OnDestroy, computed, input, model, signal, viewChild,
} from '@angular/core';

import { SaIcon } from '../shared/sa-icon.component';
import { etiquetaBodega, filtrarBodegas } from './bodega-filter';

export interface BodegaOpcion { bodega: number; descr: string; }

let siguienteId = 0;

@Component({
  selector: 'app-bodega-combobox',
  imports: [SaIcon],
  host: { class: 'bodega-combo' },
  styles: [`
    :host { display: flex; flex-direction: column; gap: var(--sa-space-1); flex: 0 1 20rem; min-inline-size: 14rem; }
    label { font-size: var(--sa-text-meta); font-weight: 600; color: var(--sa-ink-soft); }
    .campo {
      display: flex; align-items: center; gap: var(--sa-space-2);
      min-block-size: 2.75rem; padding: 0 var(--sa-space-3);
      background: var(--sa-surface); color: var(--sa-ink-soft);
      border: var(--sa-border) solid var(--sa-border-input); border-radius: var(--sa-radius);
    }
    .campo:focus-within { outline: var(--sa-focus-ring); outline-offset: var(--sa-focus-offset); }
    input {
      flex: 1; min-inline-size: 0; border: 0; outline: 0; background: transparent;
      font: inherit; font-size: var(--sa-text-body); color: var(--sa-ink);
    }
    input::placeholder { color: var(--sa-ink-soft); }
    .lista {
      margin: 0; padding: var(--sa-space-1); list-style: none; inset: auto;
      position: fixed; max-block-size: 22rem; overflow-y: auto;
      background: var(--sa-surface); color: var(--sa-ink);
      border: var(--sa-border) solid var(--sa-line-strong); border-radius: var(--sa-radius);
      box-shadow: 0 8px 24px color-mix(in srgb, var(--sa-ink) 16%, transparent);
    }
    .lista li {
      display: flex; align-items: center; justify-content: space-between; gap: var(--sa-space-2);
      min-block-size: 2.75rem; padding: 0 var(--sa-space-3);
      border-radius: var(--sa-radius); cursor: pointer; font-size: var(--sa-text-dense);
    }
    .lista li.activa { background: var(--sa-area-bodega-tint); }
    .lista li[aria-selected="true"] { font-weight: 600; color: var(--sa-area-bodega); }
    .lista .nota { cursor: default; color: var(--sa-ink-soft); font-size: var(--sa-text-meta); min-block-size: 2.25rem; }
    .lista .code { color: var(--sa-ink-soft); }
    .lista:not(.abierta) { display: none; }
  `],
  template: `
    <label [attr.for]="idInput">{{ label() }}</label>
    <div class="campo">
      <sa-icon name="warehouse" />
      <input #entrada [id]="idInput" type="text" role="combobox" autocomplete="off" spellcheck="false"
             aria-autocomplete="list" [attr.aria-expanded]="abierto()" [attr.aria-controls]="idLista"
             [attr.aria-activedescendant]="abierto() && activa() >= 0 ? idOpcion(activa()) : null"
             [value]="abierto() ? texto() : seleccionada()"
             [placeholder]="abierto() ? seleccionada() : 'Escribe para buscar'"
             (focus)="abrir()" (blur)="cerrar()" (click)="abrir()"
             (input)="escribir($any($event.target).value)" (keydown)="tecla($event)" />
    </div>
    <ul #lista class="lista" [class.abierta]="abierto()" popover="manual" role="listbox" [id]="idLista" [attr.aria-label]="label()">
      @for (o of opciones(); track o.bodega; let i = $index) {
        <li role="option" [id]="idOpcion(i)" [class.activa]="i === activa()"
            [attr.aria-selected]="o.bodega === value()"
            (mousedown)="$event.preventDefault()" (click)="elegir(o.bodega)" (mouseenter)="activa.set(i)">
          <span>{{ o.descr }}</span>
          @if (o.bodega) { <span class="code">{{ o.bodega }}</span> }
        </li>
      }
      @if (resultado().total > resultado().coincidencias.length) {
        <li class="nota" aria-hidden="true">
          {{ resultado().coincidencias.length }} de {{ resultado().total }} bodegas. Sigue escribiendo para acotar.
        </li>
      } @else if (resultado().total === 0) {
        <li class="nota" aria-hidden="true">Ninguna bodega coincide con "{{ texto() }}"</li>
      }
    </ul>
  `,
})
export class BodegaCombobox implements OnDestroy {
  readonly bodegas = input<BodegaOpcion[]>([]);
  readonly label = input('Bodega');
  /** Selected bodega id; 0 means every bodega. */
  readonly value = model(0);

  readonly abierto = signal(false);
  readonly texto = signal('');
  readonly activa = signal(0);

  private readonly entrada = viewChild.required<ElementRef<HTMLInputElement>>('entrada');
  private readonly lista = viewChild.required<ElementRef<HTMLElement>>('lista');
  private readonly n = siguienteId++;
  readonly idInput = `bodega-combo-${this.n}`;
  readonly idLista = `bodega-combo-${this.n}-lista`;
  idOpcion = (i: number) => `bodega-combo-${this.n}-op-${i}`;

  readonly seleccionada = computed(() => etiquetaBodega(this.bodegas(), this.value()));
  readonly resultado = computed(() => filtrarBodegas(this.bodegas(), this.texto()));
  /** "Todas las bodegas" first while the text is empty, then the matches. */
  readonly opciones = computed<BodegaOpcion[]>(() => {
    const m = this.resultado().coincidencias;
    return this.texto().trim() ? m : [{ bodega: 0, descr: 'Todas las bodegas' }, ...m];
  });

  private readonly alDesplazar = (e: Event) => {
    if (!this.lista().nativeElement.contains(e.target as Node)) this.cerrar();
  };
  private readonly alRedimensionar = () => this.cerrar();

  abrir(): void {
    if (this.abierto()) return;
    this.texto.set('');
    const i = this.opciones().findIndex((o) => o.bodega === this.value());
    this.activa.set(Math.max(i, 0));
    this.abierto.set(true);
    this.mostrarLista();
  }

  cerrar(): void {
    if (!this.abierto()) return;
    this.abierto.set(false);
    this.texto.set('');
    const lista = this.lista().nativeElement;
    if (typeof lista.hidePopover === 'function' && lista.matches(':popover-open')) lista.hidePopover();
    document.removeEventListener('wheel', this.alDesplazar, true);
    document.removeEventListener('touchmove', this.alDesplazar, true);
    window.removeEventListener('resize', this.alRedimensionar);
  }

  escribir(valor: string): void {
    if (!this.abierto()) this.abrir();
    this.texto.set(valor);
    this.activa.set(0);
  }

  elegir(id: number): void {
    this.value.set(id);
    this.cerrar();
  }

  tecla(e: KeyboardEvent): void {
    const total = this.opciones().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!this.abierto()) { this.abrir(); return; }
      if (!total) return;
      const paso = e.key === 'ArrowDown' ? 1 : -1;
      this.activa.set((this.activa() + paso + total) % total);
      this.verActiva();
    } else if (e.key === 'Enter') {
      if (!this.abierto()) return;
      e.preventDefault();
      const o = this.opciones()[this.activa()];
      if (o) this.elegir(o.bodega);
    } else if (e.key === 'Escape') {
      if (!this.abierto()) return;
      e.preventDefault();
      this.cerrar();
    } else if (e.key === 'Tab') {
      this.cerrar();
    }
  }

  ngOnDestroy(): void {
    this.cerrar();
  }

  /** Places the top-layer list under the input; the top layer is relative to the viewport. */
  private mostrarLista(): void {
    const lista = this.lista().nativeElement;
    const caja = this.entrada().nativeElement.parentElement!.getBoundingClientRect();
    const abajo = window.innerHeight - caja.bottom;
    lista.style.left = `${caja.left}px`;
    lista.style.width = `${Math.max(caja.width, 256)}px`;
    if (abajo < 240 && caja.top > abajo) {
      lista.style.top = 'auto';
      lista.style.bottom = `${window.innerHeight - caja.top + 4}px`;
    } else {
      lista.style.bottom = 'auto';
      lista.style.top = `${caja.bottom + 4}px`;
    }
    if (typeof lista.showPopover === 'function' && !lista.matches(':popover-open')) lista.showPopover();
    document.addEventListener('wheel', this.alDesplazar, { capture: true, passive: true });
    document.addEventListener('touchmove', this.alDesplazar, { capture: true, passive: true });
    window.addEventListener('resize', this.alRedimensionar);
  }

  private verActiva(): void {
    queueMicrotask(() => document.getElementById(this.idOpcion(this.activa()))?.scrollIntoView({ block: 'nearest' }));
  }
}
