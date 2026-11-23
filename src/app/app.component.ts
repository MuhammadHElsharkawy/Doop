import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { destinations } from './app.routes';
import { LocalizationService } from './core/localization/localization.service';
import { PreferencesService } from './core/preferences/preferences.service';
import { SettingsComponent } from './features/settings/settings.component';
import { DialogComponent } from './shared/ui/dialog.component';
import { IconComponent } from './shared/ui/icon.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    DialogComponent,
    IconComponent,
    SettingsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  protected readonly text = inject(LocalizationService).text;
  protected readonly preferences = inject(PreferencesService);
  protected readonly destinations = destinations;
  protected readonly compact = signal(false);
  private readonly main = viewChild<ElementRef<HTMLElement>>('main');
  private activated = false;

  protected toggleSidebar(): void {
    this.compact.update((value) => !value);
  }

  protected skipToMain(event: MouseEvent): void {
    event.preventDefault();
    this.main()?.nativeElement.focus();
  }

  protected routeActivated(): void {
    if (this.activated)
      this.main()?.nativeElement.focus({ preventScroll: true });
    this.activated = true;
  }
}
