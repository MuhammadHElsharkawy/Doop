import {
  isLocalDate,
  type IsoInstant,
  type LocalDate,
} from '../clock/local-date';
import type { Store, WorkspaceDatabase } from '../database/workspace-database';
import {
  habitActivityOn,
  nonOverlappingSchedules,
  scheduleOn,
  validScheduleHistory,
  weekdayOf,
} from '../domain/habit-history';
import type {
  ActiveSession,
  FocusSession,
  Habit,
  HabitCompletion,
  HabitSchedule,
  PomodoroCycle,
  Task,
  WorkspaceRecords,
} from '../domain/workspace-records';
import type { Preferences } from '../preferences/preferences.service';
import type { BackupV2 } from './backup';
import {
  InvalidActiveSessionError,
  InvalidRecordError,
  recordValidators,
  recoverLegacySettings,
} from './record-validation';

function verify<K extends Store>(
  store: K,
  value: unknown,
): WorkspaceRecords[K] {
  if (!recordValidators[store](value)) {
    if (store === 'activeSession')
      throw new InvalidActiveSessionError('Invalid active focus session');
    throw new InvalidRecordError('Invalid ' + store + ' record');
  }
  return value;
}

class Records<K extends Store> {
  constructor(
    protected readonly database: WorkspaceDatabase,
    protected readonly name: K,
  ) {}

  protected key(action: string, ...ids: string[]): string {
    return JSON.stringify([this.name, action, ...ids]);
  }

  async get(id: string): Promise<WorkspaceRecords[K] | undefined> {
    return this.database.run(
      [this.name],
      'readonly',
      async (tx) => {
        const value = await tx.objectStore(this.name).get(id);
        return value === undefined ? undefined : verify(this.name, value);
      },
      this.key('get', id),
    );
  }

  async list(): Promise<WorkspaceRecords[K][]> {
    return this.database.run(
      [this.name],
      'readonly',
      async (tx) =>
        (await tx.objectStore(this.name).getAll()).map((value) =>
          verify(this.name, value),
        ),
      this.key('list'),
    );
  }
}

class WritableRecords<K extends Store> extends Records<K> {
  async add(value: WorkspaceRecords[K]): Promise<void> {
    const record = verify(this.name, value);
    await this.database.run(
      [this.name],
      'readwrite',
      async (tx) => {
        await tx.objectStore(this.name).add(record);
      },
      this.key('add', record.id),
    );
  }

  async save(value: WorkspaceRecords[K]): Promise<void> {
    const record = verify(this.name, value);
    await this.database.run(
      [this.name],
      'readwrite',
      async (tx) => {
        await tx.objectStore(this.name).put(record);
      },
      this.key('save', record.id),
    );
  }
}

class HistoricalRecords<
  K extends 'tasks' | 'habits',
> extends WritableRecords<K> {
  override async save(value: WorkspaceRecords[K]): Promise<void> {
    const record = verify(this.name, value);
    await this.database.run(
      [this.name],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore(this.name);
        const existing = await store.get(record.id);
        if (existing && verify(this.name, existing).deletedAt !== null) {
          throw new DOMException('The record is deleted', 'ConstraintError');
        }
        await store.put(record);
      },
      this.key('save', record.id),
    );
  }

  override async list({ includeDeleted = false } = {}): Promise<
    WorkspaceRecords[K][]
  > {
    const records = await super.list();
    return includeDeleted
      ? records
      : records.filter((record) => record.deletedAt === null);
  }

  protected markDeleted(
    id: string,
    tombstone: (record: WorkspaceRecords[K]) => WorkspaceRecords[K],
  ): Promise<boolean> {
    return this.database.run(
      [this.name],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore(this.name);
        const record = await store.get(id);
        if (record === undefined) return false;
        const historical = verify(this.name, record);
        if (historical.deletedAt !== null) return false;
        await store.put(verify(this.name, tombstone(historical)));
        return true;
      },
      this.key('softDelete', id),
    );
  }
}

