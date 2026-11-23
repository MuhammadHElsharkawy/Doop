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
import { RouterLink } from '@angular/router';
import { LocalCalendarService } from '../../core/clock/local-calendar.service';
import type { Task } from '../../core/domain/workspace-records';
import {
  focusDurationFormatter,
  focusGoalMessages,
} from '../../core/localization/focus-metric-labels';
import { LocalizationService } from '../../core/localization/localization.service';
import { FocusHistoryService } from '../../core/persistence/focus-history.service';
import { PersistenceService } from '../../core/persistence/persistence.service';
import { FocusGoalProgressComponent } from '../../shared/ui/focus-goal-progress.component';
import { HabitsService } from '../habits/application/habits.service';
import { HabitEditorComponent } from '../habits/ui/habit-editor.component';
import { TodayHabitsComponent } from '../habits/ui/today-habits.component';
import { TasksService } from '../tasks/application/tasks.service';
import { TaskEditorComponent } from '../tasks/ui/task-editor.component';
import { TaskListComponent } from '../tasks/ui/task-list.component';
import { TaskLoadStateComponent } from '../tasks/ui/task-load-state.component';
import { overviewMessages } from './overview-messages';

@Component({
  selector: 'app-overview-page',
  imports: [
    RouterLink,
    TaskEditorComponent,
    TaskListComponent,
    TaskLoadStateComponent,
    HabitEditorComponent,
    TodayHabitsComponent,
    FocusGoalProgressComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overview-page.component.html',
  styles: `
    .overview-columns {
      display: grid;
      gap: 1.5rem;
      align-items: start;
    }
    @media (min-width: 64rem) {
      .overview-columns {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class OverviewPageComponent {
  protected readonly tasks = inject(TasksService);
  protected readonly habits = inject(HabitsService);
  protected readonly focus = inject(FocusHistoryService);
  private readonly persistence = inject(PersistenceService);
  protected readonly calendar = inject(LocalCalendarService);
  protected readonly habitSaved = signal(false);
  protected readonly locale = inject(LocalizationService);
  protected readonly text = this.locale.tasks;
  protected readonly copy = computed(
    () => overviewMessages[this.locale.language()],
  );
  protected readonly goalTitle = computed(
    () => focusGoalMessages[this.locale.language()].sessions,
  );
  protected readonly greeting = computed(() => {
    const hour = this.calendar.hour();
    return this.copy()[
      hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
    ];
  });
  private readonly dateFormat = computed(
    () =>
      new Intl.DateTimeFormat(this.locale.language(), {
        dateStyle: 'full',
        calendar: 'gregory',
        timeZone: 'UTC',
      }),
  );
  protected readonly dateLabel = computed(() =>
    this.dateFormat().format(new Date(this.calendar.today() + 'T00:00:00Z')),
  );
  protected readonly formatDuration = computed(() =>
    focusDurationFormatter(this.locale.language()),
  );
  private readonly numbers = computed(
    () => new Intl.NumberFormat(this.locale.language()),
  );
  protected readonly loadingSummary = computed(
    () =>
      this.tasks.status() === 'loading' ||
      this.habits.status() === 'loading' ||
      this.focus.status() === 'loading',
  );
  protected readonly retryingGoal = signal(false);
  protected readonly workspaceUnavailable = computed(() => {
    const status = this.persistence.status();
    return (
      status === 'blocked' ||
      status === 'connection-error' ||
      status === 'migration-error'
    );
  });
  protected readonly undoTask = signal<Task | undefined>(undefined);
  protected readonly feedback = signal<
    'saved' | 'marked' | 'undoDone' | 'undoUnavailable' | null
  >(null);
  protected readonly failed = signal(false);
  private readonly title = inject(Title);
  private readonly injector = inject(Injector);
  private readonly tasksHeading =
    viewChild.required<ElementRef<HTMLHeadingElement>>('tasksHeading');
  private readonly undoButton =
    viewChild<ElementRef<HTMLButtonElement>>('undoButton');

  constructor() {
    effect(() => this.title.setTitle(this.locale.text().overview + ' · Doop'));
  }

  protected ratio(value: { completed: number; total: number }): string {
    const numbers = this.numbers();
    return this.copy()
      .ratio.replace('{completed}', numbers.format(value.completed))
      .replace('{total}', numbers.format(value.total));
  }

  protected async retryGoal(
    heading: HTMLElement,
    trigger: HTMLButtonElement,
  ): Promise<void> {
    if (this.retryingGoal()) return;
    const document = heading.ownerDocument;
    const hadFocus = document.activeElement === trigger;
    if (hadFocus) heading.focus({ preventScroll: true });
    this.retryingGoal.set(true);
    try {
      await this.focus.retry();
    } finally {
      this.retryingGoal.set(false);
      if (
        hadFocus &&
        document.activeElement === heading &&
        trigger.isConnected &&
        (this.focus.status() === 'error' || this.focus.goal() === 'error')
      )
        trigger.focus({ preventScroll: true });
    }
  }

  protected async complete(task: Task, trigger: HTMLElement): Promise<void> {
    this.failed.set(false);
    try {
      const updated = await this.tasks.changeCompletion(task.id, true);
      if (updated) {
        this.undoTask.set(updated);
        this.feedback.set('marked');
      }
      this.focusAfterChange(true);
    } catch {
      this.failed.set(true);
      afterNextRender(() => trigger.focus(), { injector: this.injector });
    }
  }

  protected async undo(): Promise<void> {
    const task = this.undoTask();
    if (!task) return;
    this.failed.set(false);
    try {
      const updated = await this.tasks.changeCompletion(task.id, false, task);
      this.undoTask.set(undefined);
      this.feedback.set(updated ? 'undoDone' : 'undoUnavailable');
      this.focusAfterChange(false);
    } catch {
      this.failed.set(true);
      this.focusAfterChange(true);
    }
  }

  protected onSaved(): void {
    this.failed.set(false);
    if (!this.undoTask()) this.feedback.set('saved');
  }

  private focusAfterChange(preferUndo: boolean): void {
    afterNextRender(
      () => {
        const target = preferUndo
          ? this.undoButton()?.nativeElement
          : undefined;
        (target ?? this.tasksHeading().nativeElement).focus();
      },
      { injector: this.injector },
    );
  }
}
