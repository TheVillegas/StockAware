import { Component, input } from '@angular/core';

/**
 * Stroke icons for the workspaces (Lucide-style geometry, drawn locally so no
 * dependency is added). Color follows `currentColor`; decorative by default.
 */
export type SaIconName =
  | 'home' | 'orders' | 'warehouse' | 'move' | 'split' | 'chart' | 'settings'
  | 'plus' | 'logout' | 'search' | 'in' | 'out' | 'check' | 'x' | 'alert'
  | 'chevron-right' | 'download' | 'menu' | 'arrow-left' | 'clock';

@Component({
  selector: 'sa-icon',
  host: { style: 'display: inline-flex; flex: none; line-height: 0' },
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" [attr.stroke-width]="stroke()" stroke-linecap="round" stroke-linejoin="round"
         [attr.aria-hidden]="label() ? null : 'true'" [attr.role]="label() ? 'img' : null"
         [attr.aria-label]="label() || null">
      @switch (name()) {
        @case ('home') { <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> }
        @case ('orders') { <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v3h6V3" /><path d="M9 11h6" /><path d="M9 15h4" /> }
        @case ('warehouse') { <path d="M3 21V9l9-5 9 5v12" /><path d="M7 21v-8h10v8" /><path d="M7 17h10" /> }
        @case ('move') { <path d="M7 4v14" /><path d="m3 14 4 4 4-4" /><path d="M17 20V6" /><path d="m13 10 4-4 4 4" /> }
        @case ('split') { <path d="M12 3v6" /><path d="M12 9 5 16v5" /><path d="m12 9 7 7v5" /> }
        @case ('chart') { <path d="M4 20h16" /><path d="M7 16v-5" /><path d="M12 16V6" /><path d="M17 16v-8" /> }
        @case ('settings') { <path d="M4 6h10" /><path d="M18 6h2" /><circle cx="16" cy="6" r="2" /><path d="M4 12h4" /><path d="M12 12h8" /><circle cx="10" cy="12" r="2" /><path d="M4 18h12" /><circle cx="18" cy="18" r="2" /> }
        @case ('plus') { <path d="M12 5v14" /><path d="M5 12h14" /> }
        @case ('logout') { <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="m10 17 5-5-5-5" /><path d="M15 12H3" /> }
        @case ('search') { <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /> }
        @case ('in') { <path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" /> }
        @case ('out') { <path d="M12 20V8" /><path d="m7 13 5-5 5 5" /><path d="M4 4h16" /> }
        @case ('check') { <path d="m5 12 5 5 9-10" /> }
        @case ('x') { <path d="M6 6l12 12" /><path d="M18 6 6 18" /> }
        @case ('alert') { <circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 16.5v.5" /> }
        @case ('chevron-right') { <path d="m9 6 6 6-6 6" /> }
        @case ('download') { <path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" /> }
        @case ('menu') { <path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /> }
        @case ('arrow-left') { <path d="M19 12H5" /><path d="m11 18-6-6 6-6" /> }
        @case ('clock') { <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /> }
      }
    </svg>
  `,
})
export class SaIcon {
  readonly name = input.required<SaIconName>();
  readonly size = input(18);
  readonly stroke = input(1.8);
  /** Accessible name when the icon carries meaning on its own; decorative otherwise. */
  readonly label = input('');
}
