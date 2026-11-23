import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import type { Task } from '../../core/domain/workspace-records';
import { LocalizationService } from '../../core/localization/localization.service';
import { HabitsService } from '../habits/application/habits.service';
import { HabitEditorComponent } from '../habits/ui/habit-editor.component';
import { TodayHabitsComponent } from '../habits/ui/today-habits.component';
import { TasksService } from '../tasks/application/tasks.service';
import { TaskEditorComponent } from '../tasks/ui/task-editor.component';
import { TaskListComponent } from '../tasks/ui/task-list.component';
import { TaskLoadStateComponent } from '../tasks/ui/task-load-state.component';

@Component({
  selector: 'app-overview-page',
  imports: [
    RouterLink,
    TaskEditorComponent,
    TaskListComponent,
    TaskLoadStateComponent,
    HabitEditorComponent,
    TodayHabitsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overview-page.component.html',
})
export class OverviewPageComponent {
  protected readonly tasks = inject(TasksService);
  protected readonly habits = inject(HabitsService);
  protected readonly habitSaved = signal(false);
  protected readonly locale = inject(LocalizationService);
  protected readonly text = this.locale.tasks;
  protected readonly undoTask = signal<Task | undefined>(undefined);
  protected readonly feedback = signal<
    'saved' | 'marked' | 'undoDone' | 'undoUnavailable' | null
  >(null);
  protected readonly failed = signal(false);
  private readonly title = inject(Title);
  private readonly injector = inject(Injector);
  private readonly addButton =
    viewChild.required<ElementRef<HTMLButtonElement>>('addButton');
  private readonly undoButton =
    viewChild<ElementRef<HTMLButtonElement>>('undoButton');

  constructor() {
    effect(() => this.title.setTitle(this.locale.text().overview + ' · Doop'));
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
        (target ?? this.addButton().nativeElement).focus();
      },
      { injector: this.injector },
    );
  }
}
