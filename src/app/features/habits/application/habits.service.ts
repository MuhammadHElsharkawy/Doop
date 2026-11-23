import {
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { LocalCalendarService } from '../../../core/clock/local-calendar.service';
import {
  toIsoInstant,
  toLocalDate,
  type LocalDate,
} from '../../../core/clock/local-date';
import {
  habitActivityOn,
  scheduleOn,
  weekdayOf,
} from '../../../core/domain/habit-history';
import { createRecordId } from '../../../core/domain/record-id';
import type {
  Habit,
  HabitCompletion,
  HabitSchedule,
} from '../../../core/domain/workspace-records';
import { PersistenceService } from '../../../core/persistence/persistence.service';
import type { HabitDraft } from '../domain/habit-rules';

export interface HabitHistory {
  habit: Habit;
  schedules: HabitSchedule[];
  completions: HabitCompletion[];
}

@Injectable({ providedIn: 'root' })
export class HabitsService {
  private readonly persistence = inject(PersistenceService);
  private readonly repository = this.persistence.repositories.habits;
  private readonly document = inject(DOCUMENT);
  private readonly records = signal<HabitHistory[]>([]);
  private readonly completions = signal<HabitCompletion[]>([]);
  private readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly running = signal(false);
  private readonly calendar = inject(LocalCalendarService);
  private request = 0;

  readonly status = this.state.asReadonly();
  readonly busy = this.running.asReadonly();
  readonly today = this.calendar.today;
  readonly active = computed(() =>
    this.records().filter(
      ({ habit }) => habit.deletedAt === null && habit.status === 'active',
    ),
  );
  readonly archived = computed(() =>
    this.records().filter(
      ({ habit }) => habit.deletedAt === null && habit.status === 'archived',
    ),
  );
  readonly history = computed(() =>
    this.completions()
      .filter(({ scheduledDate }) => scheduledDate <= this.today())
      .sort(
        (a, b) =>
          b.scheduledDate.localeCompare(a.scheduledDate) ||
          b.completedAt.localeCompare(a.completedAt),
      ),
  );
  readonly scheduled = computed(() => {
    const today = this.today();
    return this.active().flatMap(({ habit, schedules, completions }) => {
      if (
        habitActivityOn(habit, today) !== 'active' ||
        !scheduleOn(schedules, today)?.weekdays.includes(weekdayOf(today))
      )
        return [];
      return [
        {
          habit,
          completion: completions.find(
            ({ scheduledDate }) => scheduledDate === today,
          ),
        },
      ];
    });
  });
  readonly todayTotals = computed(() => {
    const rows = this.scheduled();
    return {
      total: rows.length,
      completed: rows.filter((row) => !!row.completion).length,
    };
  });

  constructor() {
    effect(() => {
      if (
        this.persistence.status() === 'ready' &&
        untracked(this.state) === 'error'
      )
        void this.load();
    });
    const onVisible = () => {
      if (this.document.visibilityState !== 'visible') return;
      if (!this.busy()) void this.load();
    };
    this.document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('visibilitychange', onVisible);
    });
    void this.load();
  }

  async retry(): Promise<void> {
    if (this.busy()) return;
    await this.persistence.retry();
    if (!this.busy()) await this.load();
  }

  private async load(): Promise<void> {
    const request = ++this.request;
    if (this.status() !== 'ready') this.state.set('loading');
    try {
      const { habits, schedules, completions } =
        await this.repository.readHistory();
      if (request !== this.request) return;
      habits.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const records = new Map(
        habits.map((habit): [string, HabitHistory] => [
          habit.id,
          { habit, schedules: [], completions: [] },
        ]),
      );
      for (const row of schedules)
        records.get(row.habitId)?.schedules.push(row);
      for (const row of completions)
        records.get(row.habitId)?.completions.push(row);
      this.records.set([...records.values()]);
      this.completions.set(completions);
      this.state.set('ready');
    } catch {
      if (request === this.request) this.state.set('error');
    }
  }

  save(
    draft: HabitDraft,
    original: Habit | null,
    id: string,
    scheduleId: string,
  ): Promise<void> {
    return this.mutate(async () => {
      const date = new Date();
      const now = toIsoInstant(date);
      const { weekdays, ...details } = draft;
      if (original) {
        this.calendar.refresh(date);
        await this.repository.editWithSchedule(
          original,
          details,
          weekdays,
          scheduleId,
          toLocalDate(date),
          now,
        );
      } else {
        await this.repository.createWithSchedule(
          {
            ...details,
            id,
            status: 'active',
            archivedAt: null,
            archivePeriods: [],
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            deletedLocalDate: null,
          },
          {
            id: scheduleId,
            habitId: id,
            weekdays,
            effectiveFrom: details.startDate,
            effectiveTo: null,
            createdAt: now,
          },
        );
      }
    });
  }

  toggle(
    habit: Habit,
    completion: HabitCompletion | undefined,
    shownDate: LocalDate,
  ): Promise<void> {
    return this.mutate(async () => {
      const now = new Date();
      if (shownDate !== toLocalDate(now)) {
        this.calendar.refresh(now);
        throw new DOMException('The local day changed', 'ConstraintError');
      }
      await this.persistence.repositories.completions.setOccurrence(
        habit.id,
        shownDate,
        completion
          ? { complete: false, id: completion.id }
          : { complete: true, id: createRecordId(), now: toIsoInstant(now) },
      );
    });
  }

  archive(habit: Habit, archived: boolean): Promise<void> {
    return this.mutate(() => {
      const now = new Date();
      return this.repository.setArchived(
        habit.id,
        archived,
        toLocalDate(now),
        toIsoInstant(now),
      );
    });
  }

  remove(habit: Habit): Promise<void> {
    return this.mutate(async () => {
      const now = new Date();
      await this.repository.softDelete(
        habit.id,
        toIsoInstant(now),
        toLocalDate(now),
      );
    });
  }

  private async mutate(operation: () => Promise<void>): Promise<void> {
    if (this.busy() || this.status() !== 'ready')
      throw new Error('Habit storage is not ready');
    ++this.request;
    this.running.set(true);
    try {
      await operation();
      await this.load();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'ConstraintError')
        await this.load();
      throw error;
    } finally {
      this.running.set(false);
    }
  }
}
