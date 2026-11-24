import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { toIsoInstant } from '../../core/clock/local-date';
import { LocalizationService } from '../../core/localization/localization.service';
import {
  decodeBackup,
  maxBackupBytes,
  type BackupV2,
} from '../../core/persistence/backup';
import { PersistenceService } from '../../core/persistence/persistence.service';
import { DialogComponent } from '../../shared/ui/dialog.component';
import { settingsMessages } from './settings-messages';

type Operation =
  { kind: 'import'; backup: BackupV2; fileName: string } | { kind: 'clear' };
type Message = keyof typeof settingsMessages.en;

@Component({
  selector: 'app-data-management',
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-management.component.html',
})
export class DataManagementComponent {
  protected readonly locale = inject(LocalizationService);
  private readonly persistence = inject(PersistenceService);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly dialog = viewChild.required<DialogComponent>('confirmation');
  private readonly cancel = viewChild<ElementRef<HTMLButtonElement>>('cancel');
  protected readonly text = computed(
    () => settingsMessages[this.locale.language()],
  );
  protected readonly action = signal<Operation | null>(null);
  protected readonly reading = signal(false);
  protected readonly working = signal(false);
  protected readonly download = signal(false);
  protected readonly busy = computed(
    () => this.working() || this.reading() || this.download(),
  );
  protected readonly error = signal<Message | null>(null);
  protected readonly feedback = signal<Message | null>(null);
  protected readonly changeError = signal(false);

  protected async export(): Promise<void> {
    if (this.busy()) return;
    this.resetMessages();
    this.download.set(true);
    try {
      const at = toIsoInstant(new Date());
      const file = await this.persistence.exportBackup(at);
      const url = URL.createObjectURL(file);
      const anchor = this.document.createElement('a');
      anchor.href = url;
      anchor.download = 'doop-backup-' + at.slice(0, 10) + '.json';
      this.document.body.append(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      this.feedback.set(
        file.size > maxBackupBytes ? 'exportedLarge' : 'exported',
      );
    } catch (error) {
      this.error.set(
        error instanceof RangeError ||
          (error instanceof DOMException && error.name === 'QuotaExceededError')
          ? 'exportLimit'
          : 'exportError',
      );
    } finally {
      this.download.set(false);
    }
  }

  protected async select(
    input: HTMLInputElement,
    trigger: HTMLElement,
  ): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.busy()) return;
    this.resetMessages();
    if (file.size > maxBackupBytes) {
      this.error.set('too-large');
      return;
    }

    this.reading.set(true);
    try {
      const result = decodeBackup(
        new TextDecoder('utf-8', { fatal: true }).decode(
          await file.arrayBuffer(),
        ),
      );
      if (result.ok) {
        if (trigger.isConnected && trigger.closest('dialog')?.open)
          this.open(
            { kind: 'import', backup: result.backup, fileName: file.name },
            trigger,
          );
      } else {
        this.error.set(result.reason);
      }
    } catch {
      this.error.set('readError');
    } finally {
      this.reading.set(false);
    }
  }

  protected clear(trigger: HTMLElement): void {
    if (!this.busy()) {
      this.resetMessages();
      this.open({ kind: 'clear' }, trigger);
    }
  }

  protected async confirm(): Promise<void> {
    const operation = this.action();
    if (!operation || this.working()) return;
    this.working.set(true);
    this.changeError.set(false);
    try {
      await this.persistence.replaceWorkspace(
        operation.kind === 'import' ? operation.backup : null,
      );
      this.feedback.set(operation.kind === 'import' ? 'imported' : 'cleared');
      this.dialog().close();
    } catch {
      this.changeError.set(true);
    } finally {
      this.working.set(false);
    }
  }

  private open(operation: Operation, trigger: HTMLElement): void {
    this.changeError.set(false);
    this.action.set(operation);
    this.dialog().open(trigger);
    afterNextRender(() => this.cancel()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  private resetMessages(): void {
    this.error.set(null);
    this.feedback.set(null);
  }
}
