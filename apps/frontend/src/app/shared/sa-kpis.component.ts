import { Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertOutline, cartOutline, cashOutline, checkmarkCircleOutline,
  documentTextOutline, pricetagOutline, walletOutline,
} from 'ionicons/icons';

addIcons({
  alertOutline, cartOutline, cashOutline, checkmarkCircleOutline,
  documentTextOutline, pricetagOutline, walletOutline,
});

export interface SaKpiItem {
  label: string;
  value: string;
  hint?: string;
  icon?: string;
  ok?: boolean;
  bar?: number;
}

@Component({
  selector: 'sa-kpis',
  imports: [IonIcon],
  styles: [`
    .value.is-ok { color: var(--sa-ok-fg); }
    .avance { display: block; margin-top: var(--sa-space-2); }
    .avance__pista {
      display: block; inline-size: 100%; block-size: 0.375rem;
      border-radius: var(--sa-radius-pill); background: var(--sa-line); overflow: hidden;
    }
    .avance__pista > i {
      display: block; block-size: 100%; border-radius: inherit; background: var(--sa-accent);
    }
    .avance__pista > i.is-full { background: var(--sa-ok-fg); }
  `],
  template: `
    <div class="sa-kpis sa-kpis--cards" [class.sa-kpis--3]="columns() === 3">
      @for (item of items(); track item.label) {
        <div class="sa-kpi">
          <div class="label">
            @if (item.icon) { <ion-icon [name]="item.icon" aria-hidden="true"></ion-icon> }
            {{ item.label }}
          </div>
          <div class="value" [class.is-ok]="item.ok">{{ item.value }}</div>
          @if (item.bar != null) {
            <span class="avance">
              <span class="avance__pista">
                <i [style.width.%]="item.bar" [class.is-full]="item.bar >= 100"></i>
              </span>
            </span>
          }
          @if (item.hint) { <div class="delta">{{ item.hint }}</div> }
        </div>
      }
    </div>
  `,
})
export class SaKpis {
  readonly items = input.required<SaKpiItem[]>();
  readonly columns = input(4);
}
