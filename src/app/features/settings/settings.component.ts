import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { LocalizationService } from '../../core/localization/localization.service';
import {
  PreferencesService,
  appearances,
  languages,
  themes,
} from '../../core/preferences/preferences.service';
import { DataManagementComponent } from './data-management.component';
import { settingsMessages } from './settings-messages';
import { WorkspaceSettingsComponent } from './workspace-settings.component';

@Component({
  selector: 'app-settings',
  imports: [DataManagementComponent, WorkspaceSettingsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  private readonly locale = inject(LocalizationService);
  protected readonly text = this.locale.text;
  protected readonly details = computed(
    () => settingsMessages[this.locale.language()],
  );
  protected readonly preferences = inject(PreferencesService);
  protected readonly appearances = appearances;
  protected readonly themes = themes;
  protected readonly languages = languages;
}