class TaskRecords extends HistoricalRecords<'tasks'> {
  update(
    id: string,
    change: (current: Task) => Task | undefined,
    action: 'edit' | 'complete' | 'reopen' | 'undo',
  ): Promise<Task | undefined> {
    return this.database.run(
      ['tasks'],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore('tasks');
        const value = await store.get(id);
        if (value === undefined) return undefined;
        const current = verify('tasks', value);
        if (current.deletedAt !== null) return undefined;
        const next = change(current);
        if (!next || next.id !== id || next.deletedAt !== null)
          return undefined;
        if (next === current) return current;
        await store.put(verify('tasks', next));
        return next;
      },
      this.key(action, id),
    );
  }

  softDelete(id: string, deletedAt: IsoInstant): Promise<boolean> {
    return this.markDeleted(id, (record: Task) => ({
      ...record,
      deletedAt,
      updatedAt: deletedAt,
    }));
  }
}

class HabitRecords extends HistoricalRecords<'habits'> {
  readHistory() {
    return this.database.run(
      ['habits', 'schedules', 'completions'],
      'readonly',
      async (tx) => {
        const [habits, schedules, completions] = await Promise.all([
          tx.objectStore('habits').getAll(),
          tx.objectStore('schedules').getAll(),
          tx.objectStore('completions').getAll(),
        ]);
        const history = {
          habits: habits.map((row) => verify('habits', row)),
          schedules: schedules.map((row) => verify('schedules', row)),
          completions: completions.map((row) => verify('completions', row)),
        };
        if (!validScheduleHistory(history.habits, history.schedules))
          throw new InvalidRecordError('Invalid habit schedule history');
        return history;
      },
      this.key('readHistory'),
    );
  }

  async createWithSchedule(
    habit: Habit,
    schedule: HabitSchedule,
  ): Promise<void> {
    verify('habits', habit);
    verify('schedules', schedule);
    if (
      schedule.habitId !== habit.id ||
      schedule.effectiveFrom !== habit.startDate ||
      schedule.effectiveTo !== null ||
      habit.deletedAt !== null ||
      habit.status !== 'active'
    )
      throw new DOMException(
        'Invalid initial habit schedule',
        'ConstraintError',
      );
    await this.database.run(
      ['habits', 'schedules'],
      'readwrite',
      async (tx) => {
        await tx.objectStore('habits').add(habit);
        await tx.objectStore('schedules').add(schedule);
      },
      this.key('createWithSchedule', habit.id),
    );
  }

  async editWithSchedule(
    original: Habit,
    next: Pick<Habit, 'name' | 'description' | 'startDate'>,
    weekdays: HabitSchedule['weekdays'],
    scheduleId: string,
    today: LocalDate,
    now: IsoInstant,
  ): Promise<void> {
    await this.database.run(
      ['habits', 'schedules'],
      'readwrite',
      async (tx) => {
        const habits = tx.objectStore('habits');
        const value = await habits.get(original.id);
        const current = requireLiveHabit(value);
        if (
          current.updatedAt !== original.updatedAt ||
          (current.startDate <= today && next.startDate !== current.startDate)
        )
          throw new DOMException(
            'Habit details changed while editing',
            'ConstraintError',
          );

        const schedules = tx.objectStore('schedules');
        const history = (
          await schedules.index('byHabit').getAll(current.id)
        ).map((row) => verify('schedules', row));
        if (!nonOverlappingSchedules(history))
          throw new InvalidRecordError('Invalid habit schedule history');
        const open = history.find((row) => row.effectiveTo === null);
        if (
          next.startDate !== current.startDate &&
          history.some((row) => row.effectiveFrom <= today)
        )
          throw new DOMException(
            'Cannot change a start date with schedule history',
            'ConstraintError',
          );
        if (
          !open ||
          next.startDate !== current.startDate ||
          weekdays.length !== open.weekdays.length ||
          weekdays.some((day) => !open.weekdays.includes(day))
        ) {
          const effectiveFrom = next.startDate > today ? next.startDate : today;
          const replaced = history.filter((row) => row.effectiveFrom >= today);
          const reusable =
            replaced.find((row) => row.effectiveFrom === effectiveFrom) ??
            replaced.find((row) => row.id === open?.id);
          const previous = scheduleOn(history, today);
          const schedule = verify('schedules', {
            id: reusable?.id ?? scheduleId,
            habitId: current.id,
            weekdays,
            effectiveFrom,
            effectiveTo: null,
            createdAt: now,
          });
          // Keep the historical prefix, including the part of an older version
          // before today. Same-day and pending versions can be superseded.
          if (previous && previous.effectiveFrom < today)
            await schedules.put({ ...previous, effectiveTo: today });
          for (const row of replaced)
            if (row.id !== reusable?.id) await schedules.delete(row.id);
          if (reusable) await schedules.put(schedule);
          else await schedules.add(schedule);
        }
        await habits.put(
          verify('habits', { ...current, ...next, updatedAt: now }),
        );
      },
      this.key('editWithSchedule', original.id),
    );
  }

