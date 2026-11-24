import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isLocalDate, type LocalDate } from '../../../core/clock/local-date';
import { selectFocusHistory } from '../../../core/domain/focus-metrics';
import type { FocusSession } from '../../../core/domain/workspace-records';
import { focusDurationFormatter } from '../../../core/localization/focus-metric-labels';
import { LocalizationService } from '../../../core/localization/localization.service';
import { FocusHistoryService } from '../../../core/persistence/focus-history.service';
import { DialogComponent } from '../../../shared/ui/dialog.component';
import { FocusGoalProgressComponent } from '../../../shared/ui/focus-goal-progress.component';
import { FocusTimerService } from '../application/focus-timer.service';
import { focusExtras } from './focus-extras-messages';
import { focusMessages } from './focus-messages';

@Component({
  selector: 'app-focus-history',
  imports: [DialogComponent, FocusGoalProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './focus-history.component.html',
})
export class FocusHistoryComponent {
  private readonly timer = inject(FocusTimerService);
  protected readonly locale = inject(LocalizationService);
  protected readonly history = inject(FocusHistoryService);
  protected readonly text = computed(() => focusExtras[this.locale.language()]);
  protected readonly goal = computed(() => this.timer.settings().dailyGoal);
  protected readonly goalReady = this.timer.ready;
  protected readonly counts = this.history.today;
  protected readonly date = signal<LocalDate | null>(null);
  protected readonly rows = computed(() =>
    selectFocusHistory(this.history.sessions() ?? [], this.date()),
  );
  protected readonly selected = signal<FocusSession | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal(false);
  protected readonly deleted = signal(false);
  protected readonly saving = signal(false);
  protected readonly goalFeedback = signal<
    'invalidGoal' | 'goalSaved' | 'goalError' | null
  >(null);

  private readonly dialog = viewChild.required<DialogComponent>('confirm');
  private readonly cancel =
    viewChild.required<ElementRef<HTMLButtonElement>>('cancel');
  private readonly filter =
    viewChild.required<ElementRef<HTMLInputElement>>('dateFilter');
  private readonly numberFormat = computed(
    () => new Intl.NumberFormat(this.locale.language()),
  );
  private readonly timestampFormat = computed(
    () =>
      new Intl.DateTimeFormat(this.locale.language(), {
        dateStyle: 'medium',
        timeStyle: 'medium',
        calendar: 'gregory',
      }),
  );
  private readonly recordedTimeFormat = computed(
    () =>
      new Intl.DateTimeFormat(this.locale.language(), {
        dateStyle: 'medium',
        timeStyle: 'medium',
        calendar: 'gregory',
        timeZone: 'UTC',
      }),
  );
  protected readonly formatDuration = computed(() =>
    focusDurationFormatter(this.locale.language()),
  );

  protected number(value: number): string {
    return this.numberFormat().format(value);
  }

  protected timestamp(value: string): string {
    return this.timestampFormat().format(new Date(value));
  }

  protected recordedEnd(row: FocusSession): string {
    const end = new Date(
      Date.parse(row.endedAt) - row.completionTimezoneOffsetMinutes * 60_000,
    );
    return this.recordedTimeFormat().format(end);
  }

  protected filterDate(value: string): void {
    this.date.set(isLocalDate(value) ? value : null);
  }

  protected async saveGoal(
    event: SubmitEvent,
    field: HTMLInputElement,
  ): Promise<void> {
    event.preventDefault();
    if (this.saving() || !this.goalReady()) return;
    const value = field.valueAsNumber;
    if (!Number.isSafeInteger(value) || value < 1) {
      this.goalFeedback.set('invalidGoal');
      field.focus();
      return;
    }
    this.saving.set(true);
    try {
      await this.timer.configure({ dailyGoal: value });
      this.goalFeedback.set('goalSaved');
    } catch {
      this.goalFeedback.set('goalError');
    } finally {
      this.saving.set(false);
    }
  }

  protected openRemove(session: FocusSession, trigger: HTMLElement): void {
    this.selected.set(session);
    this.deleteError.set(false);
    this.deleted.set(false);
    this.dialog().open(trigger, this.filter().nativeElement);
    this.cancel().nativeElement.focus();
  }

  protected async remove(): Promise<void> {
    const session = this.selected();
    if (!session || this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set(false);
    try {
      await this.history.remove(session.id);
      this.deleted.set(true);
      this.dialog().close();
    } catch {
      this.deleteError.set(true);
    } finally {
      this.deleting.set(false);
    }
  }

  protected closed(): void {
    this.selected.set(null);
  }

  protected readonly modeLabel = computed(
    () => focusMessages[this.locale.language()],
  );
}
