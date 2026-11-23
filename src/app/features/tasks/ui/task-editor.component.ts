import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { Task } from '../../../core/domain/workspace-records';
import { LocalizationService } from '../../../core/localization/localization.service';
import { DialogComponent } from '../../../shared/ui/dialog.component';
import { TasksService } from '../application/tasks.service';
import type { TaskDraft } from '../domain/task-rules';
import { TaskFormComponent } from './task-form.component';

@Component({
  selector: 'app-task-editor',
  imports: [DialogComponent, TaskFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog
      [heading]="task() ? locale.tasks().editTask : locale.tasks().addTask"
      [closeLabel]="locale.text().close"
      [busy]="saving()"
      [fullHeightSheet]="true"
      (closed)="opened.set(false)"
    >
      @if (opened()) {
        <app-task-form
          [task]="task()"
          [saving]="saving()"
          [saveError]="failed()"
          (submitted)="save($event)"
          (cancelled)="close()"
        />
      }
    </app-dialog>
  `,
})
export class TaskEditorComponent {
  readonly saved = output<void>();
  protected readonly locale = inject(LocalizationService);
  protected readonly opened = signal(false);
  protected readonly task = signal<Task | null>(null);
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);
  private readonly tasks = inject(TasksService);
  private readonly dialog = viewChild.required(DialogComponent);
  private newId?: string;

  open(trigger: HTMLElement, task: Task | null = null): void {
    this.task.set(task);
    this.failed.set(false);
    this.newId = undefined;
    this.opened.set(true);
    this.dialog().open(trigger);
  }

  protected close(): void {
    this.dialog().close();
  }

  protected async save(draft: TaskDraft): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.failed.set(false);
    try {
      const task = this.task();
      if (task) await this.tasks.edit(task.id, draft);
      else await this.tasks.create(draft, (this.newId ??= this.tasks.newId()));
      this.close();
      this.saved.emit();
    } catch {
      this.failed.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}