  async setArchived(
    id: string,
    archived: boolean,
    today: LocalDate,
    now: IsoInstant,
  ): Promise<void> {
    await this.database.run(
      ['habits'],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore('habits');
        const habit = requireLiveHabit(await store.get(id));
        if ((habit.status === 'archived') === archived) return;
        const last = habit.archivePeriods.at(-1);
        if (last && today < (last.until ?? last.from))
          throw new DOMException(
            'Archive change precedes previous history',
            'ConstraintError',
          );
        const archivePeriods = [...habit.archivePeriods];
        if (archived) {
          archivePeriods.push({ from: today, until: null });
        } else {
          if (!last) throw new InvalidRecordError('Missing archive period');
          archivePeriods[archivePeriods.length - 1] = {
            from: last.from,
            until: today,
          };
        }
        await store.put(
          verify('habits', {
            ...habit,
            archivePeriods,
            archivedAt: archived ? now : null,
            status: archived ? 'archived' : 'active',
            updatedAt: now,
          }),
        );
      },
      this.key(archived ? 'archive' : 'restore', id),
    );
  }

  async softDelete(
    id: string,
    deletedAt: IsoInstant,
    deletedLocalDate: LocalDate,
  ): Promise<boolean> {
    if (!isLocalDate(deletedLocalDate))
      throw new TypeError('Invalid effective habit deletion date');
    return this.markDeleted(id, (record: Habit) => ({
      ...record,
      deletedAt,
      deletedLocalDate,
      updatedAt: deletedAt,
    }));
  }
}

function requireLiveHabit(value: unknown): Habit {
  const habit = value === undefined ? undefined : verify('habits', value);
  if (!habit || habit.deletedAt !== null) {
    throw new DOMException(
      'Schedule requires a habit that has not been deleted',
      'ConstraintError',
    );
  }
  return habit;
}

class ScheduleRecords extends Records<'schedules'> {
  async add(value: HabitSchedule): Promise<void> {
    const next = verify('schedules', value);
    await this.database.run(
      ['habits', 'schedules'],
      'readwrite',
      async (tx) => {
        requireLiveHabit(await tx.objectStore('habits').get(next.habitId));
        const store = tx.objectStore('schedules');
        const history = (await store.index('byHabit').getAll(next.habitId)).map(
          (row) => verify('schedules', row),
        );
        if (!nonOverlappingSchedules([...history, next])) {
          throw new DOMException(
            'Schedule overlaps existing history',
            'ConstraintError',
          );
        }
        await store.add(next);
      },
      this.key('add', next.id),
    );
  }

