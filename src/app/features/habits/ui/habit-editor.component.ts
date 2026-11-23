import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { createRecordId } from '../../../core/domain/record-id';
import { LocalizationService } from '../../../core/localization/localization.service';
import { DialogComponent } from '../../../shared/ui/dialog.component';
import {
  HabitsService,
  type HabitHistory,
} from '../application/habits.service';
import type { HabitDraft } from '../domain/habit-rules';
import { HabitFormComponent } from './habit-form.component';

@Component({
  selector: 'app-habit-editor',
  imports: [DialogComponent, HabitFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog
      [heading]="history() ? text().edit : text().add"
      [closeLabel]="locale.text().close"
      [busy]="saving()"
      [fullHeightSheet]="true"
      (closed)="opened.set(false)"
    >
      @if (opened()) {
        <app-habit-form
          [history]="history()"
          [today]="today()"
          [saving]="saving()"
          [failed]="failed()"
          (submitted)="save($event)"
          (cancelled)="dialog().close()"
        />
      }
    </app-dialog>
  `,
})
export class HabitEditorComponent {
  readonly saved = output<void>();
  protected readonly locale = inject(LocalizationService);
  protected readonly text = this.locale.habits;
  protected readonly history = signal<HabitHistory | null>(null);
  protected readonly opened = signal(false);
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);
  private readonly habits = inject(HabitsService);
  protected readonly today = this.habits.today;
  protected readonly dialog = viewChild.required(DialogComponent);
  private ids?: { habit: string; schedule: string };

  open(trigger: HTMLElement, history: HabitHistory | null = null): void {
    this.history.set(history);
    this.ids = undefined;
    this.failed.set(false);
    this.opened.set(true);
    this.dialog().open(trigger);
  }

  protected async save(draft: HabitDraft): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.failed.set(false);
    try {
      this.ids ??= {
        habit: this.history()?.habit.id ?? createRecordId(),
        schedule: createRecordId(),
      };
      await this.habits.save(
        draft,
        this.history()?.habit ?? null,
        this.ids.habit,
        this.ids.schedule,
      );
      this.dialog().close();
      this.saved.emit();
    } catch {
      this.failed.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}
