import { Component, input } from '@angular/core';
import { SaIcon, SaIconName } from './sa-icon.component';

export type SaArea = 'compras' | 'bodega' | 'finanzas' | 'sistema' | 'inicio';

/**
 * Page heading inside the content: area icon tile, title, one-line purpose and
 * the page actions (`<div saActions>`). On phones the title already sits in the
 * top bar, so only the purpose and the actions show, actions full width.
 */
@Component({
  selector: 'sa-page-head',
  imports: [SaIcon],
  host: { class: 'sa-page-head' },
  template: `
    <div class="sa-page-head__id">
      @if (icon()) {
        <span class="sa-page-head__tile" [attr.data-area]="area()"><sa-icon [name]="icon()!" [size]="22" /></span>
      }
      <div class="sa-page-head__text">
        <h1 class="sa-page-head__title">{{ title() }}</h1>
        @if (subtitle()) { <p class="sa-page-head__sub">{{ subtitle() }}</p> }
      </div>
    </div>
    <div class="sa-page-head__actions"><ng-content select="[saActions]" /></div>
  `,
})
export class SaPageHead {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly area = input<SaArea>('inicio');
  readonly icon = input<SaIconName | null>(null);
}
