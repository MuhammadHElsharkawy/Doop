import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import type { LocalDate } from '../../../core/clock/local-date';
import type { Task } from '../../../core/domain/workspace-records';
import { LocalizationService } from '../../../core/localization/localization.service';
import { isOverdue } from '../domain/task-rules';

type TaskAction = { task: Task; trigger: HTMLButtonElement };

@Component({
  selector: 'app-task-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-list.component.html',
})
export class TaskListComponent {
  readonly tasks = input.required<readonly Task[]>();
  readonly today = input.required<LocalDate>();
  readonly counts = input<ReadonlyMap<string, number> | null>(null);
  readonly management = input(false);
  readonly busy = input(false);
  readonly toggleCompletion = output<TaskAction>();
  readonly edit = output<TaskAction>();
  readonly remove = output<TaskAction>();
  private readonly locale = inject(LocalizationService);
  protected readonly text = this.locale.tasks;
  protected readonly isOverdue = isOverdue;
  private readonly dateFormatter = computed(
    () =>
      new Intl.DateTimeFormat(this.locale.language(), {
        dateStyle: 'medium',
        timeZone: 'UTC',
        calendar: 'gregory',
      }),
  );
  private readonly numbers = computed(
    () => new Intl.NumberFormat(this.locale.language()),
  );

  protected dateLabel(date: LocalDate): string {
    return this.dateFormatter().format(new Date(date + 'T00:00:00Z'));
  }

  protected progress(task: Task): string {
    const counts = this.counts();
    const expected = this.numbers().format(task.expectedSessions ?? 0);
    if (!counts)
      return this.text().sessionTarget.replace('{expected}', expected);
    return this.text()
      .sessionProgress.replace('{expected}', expected)
      .replace('{actual}', this.numbers().format(counts.get(task.id) ?? 0));
  }
}
