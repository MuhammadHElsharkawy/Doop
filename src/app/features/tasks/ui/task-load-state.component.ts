import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LocalizationService } from '../../../core/localization/localization.service';
import { PersistenceService } from '../../../core/persistence/persistence.service';
import { TasksService } from '../application/tasks.service';

@Component({
  selector: 'app-task-load-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (tasks.status()) {
      @case ('loading') {
        <p class="notice" role="status">{{ text().loading }}</p>
      }
      @case ('error') {
        @if (persistence.status() === 'ready') {
          <div class="notice grid gap-2">
            <p role="alert">{{ text().loadError }}</p>
            <button
              class="task-button justify-self-start"
              type="button"
              (click)="tasks.retry()"
            >
              {{ text().retry }}
            </button>
          </div>
        }
      }
      @case ('ready') {
        <ng-content />
      }
    }
  `,
})
export class TaskLoadStateComponent {
  protected readonly persistence = inject(PersistenceService);
  protected readonly tasks = inject(TasksService);
  protected readonly text = inject(LocalizationService).tasks;
}
