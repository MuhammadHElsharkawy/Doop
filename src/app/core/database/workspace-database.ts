import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';
import { validScheduleHistory } from '../domain/habit-history';
import type { WorkspaceRecords } from '../domain/workspace-records';
import {
  InvalidRecordError,
  recordValidators,
  upgradeLegacyHabit,
} from '../persistence/record-validation';

export type Store = keyof WorkspaceRecords;
type StoreIndexes = {
  completions: { byOccurrence: [string, string] };
  schedules: { byHabit: string };
};
type WorkspaceSchema = {
  [K in Store]: {
    key: string;
    value: WorkspaceRecords[K];
  } & (K extends keyof StoreIndexes ? { indexes: StoreIndexes[K] } : object);
};

const stores = [
  'tasks',
  'habits',
  'schedules',
  'completions',
  'sessions',
  'activeSession',
  'cycle',
  'settings',
] as const satisfies readonly Store[];

export const workspaceVersion = 3;
type ConnectionStatus =
  'loading' | 'ready' | 'blocked' | 'connection-error' | 'migration-error';
type OperationStatus =
  | 'invalid-record'
  | 'invalid-record-write'
  | 'read-error'
  | 'write-error'
  | 'quota-error';
export type StorageStatus = ConnectionStatus | OperationStatus;

interface OperationFailure {
  status: OperationStatus;
  retryRead?: () => Promise<unknown>;
}

function errorName(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'name' in error
    ? error.name
    : undefined;
}

async function migrate(
  database: IDBPDatabase<WorkspaceSchema>,
  oldVersion: number,
  tx: IDBPTransaction<WorkspaceSchema, Store[], 'versionchange'>,
): Promise<void> {
  if (oldVersion < 1) {
    for (const name of stores)
      database.createObjectStore(name, { keyPath: 'id' });
  }
  if (oldVersion < 2) {
    tx.objectStore('completions').createIndex(
      'byOccurrence',
      ['habitId', 'scheduledDate'],
      { unique: true },
    );
  }
  if (oldVersion < 3) {
    const schedules = tx.objectStore('schedules');
    schedules.createIndex('byHabit', 'habitId');
    if (oldVersion === 0) return;
    const habits = tx.objectStore('habits');
    const [habitRows, scheduleRows] = await Promise.all([
      habits.getAll(),
      schedules.getAll(),
    ]);
    const upgraded = habitRows.map(upgradeLegacyHabit);
    if (
      !scheduleRows.every(recordValidators.schedules) ||
      !validScheduleHistory(upgraded, scheduleRows)
    ) {
      throw new InvalidRecordError('Invalid legacy schedule history');
    }
    await Promise.all(upgraded.map((habit) => habits.put(habit)));
  }
}

export class WorkspaceDatabase {
  private opening?: Promise<IDBPDatabase<WorkspaceSchema>>;
  private connection?: IDBPDatabase<WorkspaceSchema>;
  private generation = 0;
  private phase: ConnectionStatus = 'loading';
  private readonly failures = new Map<unknown, OperationFailure>();

  constructor(
    private readonly name = 'doop-workspace',
    private readonly onStatus: (status: StorageStatus) => void = () =>
      undefined,
  ) {}

  open(): Promise<IDBPDatabase<WorkspaceSchema>> {
    return (this.opening ??= this.connect());
  }

  close(): void {
    this.generation++;
    this.connection?.close();
    this.connection = undefined;
    this.opening = undefined;
  }

  async run<Names extends Store, Mode extends 'readonly' | 'readwrite', Result>(
    names: readonly Names[],
    mode: Mode,
    operation: (
      tx: IDBPTransaction<WorkspaceSchema, Names[], Mode>,
    ) => Promise<Result>,
    operationKey?: string,
  ): Promise<Result> {
    const database = await this.open();
    const key = operationKey ?? operation;
    const previousFailure = this.failures.get(key);
    try {
      const tx = database.transaction([...names], mode);
      void tx.done.catch(() => undefined);
      let result: Result;
      try {
        result = await operation(tx);
        await tx.done;
      } catch (error) {
        try {
          tx.abort();
        } catch {
          // The transaction may already be aborted or completed.
        }
        await tx.done.catch(() => undefined);
        throw error;
      }
      if (previousFailure && this.failures.get(key) === previousFailure) {
        this.failures.delete(key);
        this.report();
      }
      return result;
    } catch (error) {
      const name = errorName(error);
      if (name !== 'ConstraintError') {
        const status =
          error instanceof InvalidRecordError
            ? mode === 'readonly'
              ? 'invalid-record'
              : 'invalid-record-write'
            : name === 'QuotaExceededError'
              ? 'quota-error'
              : mode === 'readwrite'
                ? 'write-error'
                : 'read-error';
        this.failures.set(key, {
          status,
          retryRead:
            mode === 'readonly'
              ? () => this.run(names, mode, operation, operationKey)
              : undefined,
        });
        this.report();
      }
      throw error;
    }
  }

  private report(phase = this.phase): void {
    this.phase = phase;
    const failure = this.failures.values().next().value;
    this.onStatus(phase === 'ready' && failure ? failure.status : phase);
  }

  private async connect(): Promise<IDBPDatabase<WorkspaceSchema>> {
    const generation = this.generation;
    let migrationFailure: unknown;
    this.report('loading');
    try {
      const database = await openDB<WorkspaceSchema>(
        this.name,
        workspaceVersion,
        {
          upgrade(database, oldVersion, _newVersion, tx) {
            void tx.done.catch(() => undefined);
            void migrate(database, oldVersion, tx).catch((error: unknown) => {
              migrationFailure = error;
              try {
                tx.abort();
              } catch {
                // An IndexedDB request can already have aborted the upgrade.
              }
            });
          },
          blocked: () => {
            if (generation === this.generation) this.report('blocked');
          },
          blocking: () => {
            if (generation !== this.generation) return;
            this.close();
            this.report('connection-error');
          },
          terminated: () => {
            if (generation !== this.generation) return;
            this.close();
            this.report('connection-error');
          },
        },
      );
      if (generation !== this.generation) {
        database.close();
        throw new DOMException('Database connection was closed', 'AbortError');
      }
      this.connection = database;
      this.report('ready');
      return database;
    } catch (error) {
      if (generation === this.generation) {
        this.report(
          migrationFailure instanceof InvalidRecordError
            ? 'migration-error'
            : 'connection-error',
        );
      }
      throw migrationFailure ?? error;
    }
  }

  async retry(): Promise<void> {
    if (this.connection) {
      await this.failures.values().next().value?.retryRead?.();
      return;
    }
    const pending = this.opening;
    if (pending) {
      try {
        await pending;
        return;
      } catch {
        if (this.opening === pending) this.opening = undefined;
      }
    }
    await this.open();
  }
}
