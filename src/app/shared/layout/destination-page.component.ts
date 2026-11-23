import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import type { Destination } from '../../app.routes';
import { LocalizationService } from '../../core/localization/localization.service';
import { IconComponent } from '../ui/icon.component';

@Component({
  selector: 'app-destination-page',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="page-title">{{ text()[section()] }}</h1>
    <p class="mt-3 text-lg text-muted">{{ description() }}</p>
    <div class="workspace-note">
      <app-icon [name]="section()" />
      <p>{{ text().unavailable }}</p>
    </div>
  `,
})
export class DestinationPageComponent {
  readonly section = input.required<Destination>();
  protected readonly text = inject(LocalizationService).text;
  protected readonly description = computed(
    () => this.text()[`${this.section()}Description`],
  );
  private readonly title = inject(Title);

  constructor() {
    effect(() => this.title.setTitle(`${this.text()[this.section()]} · Doop`));
  }
}