  async replace(value: HabitSchedule): Promise<void> {
    const next = verify('schedules', value);
    await this.database.run(
      ['habits', 'schedules'],
      'readwrite',
      async (tx) => {
        requireLiveHabit(await tx.objectStore('habits').get(next.habitId));
        const store = tx.objectStore('schedules');
        const history = (await store.index('byHabit').getAll(next.habitId)).map(
          (row) => verify('schedules', row),
        );
        const current = history.find((row) => row.effectiveTo === null);
        if (
          !current ||
          next.effectiveTo !== null ||
          next.effectiveFrom <= current.effectiveFrom
        ) {
          throw new DOMException(
            'Replacement requires a later start date and an open schedule',
            'ConstraintError',
          );
        }
        const closed = { ...current, effectiveTo: next.effectiveFrom };
        if (
          !nonOverlappingSchedules([
            ...history.filter((row) => row.id !== current.id),
            closed,
            next,
          ])
        ) {
          throw new DOMException(
            'Schedule overlaps existing history',
            'ConstraintError',
          );
        }
        await store.put(closed);
        await store.add(next);
      },
      this.key('replace', next.id),
    );
  }
}

class DeletableRecords<
  K extends 'completions' | 'sessions' | 'activeSession',
> extends WritableRecords<K> {
  async delete(id: string): Promise<void> {
    await this.database.run(
      [this.name],
      'readwrite',
      (tx) => tx.objectStore(this.name).delete(id),
      this.key('delete', id),
    );
  }
}

class SessionRecords extends DeletableRecords<'sessions'> {
  async saveIfAbsent(value: FocusSession): Promise<boolean> {
    const record = verify('sessions', value);
    return this.database.run(
      ['sessions'],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore('sessions');
        if ((await store.getKey(record.id)) !== undefined) return false;
        await store.add(record);
        return true;
      },
      this.key('saveIfAbsent', record.id),
    );
  }
}

class CompletionRecords extends DeletableRecords<'completions'> {
  setOccurrence(
    habitId: string,
    date: LocalDate,
    change:
      | { complete: true; id: string; now: IsoInstant }
      | { complete: false; id: string },
  ): Promise<void> {
    return this.database.run(
      ['habits', 'schedules', 'completions'],
      'readwrite',
      async (tx) => {
        const habit = requireLiveHabit(
          await tx.objectStore('habits').get(habitId),
        );
        const schedules = (
          await tx.objectStore('schedules').index('byHabit').getAll(habitId)
        ).map((row) => verify('schedules', row));
        const scheduled = scheduleOn(schedules, date)?.weekdays.includes(
          weekdayOf(date),
        );
        if (
          habit.status !== 'active' ||
          habitActivityOn(habit, date) !== 'active' ||
          !scheduled
        )
          throw new DOMException(
            'Habit is not scheduled on that date',
            'ConstraintError',
          );
        const store = tx.objectStore('completions');
        const value = await store.index('byOccurrence').get([habitId, date]);
        const current =
          value === undefined ? undefined : verify('completions', value);
        if (change.complete && !current) {
          const completion: HabitCompletion = {
            id: change.id,
            habitId,
            habitNameSnapshot: habit.name,
            scheduledDate: date,
            completedAt: change.now,
          };
          await store.add(verify('completions', completion));
        } else if (!change.complete && current?.id === change.id) {
          await store.delete(current.id);
        } else if (!change.complete && current) {
          throw new DOMException(
            'Completion changed before undo',
            'ConstraintError',
          );
        }
      },
      this.key(change.complete ? 'complete' : 'undo', habitId, date),
    );
  }

  async getOccurrence(
    habitId: string,
    date: LocalDate,
  ): Promise<WorkspaceRecords['completions'] | undefined> {
    return this.database.run(
      ['completions'],
      'readonly',
      async (tx) => {
        const value = await tx
          .objectStore('completions')
          .index('byOccurrence')
          .get([habitId, date]);
        return value === undefined ? undefined : verify('completions', value);
      },
      this.key('getOccurrence', habitId, date),
    );
  }
}

