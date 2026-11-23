import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import type { LocalDate } from '../../../core/clock/local-date';
import { scheduleOn } from '../../../core/domain/habit-history';
import type {
  Habit,
  HabitSchedule,
} from '../../../core/domain/workspace-records';
import { LocalizationService } from '../../../core/localization/localization.service';
import { DialogComponent } from '../../../shared/ui/dialog.component';
import {
  HabitsService,
  type HabitHistory,
} from '../application/habits.service';
import {
  consistency,
  orderedWeekdays,
  periodStart,
  weekdayNames,
} from '../domain/habit-rules';
import { HabitEditorComponent } from '../ui/habit-editor.component';
import { TodayHabitsComponent } from '../ui/today-habits.component';

@Component({
  selector: 'app-habits-page',
  imports: [DialogComponent, HabitEditorComponent, TodayHabitsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './habits-page.component.html',
})
export class HabitsPageComponent {
  protected readonly habits = inject(HabitsService);
  protected readonly locale = inject(LocalizationService);
  protected readonly text = this.locale.habits;
  protected readonly period = signal('30');
  protected readonly limit = signal(10);
  protected readonly increaseLimit = (limit: number): number => limit + 10;
  protected readonly deleting = signal<Habit | null>(null);
  protected readonly deletingBusy = signal(false);
  protected readonly deleteError = signal(false);
  protected readonly feedback = signal<
    | 'saved'
    | 'archivedStatus'
    | 'restoredStatus'
    | 'removedStatus'
    | 'actionError'
    | null
  >(null);
  protected readonly dialog =
    viewChild.required<DialogComponent>('confirmation');
  private readonly cancelDelete =
    viewChild.required<ElementRef<HTMLButtonElement>>('cancelDelete');
  private readonly title = inject(Title);
  private readonly injector = inject(Injector);
  private readonly numbers = computed(
    () => new Intl.NumberFormat(this.locale.language()),
  );
  private readonly percent = computed(
    () =>
      new Intl.NumberFormat(this.locale.language(), {
        style: 'percent',
        maximumFractionDigits: 1,
      }),
  );
  private readonly dates = computed(
    () =>
      new Intl.DateTimeFormat(this.locale.language(), {
        dateStyle: 'medium',
        timeZone: 'UTC',
        calendar: 'gregory',
      }),
  );
  private readonly dayNames = computed(() =>
    weekdayNames(this.locale.language(), 'long'),
  );
  protected readonly groups = computed(() => [
    {
      key: 'active',
      title: this.text().active,
      empty: this.text().noneActive,
      rows: this.buildRows(this.habits.active()),
    },
    {
      key: 'archived',
      title: this.text().archived,
      empty: this.text().noneArchived,
      rows: this.buildRows(this.habits.archived()),
    },
  ]);

  constructor() {
    effect(() => this.title.setTitle(this.locale.text().habits + ' · Doop'));
  }

  protected dateLabel(date: LocalDate): string {
    return this.dates().format(new Date(date));
  }

  protected number(value: number): string {
    return this.numbers().format(value);
  }

  private scheduleLabel(schedule: HabitSchedule): string {
    if (schedule.weekdays.length === 7) return this.text().daily;
    const days = orderedWeekdays(this.locale.language())
      .filter((day) => schedule.weekdays.includes(day))
      .map((day) => this.dayNames()[day]);
    return new Intl.ListFormat(this.locale.language(), {
      style: 'short',
    }).format(days);
  }

  private buildRows(history: HabitHistory[]) {
    const today = this.habits.today();
    const period = this.period();
    return history.map((row) => {
      const { habit, completions, schedules } = row;
      const current = scheduleOn(schedules, today);
      const next = schedules.find(
        ({ effectiveFrom, effectiveTo }) =>
          effectiveFrom > today && effectiveTo === null,
      );
      const { eligible, completed } = consistency(
        habit,
        schedules,
        completions,
        today,
        period === 'all' ? habit.startDate : periodStart(today, Number(period)),
      );
      return {
        row,
        current: current && this.scheduleLabel(current),
        upcoming: next && {
          days: this.scheduleLabel(next),
          date: next.effectiveFrom,
          label: this.text().upcoming.replace(
            '{date}',
            this.dateLabel(next.effectiveFrom),
          ),
        },
        rate: eligible ? this.percent().format(completed / eligible) : null,
        occurrences: eligible
          ? this.text()
              .occurrences.replace('{done}', this.number(completed))
              .replace('{total}', this.number(eligible))
          : this.text().noOccurrences,
      };
    });
  }

  protected async archive(habit: Habit, fallback: HTMLElement): Promise<void> {
    this.feedback.set(null);
    const archiving = habit.status === 'active';
    try {
      await this.habits.archive(habit, archiving);
      this.feedback.set(archiving ? 'archivedStatus' : 'restoredStatus');
    } catch {
      this.feedback.set('actionError');
    } finally {
      afterNextRender(() => fallback.focus(), { injector: this.injector });
    }
  }

  protected confirmDelete(habit: Habit, trigger: HTMLElement): void {
    this.deleting.set(habit);
    this.deleteError.set(false);
    this.dialog().open(trigger);
    this.cancelDelete().nativeElement.focus();
  }

  protected async remove(): Promise<void> {
    const habit = this.deleting();
    if (!habit || this.deletingBusy()) return;
    this.deletingBusy.set(true);
    this.deleteError.set(false);
    try {
      await this.habits.remove(habit);
      this.feedback.set('removedStatus');
      this.dialog().close();
    } catch {
      this.deleteError.set(true);
    } finally {
      this.deletingBusy.set(false);
    }
  }
}
