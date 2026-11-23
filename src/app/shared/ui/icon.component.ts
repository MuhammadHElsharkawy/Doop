import { ChangeDetectionStrategy, Component, input } from '@angular/core';

const paths = {
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  tasks: 'M9 5h11 M9 12h11 M9 19h11 M3 5l1 1 2-2 M3 12l1 1 2-2 M3 19l1 1 2-2',
  habits: 'M5 12a7 7 0 1 1 2 5 M5 12V7 M5 12h5 M10 12l2 2 4-4',
  focus:
    'M4 8V4h4 M16 4h4v4 M20 16v4h-4 M8 20H4v-4 M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  progress: 'M4 4v16h16 M8 15l4-5 4 2 4-6',
  settings: 'M4 6h16 M4 12h16 M4 18h16 M8 4v4 M16 10v4 M10 16v4',
  sidebar: 'M3 5h18v14H3z M9 5v14',
  close: 'm6 6 12 12 M18 6 6 18',
};

export type IconName = keyof typeof paths;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    focusable="false"
  >
    <path [attr.d]="paths[name()]" />
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      inline-size: 1.25em;
      block-size: 1.25em;
      flex: none;
    }
    svg {
      inline-size: 100%;
      block-size: 100%;
    }
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  protected readonly paths = paths;
}
