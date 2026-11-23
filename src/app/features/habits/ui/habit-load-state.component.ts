import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LocalizationService } from '../../../core/localization/localization.service';
import { PersistenceService } from '../../../core/persistence/persistence.service';
import { HabitsService } from '../application/habits.service';

@Component({
  selector: 'app-habit-load-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (habits.status()) {
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
              (click)="habits.retry()"
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
export class HabitLoadStateComponent {
  protected readonly persistence = inject(PersistenceService);
  protected readonly habits = inject(HabitsService);
  protected readonly text = inject(LocalizationService).habits;
}
