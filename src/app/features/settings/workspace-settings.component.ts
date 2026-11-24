import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import type { WorkspaceSettings } from '../../core/domain/workspace-records';
import { LocalizationService } from '../../core/localization/localization.service';
import { PersistenceService } from '../../core/persistence/persistence.service';
import { FocusTimerService } from '../focus/application/focus-timer.service';
import { ambientSounds } from '../focus/domain/ambient-audio';
import {
  positiveInteger,
  validBreakSetting,
  validFocusMinutes,
} from '../focus/domain/focus-settings';
import { settingsMessages } from './settings-messages';

const numericFields = [
  {
    key: 'focusDurationMinutes',
    label: 'focusMinutes',
    error: 'invalidFocus',
    min: 5,
    max: 480,
    step: 5,
  },
  {
    key: 'shortBreakDurationMinutes',
    label: 'short',
    error: 'invalidShort',
    min: 1,
    max: 60,
    step: 1,
  },
  {
    key: 'longBreakDurationMinutes',
    label: 'long',
    error: 'invalidLong',
    min: 1,
    max: 120,
    step: 1,
  },
  {
    key: 'focusSessionsBeforeLongBreak',
    label: 'frequency',
    error: 'invalidFrequency',
    min: 1,
    max: 12,
    step: 1,
  },
  {
    key: 'dailyGoal',
    label: 'goal',
    error: 'invalidGoal',
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
    step: 1,
  },
] as const;
type NumericField = (typeof numericFields)[number];
type Patch = Partial<Omit<WorkspaceSettings, 'id'>>;

@Component({
  selector: 'app-workspace-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace-settings.component.html',
})
export class WorkspaceSettingsComponent {
  private readonly locale = inject(LocalizationService);
  protected readonly timer = inject(FocusTimerService);
  protected readonly text = computed(
    () => settingsMessages[this.locale.language()],
  );
  protected readonly fields = numericFields;
  protected readonly sounds = ambientSounds;
  protected readonly volumeField = {
    key: 'ambientVolume',
    label: 'volume',
    error: 'invalidVolume',
    min: 0,
    max: 100,
    step: 1,
  } as const;
  protected readonly invalid = signal<
    Partial<Record<NumericField['key'] | 'ambientVolume', boolean>>
  >({});
  protected readonly pending = signal<Patch | null>(null);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);

  constructor() {
    const persistence = inject(PersistenceService);
    effect(() => {
      if (!persistence.replacementRevision()) return;
      untracked(() => {
        this.invalid.set({});
        this.pending.set(null);
        this.saved.set(false);
      });
    });
  }

  protected numberChanged(
    field: NumericField | typeof this.volumeField,
    input: HTMLInputElement,
  ): void {
    const number = input.valueAsNumber;
    const valid =
      field.key === 'focusDurationMinutes'
        ? validFocusMinutes(number)
        : field.key === 'dailyGoal'
          ? positiveInteger(number)
          : field.key === 'ambientVolume'
            ? Number.isFinite(number) && number >= 0 && number <= 100
            : validBreakSetting(number, field.max);
    this.invalid.update((state) => ({ ...state, [field.key]: !valid }));
    if (valid) void this.save({ [field.key]: number });
  }

  protected transition(value: string): void {
    if (value === 'manual' || value === 'automatic')
      void this.save({ breakTransition: value });
  }

  protected sound(value: string): void {
    void this.save({
      ambientSound: this.sounds.find((sound) => sound === value) ?? null,
    });
  }

  protected async save(patch: Patch | null): Promise<void> {
    if (!patch) return;
    this.pending.set({ ...this.pending(), ...patch });
    if (this.saving()) return;
    this.saved.set(false);
    this.saving.set(true);
    try {
      let draft = this.pending();
      while (draft) {
        await this.timer.configure(draft);
        if (draft === this.pending()) this.pending.set(null);
        draft = this.pending();
      }
      this.saved.set(true);
    } catch {
      // Retain unapplied values for the retry action.
    } finally {
      this.saving.set(false);
    }
  }
}
