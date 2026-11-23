import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type {
  Habit,
  HabitCompletion,
} from '../../../core/domain/workspace-records';
import { LocalizationService } from '../../../core/localization/localization.service';
import { HabitsService } from '../application/habits.service';
import { HabitLoadStateComponent } from './habit-load-state.component';

@Component({
  selector: 'app-today-habits',
  imports: [RouterLink, HabitLoadStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './today-habits.component.css',
  templateUrl: './today-habits.component.html',
})
export class TodayHabitsComponent {
  readonly overview = input(false);
  protected readonly habits = inject(HabitsService);
  private readonly locale = inject(LocalizationService);
  private readonly injector = inject(Injector);
  protected readonly text = this.locale.habits;
  protected readonly feedback = signal<
    'completedStatus' | 'undoneStatus' | 'actionError' | null
  >(null);
  protected readonly completed = computed(
    () => this.habits.todayTotals().completed,
  );
  protected readonly progress = computed(() => {
    const rows = this.habits.scheduled();
    const numbers = new Intl.NumberFormat(this.locale.language());
    return this.text()
      .progress.replace('{done}', numbers.format(this.completed()))
      .replace('{total}', numbers.format(rows.length));
  });

  protected async toggle(
    habit: Habit,
    completion: HabitCompletion | undefined,
    trigger: HTMLElement,
  ): Promise<void> {
    this.feedback.set(null);
    try {
      await this.habits.toggle(habit, completion, this.habits.today());
      this.feedback.set(completion ? 'undoneStatus' : 'completedStatus');
    } catch {
      this.feedback.set('actionError');
    } finally {
      afterNextRender(
        () => {
          if (trigger.isConnected && !trigger.matches(':disabled'))
            trigger.focus();
          else
            trigger.ownerDocument
              .querySelector<HTMLElement>('#today-habits')
              ?.focus();
        },
        { injector: this.injector },
      );
    }
  }
}
