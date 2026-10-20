import { Component, input, model, signal } from '@angular/core';
import { IonInput } from '@ionic/angular/standalone';

@Component({
  selector: 'sa-field',
  imports: [IonInput],
  template: `
    <ion-input class="sa-field" labelPlacement="stacked"
               [label]="label()" [type]="campo()" [name]="name()"
               autocorrect="off" autocapitalize="off" [spellcheck]="false"
               [attr.autocomplete]="autocomplete()" [attr.enterkeyhint]="enterkeyhint()"
               [required]="required()" [value]="value()" (ionInput)="onInput($event)">
      <img class="sa-field__icon" slot="start" [src]="icon()" alt="" />
      @if (type() === 'password') {
        <button type="button" class="sa-field__reveal" slot="end"
                [attr.aria-label]="visible() ? 'Ocultar clave' : 'Mostrar clave'"
                [attr.aria-pressed]="visible()"
                (click)="visible.set(!visible())">
          {{ visible() ? 'Ocultar' : 'Mostrar' }}
        </button>
      }
    </ion-input>
  `,
})
export class SaField {
  readonly label = input.required<string>();
  readonly icon = input.required<string>();
  readonly name = input.required<string>();
  readonly type = input('text');
  readonly autocomplete = input<string | null>(null);
  readonly enterkeyhint = input<string | null>(null);
  readonly required = input(false);
  readonly value = model('');
  readonly visible = signal(false);

  campo(): string {
    return this.type() === 'password' && this.visible() ? 'text' : this.type();
  }

  onInput(event: Event): void {
    const value = (event as CustomEvent<{ value?: string | null }>).detail?.value ?? '';
    this.value.set(value);
  }
}
