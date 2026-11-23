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
import type { Task } from '../../../core/domain/workspace-records';
import { LocalizationService } from '../../../core/localization/localization.service';
import { DialogComponent } from '../../../shared/ui/dialog.component';
import { TasksService } from '../application/tasks.service';
import { filters, sorts } from '../domain/task-rules';
import { TaskEditorComponent } from '../ui/task-editor.component';
import { TaskListComponent } from '../ui/task-list.component';
import { TaskLoadStateComponent } from '../ui/task-load-state.component';

@Component({
  selector: 'app-tasks-page',
  imports: [
    DialogComponent,
    TaskEditorComponent,
    TaskListComponent,
    TaskLoadStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tasks-page.component.html',
})
export class TasksPageComponent {
  protected readonly tasks = inject(TasksService);
  protected readonly locale = inject(LocalizationService);
  protected readonly text = this.locale.tasks;
  protected readonly filters = filters;
  protected readonly sorts = sorts;
  protected readonly numbers = computed(
    () => new Intl.NumberFormat(this.locale.language()),
  );
  protected readonly removing = signal<Task | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal(false);
  protected readonly actionError = signal(false);
  protected readonly feedback = signal<
    'saved' | 'deleted' | 'marked' | 'reopened' | null
  >(null);
  private readonly title = inject(Title);
  private readonly injector = inject(Injector);
  private readonly addButton =
    viewChild.required<ElementRef<HTMLButtonElement>>('addButton');

  constructor() {
    effect(() => this.title.setTitle(this.locale.text().tasks + ' · Doop'));
  }

  protected async toggle(task: Task, trigger: HTMLElement): Promise<void> {
    const complete = task.status === 'pending';
    this.actionError.set(false);
    this.feedback.set(null);
    try {
      await this.tasks.changeCompletion(task.id, complete);
      this.feedback.set(complete ? 'marked' : 'reopened');
    } catch {
      this.actionError.set(true);
    } finally {
      this.focusAfterChange(trigger);
    }
  }

  protected askDelete(
    task: Task,
    trigger: HTMLElement,
    dialog: DialogComponent,
    cancel: HTMLElement,
  ): void {
    this.removing.set(task);
    this.deleteError.set(false);
    dialog.open(trigger);
    cancel.focus();
  }

  protected async confirmDelete(dialog: DialogComponent): Promise<void> {
    const task = this.removing();
    if (!task || this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set(false);
    this.actionError.set(false);
    this.feedback.set(null);
    try {
      await this.tasks.remove(task.id);
      dialog.close();
      this.feedback.set('deleted');
      this.focusAfterChange();
    } catch {
      this.deleteError.set(true);
    } finally {
      this.deleting.set(false);
    }
  }

  protected onSaved(): void {
    this.actionError.set(false);
    this.feedback.set('saved');
  }

  private focusAfterChange(trigger?: HTMLElement): void {
    afterNextRender(
      () =>
        (trigger?.isConnected
          ? trigger
          : this.addButton().nativeElement
        ).focus(),
      { injector: this.injector },
    );
  }
}
