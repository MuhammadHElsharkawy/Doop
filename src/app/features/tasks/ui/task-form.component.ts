import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { Task } from '../../../core/domain/workspace-records';
import { LocalizationService } from '../../../core/localization/localization.service';
import {
  priorities,
  validateTaskDraft,
  type DraftField,
  type TaskDraft,
} from '../domain/task-rules';

@Component({
  selector: 'app-task-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-form.component.html',
})
export class TaskFormComponent {
  readonly task = input<Task | null>(null);
  readonly saving = input(false);
  readonly saveError = input(false);
  readonly submitted = output<TaskDraft>();
  readonly cancelled = output<void>();
  protected readonly locale = inject(LocalizationService);
  protected readonly text = this.locale.tasks;
  protected readonly priorities = priorities;
  protected readonly invalid = signal<DraftField[]>([]);
  private readonly title =
    viewChild.required<ElementRef<HTMLInputElement>>('title');

  constructor() {
    afterNextRender(() => this.title().nativeElement.focus());
  }

  protected submit(
    event: SubmitEvent,
    form: HTMLFormElement,
    dateInput: HTMLInputElement,
  ): void {
    event.preventDefault();
    if (this.saving()) return;
    const fields = new FormData(form);
    const result = validateTaskDraft(
      {
        title: String(fields.get('title') ?? ''),
        priority: String(fields.get('priority') ?? ''),
        dueDate: String(fields.get('dueDate') ?? ''),
        expectedSessions: String(fields.get('expectedSessions') ?? ''),
      },
      dateInput.validity.badInput,
    );
    if (result.valid) {
      this.invalid.set([]);
      this.submitted.emit(result.draft);
      return;
    }
    this.invalid.set(result.invalid);
    const first = result.invalid[0];
    if (first)
      form.querySelector<HTMLElement>('[name="' + first + '"]')?.focus();
  }
}