export function sameFocusRevision(
  left: ActiveSession | undefined,
  right: ActiveSession | undefined,
): boolean {
  if (!left || !right) return left === right;
  if (left.sessionId !== right.sessionId) return false;
  if (left.timing || right.timing)
    return left.timing?.revision === right.timing?.revision;
  return (
    left.startedAt === right.startedAt &&
    left.resumedAt === right.resumedAt &&
    left.status === right.status &&
    left.type === right.type &&
    left.accumulatedActiveMs === right.accumulatedActiveMs &&
    left.plannedDurationMs === right.plannedDurationMs &&
    left.taskId === right.taskId &&
    left.taskTitleSnapshot === right.taskTitleSnapshot
  );
}

export class UnavailableFocusTaskError extends Error {}

interface FocusSnapshot {
  active: ActiveSession | undefined;
  cycle: PomodoroCycle | undefined;
  settings: WorkspaceRecords['settings'] | undefined;
}

function sameCycle(
  left: PomodoroCycle | undefined,
  right: PomodoroCycle | undefined,
): boolean {
  return (
    left?.revision === right?.revision &&
    left?.pendingBreak === right?.pendingBreak &&
    left?.completedFocusSessions === right?.completedFocusSessions
  );
}

export class WorkspaceRepository {
  readonly tasks;
  readonly habits;
  readonly schedules;
  readonly completions;
  readonly sessions;
  readonly activeSession;
  readonly cycle;
  readonly settings;

  focusSnapshot() {
    return this.database.run(
      ['activeSession', 'cycle', 'settings'],
      'readonly',
      async (tx) => {
        const [active, cycle, settings] = await Promise.all([
          tx.objectStore('activeSession').get('active'),
          tx.objectStore('cycle').get('cycle'),
          tx.objectStore('settings').get('settings'),
        ]);
        return {
          active:
            active === undefined ? undefined : verify('activeSession', active),
          cycle: cycle === undefined ? undefined : verify('cycle', cycle),
          settings:
            settings === undefined
              ? undefined
              : recoverLegacySettings(settings),
        };
      },
      'focus:read',
    );
  }

  updateFocus(
    expected: Pick<FocusSnapshot, 'active' | 'cycle'>,
    transition: (
      snapshot: FocusSnapshot,
      task?: Pick<ActiveSession, 'taskId' | 'taskTitleSnapshot'>,
    ) =>
      | {
          active: ActiveSession | null;
          completion?: FocusSession;
          cycle?: PomodoroCycle;
        }
      | undefined,
    action: string,
    startTaskId?: string,
  ) {
    return this.database.run(
      ['activeSession', 'sessions', 'cycle', 'settings', 'tasks'],
      'readwrite',
      async (tx) => {
        const activeStore = tx.objectStore('activeSession');
        const cycleStore = tx.objectStore('cycle');
        const stored = await activeStore.get('active');
        const storedCycle = await cycleStore.get('cycle');
        const active =
          stored === undefined ? undefined : verify('activeSession', stored);
        const cycle =
          storedCycle === undefined ? undefined : verify('cycle', storedCycle);
        const storedSettings = await tx.objectStore('settings').get('settings');
        const settings =
          storedSettings === undefined
            ? undefined
            : recoverLegacySettings(storedSettings);
        const snapshot = { active, cycle, settings };
        if (
          !sameFocusRevision(expected.active, active) ||
          !sameCycle(expected.cycle, cycle)
        )
          return { ...snapshot, result: 'conflict' as const };
        const tasks = tx.objectStore('tasks');
        let association:
          Pick<ActiveSession, 'taskId' | 'taskTitleSnapshot'> | undefined;
        if (startTaskId && !active && !cycle?.pendingBreak) {
          const row = await tasks.get(startTaskId);
          const task = row === undefined ? undefined : verify('tasks', row);
          if (!task || task.deletedAt)
            throw new UnavailableFocusTaskError(
              'Task is no longer available for focus',
            );
          association = { taskId: task.id, taskTitleSnapshot: task.title };
        }
        const next = transition(snapshot, association);
        if (!next) return { ...snapshot, result: 'unchanged' as const };
        if (
          storedSettings !== undefined &&
          !recordValidators.settings(storedSettings) &&
          settings
        )
          await tx.objectStore('settings').put(verify('settings', settings));

        if (next.completion) {
          const row = active?.taskId
            ? await tasks.get(active.taskId)
            : undefined;
          const completion = verify('sessions', {
            ...next.completion,
            taskTitleSnapshot: recordValidators.tasks(row)
              ? row.title
              : next.completion.taskTitleSnapshot,
          });
          if (
            active?.sessionId !== completion.id ||
            next.active?.sessionId === completion.id
          )
            throw new InvalidRecordError(
              'Focus completion does not match active session',
            );
          const sessions = tx.objectStore('sessions');
          if ((await sessions.getKey(completion.id)) !== undefined) {
            await activeStore.delete('active');
            return {
              ...snapshot,
              active: undefined,
              result: 'committed' as const,
            };
          }
          await sessions.add(completion);
        }
        if (next.cycle) await cycleStore.put(verify('cycle', next.cycle));
        if (next.active)
          await activeStore.put(verify('activeSession', next.active));
        else await activeStore.delete('active');
        return {
          active: next.active ?? undefined,
          cycle: next.cycle ?? cycle,
          settings,
          historyChanged: next.completion !== undefined,
          result: 'committed' as const,
        };
      },
      'focus:' + action,
    );
  }

