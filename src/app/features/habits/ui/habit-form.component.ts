import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  type OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { LocalDate } from '../../../core/clock/local-date';
import {
  weekdays,
  type HabitSchedule,
} from '../../../core/domain/workspace-records';
import { LocalizationService } from '../../../core/localization/localization.service';
import type { HabitHistory } from '../application/habits.service';
import {
  orderedWeekdays,
  validateHabitDraft,
  weekdayNames,
  type HabitDraft,
  type HabitField,
} from '../domain/habit-rules';

@Component({
  selector: 'app-habit-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './habit-form.component.html',
})
export class HabitFormComponent implements OnInit {
  readonly history = input<HabitHistory | null>(null);
  readonly today = input.required<LocalDate>();
  readonly saving = input(false);
  readonly failed = input(false);
  readonly submitted = output<HabitDraft>();
  readonly cancelled = output<void>();

  protected readonly locale = inject(LocalizationService);
  protected readonly text = this.locale.habits;
  protected readonly habit = computed(() => this.history()?.habit);
  protected readonly initialStart = signal('');
  protected readonly locked = computed(() => {
    const original = this.history();
    const today = this.today();
    return (
      !!original &&
      (original.habit.startDate <= today ||
        original.schedules.some(({ effectiveFrom }) => effectiveFrom <= today))
    );
  });
  protected readonly ordered = computed(() =>
    orderedWeekdays(this.locale.language()),
  );
  protected readonly dayNames = computed(() =>
    weekdayNames(this.locale.language(), 'long'),
  );
  protected readonly dayLabels = computed(() =>
    weekdayNames(this.locale.language(), 'short'),
  );
  protected readonly selectedDays = signal<HabitSchedule['weekdays']>([]);
  protected readonly daily = signal(true);
  protected readonly invalid = signal<HabitField | null>(null);
  private readonly nameInput =
    viewChild.required<ElementRef<HTMLInputElement>>('nameInput');

  ngOnInit(): void {
    const schedules = this.history()?.schedules;
    const open = schedules?.find(({ effectiveTo }) => effectiveTo === null);
    this.initialStart.set(this.habit()?.startDate ?? this.today());
    const days = open?.weekdays ?? [];
    this.daily.set(!schedules || days.length === weekdays.length);
    this.selectedDays.set(days.length === weekdays.length ? [] : days);
  }

  constructor() {
    afterNextRender(() => this.nameInput().nativeElement.focus());
  }

  protected toggleDay(
    day: HabitSchedule['weekdays'][number],
    checked: boolean,
  ): void {
    this.selectedDays.update((days) =>
      checked ? [...days, day] : days.filter((value) => value !== day),
    );
  }

  protected submit(
    event: SubmitEvent,
    form: HTMLFormElement,
    start: HTMLInputElement,
  ): void {
    event.preventDefault();
    if (this.saving()) return;
    const values = new FormData(form);
    const result = validateHabitDraft(
      String(values.get('name') ?? ''),
      String(values.get('description') ?? ''),
      start.validity.badInput ? '' : start.value,
      this.daily() ? [...weekdays] : this.selectedDays(),
    );
    if (typeof result === 'string') {
      this.invalid.set(result);
      form.querySelector<HTMLElement>('[name="' + result + '"]')?.focus();
    } else {
      this.invalid.set(null);
      this.submitted.emit(result);
    }
  }
}
