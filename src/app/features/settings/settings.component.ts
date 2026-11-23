import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LocalizationService } from '../../core/localization/localization.service';
import {
  PreferencesService,
  appearances,
  languages,
  themes,
} from '../../core/preferences/preferences.service';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  protected readonly text = inject(LocalizationService).text;
  protected readonly preferences = inject(PreferencesService);
  protected readonly appearances = appearances;
  protected readonly themes = themes;
  protected readonly languages = languages;
}