  updateFocusSettings(
    change: (
      current: WorkspaceRecords['settings'] | undefined,
    ) => WorkspaceRecords['settings'],
  ) {
    return this.database.run(
      ['settings'],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore('settings');
        const existing = await store.get('settings');
        const next = verify(
          'settings',
          change(
            existing === undefined
              ? undefined
              : recoverLegacySettings(existing),
          ),
        );
        await store.put(next);
        return next;
      },
      'focus:settings',
    );
  }

  constructor(private readonly database: WorkspaceDatabase) {
    this.tasks = new TaskRecords(database, 'tasks');
    this.habits = new HabitRecords(database, 'habits');
    this.schedules = new ScheduleRecords(database, 'schedules');
    this.completions = new CompletionRecords(database, 'completions');
    this.sessions = new SessionRecords(database, 'sessions');
    this.activeSession = new DeletableRecords(database, 'activeSession');
    this.cycle = new WritableRecords(database, 'cycle');
    this.settings = new WritableRecords(database, 'settings');
  }

  snapshot(
    preferences: Preferences,
    exportedAt: IsoInstant,
  ): Promise<BackupV2> {
    return this.database.run(
      ['tasks', 'habits', 'schedules', 'completions', 'sessions', 'settings'],
      'readonly',
      async (tx) => {
        const [tasks, habits, schedules, completions, sessions, settings] =
          await Promise.all([
            tx.objectStore('tasks').getAll(),
            tx.objectStore('habits').getAll(),
            tx.objectStore('schedules').getAll(),
            tx.objectStore('completions').getAll(),
            tx.objectStore('sessions').getAll(),
            tx.objectStore('settings').get('settings'),
          ]);
        return {
          format: 'doop-backup',
          version: 2,
          exportedAt,
          tasks: tasks.map((value) => verify('tasks', value)),
          habits: habits.map((value) => verify('habits', value)),
          schedules: schedules.map((value) => verify('schedules', value)),
          completions: completions.map((value) => verify('completions', value)),
          sessions: sessions.map((value) => verify('sessions', value)),
          settings: {
            preferences,
            workspace:
              settings === undefined ? null : verify('settings', settings),
          },
        };
      },
      'backup:snapshot',
    );
  }
}
