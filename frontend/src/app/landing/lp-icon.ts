import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Icônes au trait (24 × 24) de la page d'accueil. */
@Component({
  selector: 'app-lp-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (name()) {
        @case ('arrow') { <path d="M5 12h14M13 6l6 6-6 6" /> }
        @case ('check') { <path d="m5 12.5 4.5 4.5L19 7.5" /> }
        @case ('menu') { <path d="M4 7h16M4 12h16M4 17h16" /> }
        @case ('close') { <path d="M6 6l12 12M18 6 6 18" /> }
        @case ('plus') { <path d="M12 5v14M5 12h14" /> }
        @case ('id') { <rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="9" cy="11" r="2.2" /><path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M15 10h3M15 13.5h3" /> }
        @case ('cpu') { <rect x="6" y="6" width="12" height="12" rx="2.5" /><path d="M9.5 9.5h5v5h-5zM9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5" /> }
        @case ('contract') { <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v4h4M9 12h6M9 16h4" /> }
        @case ('proof') { <path d="m12 2.5 8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3L12 2.5Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /> }
        @case ('radar') { <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="M12 12 18.5 5.5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /> }
        @case ('qr') { <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" /><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" /><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" /><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5" /> }
        @case ('replay') { <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 4v4.5h4.5M12 8v4l3 2" /> }
        @case ('route') { <circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" /> }
        @case ('layers') { <path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /> }
        @case ('ledger') { <rect x="3" y="4" width="7" height="7" rx="2" /><rect x="14" y="4" width="7" height="7" rx="2" /><rect x="8.5" y="14" width="7" height="7" rx="2" /><path d="M10 7.5h4M7 11v1.5a2 2 0 0 0 2 2M17 11v1.5a2 2 0 0 1-2 2" /> }
        @case ('car') { <path d="M5 16.5V12l1.8-4.6A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.4L19 12v4.5" /><path d="M3.5 16.5h17v-3a1.5 1.5 0 0 0-1.5-1.5H5a1.5 1.5 0 0 0-1.5 1.5v3Z" /><circle cx="7.5" cy="16.5" r="1.8" /><circle cx="16.5" cy="16.5" r="1.8" /> }
        @case ('fleet') { <rect x="2.5" y="7" width="12" height="9" rx="2" /><path d="M14.5 10h3.5l3.5 3.5V16h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /> }
        @case ('shield') { <path d="M12 2.8 19.5 6v5.7c0 4.6-3.1 8.1-7.5 9.5-4.4-1.4-7.5-4.9-7.5-9.5V6L12 2.8Z" /><path d="m8.8 12 2.2 2.2 4.2-4.4" /> }
        @case ('clock') { <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /> }
        @case ('home') { <path d="M3.5 11 12 4l8.5 7" /><path d="M5.5 9.5V20h13V9.5M10 20v-5.5h4V20" /> }
        @case ('logout') { <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15" /> }
        @case ('chart') { <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> }
        @case ('users') { <circle cx="9" cy="8" r="3.2" /><path d="M3 19.5c.8-3.2 3.1-5 6-5s5.2 1.8 6 5" /><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.8c1.5.7 2.6 2.3 3 4.7" /> }
        @case ('station') { <rect x="4" y="3" width="10" height="18" rx="2" /><path d="M7 7h4" /><path d="m10 11-2 3h3l-2 3" /><path d="M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-2-2" /> }
        @case ('bolt') { <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z" /> }
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; width: 1em; height: 1em; } svg { width: 100%; height: 100%; }`,
})
export class LpIcon {
  readonly name = input.required<string>();
}
