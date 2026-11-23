import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { focusGoalMessages } from '../../core/localization/focus-metric-labels';
import { LocalizationService } from '../../core/localization/localization.service';

@Component({
  selector: 'app-focus-goal-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showTotal()) {
      <p class="my-2 font-semibold">
        {{
          text()
            .of.replace('{count}', number().format(count()))
            .replace('{goal}', number().format(goal()))
        }}
      </p>
    }
    <progress
      class="block w-full"
      [attr.aria-label]="text().sessions"
      [value]="value()"
      [max]="goal()"
    ></progress>
    <p class="mt-1 text-sm text-muted" role="status">
      {{
        remaining() === 0
          ? text().goalReached
          : text().remaining.replace('{count}', number().format(remaining()))
      }}
    </p>
  `,
  styles: `
    progress {
      appearance: none;
      block-size: 0.5rem;
      overflow: hidden;
      border: 0;
      border-radius: var(--radius-control);
      background: var(--border);
      color: var(--accent);
    }
    progress::-webkit-progress-bar {
      background: var(--border);
    }
    progress::-webkit-progress-value {
      background: var(--accent);
    }
    progress::-moz-progress-bar {
      background: var(--accent);
    }
    @media (forced-colors: active) {
      progress {
        appearance: auto;
      }
    }
  `,
})
export class FocusGoalProgressComponent {
  readonly count = input.required<number>();
  readonly goal = input.required<number>();
  readonly showTotal = input(false);
  private readonly locale = inject(LocalizationService);
  protected readonly text = computed(
    () => focusGoalMessages[this.locale.language()],
  );
  protected readonly number = computed(
    () => new Intl.NumberFormat(this.locale.language()),
  );
  protected readonly value = computed(() =>
    Math.min(this.count(), this.goal()),
  );
  protected readonly remaining = computed(() => this.goal() - this.value());
}
