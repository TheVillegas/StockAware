import { Component, input } from '@angular/core';

@Component({
  selector: 'sa-table-wrap',
  host: {
    class: 'sa-table-wrap',
    role: 'region',
    tabindex: '0',
    '[attr.aria-label]': 'label()',
  },
  template: `<ng-content />`,
})
export class SaTableWrap {
  readonly label = input.required<string>();
}
