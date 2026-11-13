import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextId = 0;

/** Logo AI-ZTB : un éclair (énergie) dans un bouclier (sécurité). */
@Component({
  selector: 'app-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient [attr.id]="gradientId" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop stop-color="#2563EB" />
          <stop offset="0.55" stop-color="#06B6D4" />
          <stop offset="1" stop-color="#10B981" />
        </linearGradient>
      </defs>
      <path d="M20 2.5 34.5 8v11.2c0 9.1-6 15.9-14.5 18.3C11.5 35.1 5.5 28.3 5.5 19.2V8L20 2.5Z" [attr.fill]="'url(#' + gradientId + ')'" />
      <path d="M20 2.5 34.5 8v11.2c0 9.1-6 15.9-14.5 18.3" stroke="#fff" stroke-opacity=".25" />
      <path d="M22.4 9.5 13.6 21.6h5.6l-1.8 9 8.9-12.3h-5.7l1.8-8.8Z" fill="#fff" />
    </svg>
  `,
  styles: `:host { display: inline-flex; flex-shrink: 0; }`,
})
export class BrandMark {
  readonly size = input(32);
  /** Identifiant unique : un dégradé défini dans une copie masquée du logo (display: none) ne s'affiche pas ailleurs. */
  protected readonly gradientId = `bm-g-${nextId++}`;
}
