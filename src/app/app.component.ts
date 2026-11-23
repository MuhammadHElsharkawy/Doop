import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { destinations } from './app.routes';
import { LocalizationService } from './core/localization/localization.service';
import { PersistenceService } from './core/persistence/persistence.service';
import { PreferencesService } from './core/preferences/preferences.service';
import { FocusTimerService } from './features/focus/application/focus-timer.service';
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
  constructor() {
    inject(FocusTimerService);
  }

  protected readonly text = inject(LocalizationService).text;
  protected readonly preferences = inject(PreferencesService);
  protected readonly persistence = inject(PersistenceService);
  protected readonly destinations = destinations;
  protected readonly compact = signal(false);
  protected readonly storageNotice = computed(() => {
    const text = this.text();
    switch (this.persistence.status()) {
      case 'connection-error':
        return { message: text.workspaceStorageError, retry: true };
      case 'migration-error':
        return { message: text.workspaceMigrationError, retry: true };
      case 'invalid-record':
        return { message: text.workspaceInvalidRecord, retry: true };
      case 'invalid-record-write':
        return { message: text.workspaceInvalidRecordWrite, retry: false };
      case 'read-error':
        return { message: text.workspaceReadError, retry: true };
      case 'write-error':
        return { message: text.workspaceWriteError, retry: false };
      case 'quota-error':
        return { message: text.workspaceQuotaError, retry: false };
      default:
        return null;
    }
  });
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

  protected retryStorage(): void {
    this.main()?.nativeElement.focus();
    this.persistence.retry();
  }
}
