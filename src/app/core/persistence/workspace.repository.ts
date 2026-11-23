import {
  isLocalDate,
  type IsoInstant,
  type LocalDate,
} from '../clock/local-date';
import type { Store, WorkspaceDatabase } from '../database/workspace-database';
import { nonOverlappingSchedules } from '../domain/habit-history';
import type {
  FocusSession,
  Habit,
  HabitSchedule,
  Task,
  WorkspaceRecords,
} from '../domain/workspace-records';
import type { Preferences } from '../preferences/preferences.service';
import type { BackupV2 } from './backup';
import { InvalidRecordError, recordValidators } from './record-validation';

function verify<K extends Store>(
  store: K,
  value: unknown,
): WorkspaceRecords[K] {
  if (!recordValidators[store](value))
    throw new InvalidRecordError('Invalid ' + store + ' record');
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

function requireLiveHabit(value: unknown): void {
  if (value === undefined || verify('habits', value).deletedAt !== null) {
    throw new DOMException(
      'Schedule requires a habit that has not been deleted',
      'ConstraintError',
    );
  }
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

export class WorkspaceRepository {
  readonly tasks;
  readonly habits;
  readonly schedules;
  readonly completions;
  readonly sessions;
  readonly activeSession;
  readonly cycle;
  readonly settings;

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
