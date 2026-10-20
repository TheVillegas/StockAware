import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { pestanasRegistro } from './workspace-navigation';

const AYUDA: Record<string, string> = {
  ING_MATERIAL: 'Llega material de una orden de compra recibida.',
  RECIBE_GR: 'Entra material que no viene de una orden.',
  EMITE_GR: 'Material o equipos que van a un centro de costo.',
  ENTREGA_MAT: 'Se entrega a una persona o a otra bodega.',
};

/**
 * Movement type cards shared by the four forms grouped under "Registrar
 * movimiento". Each card is a radio that navigates to its own route, so the
 * routes and the per-profile permissions stay as they were.
 */
@Component({
  selector: 'sa-registro-tabs',
  styles: [`
    :host { display: block; margin-bottom: var(--sa-space-5); }
    .tipos {
      display: grid;
      gap: var(--sa-space-3);
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
    }
    .tipo {
      display: flex; flex-direction: column; align-items: flex-start; gap: var(--sa-space-2);
      min-height: 44px;
      padding: var(--sa-space-4);
      border: var(--sa-border) solid var(--sa-line-strong);
      border-radius: 12px;
      background: var(--sa-surface);
      color: var(--sa-ink);
      font: inherit; font-size: var(--sa-text-body);
      text-align: start;
      cursor: pointer;
      transition: border-color 150ms ease-out, background-color 150ms ease-out;
    }
    .tipo:hover { border-color: var(--sa-area-bodega); }
    .tipo:focus-visible { outline: 2px solid var(--sa-area-bodega); outline-offset: var(--sa-focus-offset); }
    .tipo[aria-checked="true"] {
      border-color: var(--sa-area-bodega);
      box-shadow: inset 0 0 0 1px var(--sa-area-bodega);
      background: var(--sa-area-bodega-tint);
    }
    .tipo strong { font-weight: 600; }
    .tipo small { color: var(--sa-ink-soft); font-size: var(--sa-text-dense); line-height: 1.4; }
  `],
  template: `
    @if (pestanas().length > 1) {
      <div class="tipos" role="radiogroup" aria-label="Tipo de movimiento" (keydown)="teclas($event)">
        @for (p of pestanas(); track p.codigo) {
          <button type="button" class="tipo" role="radio"
                  [attr.aria-checked]="p.codigo === actual()"
                  [attr.tabindex]="p.codigo === actual() ? 0 : -1"
                  (click)="ir(p.codigo)">
            <strong>{{ p.titulo }}</strong>
            <small>{{ ayuda(p.codigo) }}</small>
          </button>
        }
      </div>
    }
  `,
})
export class SaRegistroTabs {
  readonly actual = input.required<string>();
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly pestanas = computed(() => pestanasRegistro(this.auth.menu()));
  readonly ayuda = (codigo: string) => AYUDA[codigo] ?? '';

  ir(codigo: string): void {
    if (codigo && codigo !== this.actual()) void this.router.navigate(['/f', codigo]);
  }

  /** Arrow keys move between radios, as a native radio group does. */
  teclas(ev: KeyboardEvent): void {
    const paso = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1
      : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
    if (!paso) return;
    ev.preventDefault();
    const lista = this.pestanas();
    const i = lista.findIndex((p: { codigo: string }) => p.codigo === this.actual());
    const sig = lista[(i + paso + lista.length) % lista.length];
    if (sig) this.ir(sig.codigo);
  }
}
