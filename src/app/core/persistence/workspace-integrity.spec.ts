import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { isIsoInstant, isLocalDate, toIsoInstant } from '../clock/local-date';
import {
  WorkspaceDatabase,
  type StorageStatus,
} from '../database/workspace-database';
import { habitActivityOn } from '../domain/habit-history';
import { createRecordId } from '../domain/record-id';
import type {
  FocusSession,
  Habit,
  HabitSchedule,
} from '../domain/workspace-records';
import { decodeBackup, encodeBackup } from './backup';
import { WorkspaceRepository } from './workspace.repository';

function date(value: string) {
  if (!isLocalDate(value)) throw new Error('Invalid fixture date');
  return value;
}
function instant(value: string) {
  if (!isIsoInstant(value)) throw new Error('Invalid fixture instant');
  return value;
}
const now = instant('2024-06-01T00:30:00.000Z');
const start = date('2024-05-01');
const habit: Habit = {
  id: 'habit',
  name: 'Read',
  description: null,
  startDate: start,
  status: 'active',
  createdAt: instant('2024-05-01T12:00:00.000Z'),
  updatedAt: now,
  archivedAt: null,
  archivePeriods: [],
  deletedAt: null,
  deletedLocalDate: null,
};
const schedule: HabitSchedule = {
  id: 'first',
  habitId: habit.id,
  weekdays: [1, 3],
  effectiveFrom: start,
  effectiveTo: null,
  createdAt: now,
};
const prefs = {
  appearance: 'system',
  theme: 'emerald',
  language: 'en',
} as const;
let name: string;
let db: WorkspaceDatabase;
let repo: WorkspaceRepository;
let status: StorageStatus[];

beforeEach(() => {
  name = 'm2-correction-' + createRecordId();
  status = [];
  db = new WorkspaceDatabase(name, (change) => status.push(change));
  repo = new WorkspaceRepository(db);
});
afterEach(() => db.close());

async function legacyDatabase() {
  return openDB(name, 2, {
    upgrade(database) {
      for (const store of [
        'tasks',
        'habits',
        'schedules',
        'completions',
        'sessions',
        'activeSession',
        'cycle',
        'settings',
      ]) {
        database.createObjectStore(store, { keyPath: 'id' });
      }
    },
  });
}

function legacyHabit(record: Habit) {
  const legacy: Partial<Habit> = { ...record };
  delete legacy.deletedLocalDate;
  return legacy;
}

it('rejects orphan, overlapping, and deleted-habit schedule writes and preserves adjacent history', async () => {
  await expect(repo.schedules.add(schedule)).rejects.toMatchObject({
    name: 'ConstraintError',
  });
  await repo.habits.add(habit);
  const boundary = date('2024-05-10');
  await repo.schedules.add({ ...schedule, effectiveTo: boundary });
  const second = { ...schedule, id: 'second', effectiveFrom: boundary };
  await repo.schedules.add(second);
  await expect(
    repo.schedules.add({
      ...schedule,
      id: 'overlap',
      effectiveFrom: date('2024-05-09'),
      effectiveTo: date('2024-05-11'),
    }),
  ).rejects.toMatchObject({ name: 'ConstraintError' });
  await repo.habits.softDelete(habit.id, now, date('2024-05-31'));
  await expect(
    repo.schedules.add({
      ...schedule,
      id: 'deleted-parent',
      effectiveFrom: date('2024-06-01'),
    }),
  ).rejects.toMatchObject({ name: 'ConstraintError' });
  await expect(
    repo.schedules.replace({
      ...schedule,
      id: 'replacement',
      effectiveFrom: date('2024-06-01'),
    }),
  ).rejects.toMatchObject({ name: 'ConstraintError' });
  const snapshot = await repo.snapshot(prefs, now);
  expect(decodeBackup(encodeBackup(snapshot))).toEqual({
    ok: true,
    backup: snapshot,
  });
  expect(snapshot.schedules).toHaveLength(2);
  expect(
    decodeBackup(JSON.stringify({ ...snapshot, habits: [] })),
  ).toMatchObject({ ok: false, reason: 'invalid-data' });
  expect(
    decodeBackup(
      JSON.stringify({
        ...snapshot,
        schedules: [...snapshot.schedules, { ...second, id: 'overlap' }],
      }),
    ),
  ).toMatchObject({ ok: false, reason: 'invalid-data' });
});

it('atomically replaces a schedule and rolls back closing the old interval if insertion fails', async () => {
  await repo.habits.add(habit);
  await repo.schedules.add(schedule);
  const next = {
    ...schedule,
    effectiveFrom: date('2024-05-20'),
    weekdays: [2, 4] as HabitSchedule['weekdays'],
  };
  await expect(repo.schedules.replace(next)).rejects.toMatchObject({
    name: 'ConstraintError',
  });
  expect(await repo.schedules.get(schedule.id)).toEqual(schedule);
  await repo.schedules.replace({ ...next, id: 'next' });
  expect(await repo.schedules.get(schedule.id)).toEqual({
    ...schedule,
    effectiveTo: next.effectiveFrom,
  });
  expect(await repo.schedules.get('next')).toEqual({ ...next, id: 'next' });
});

it('retains archive and restore history and a captured deletion day after a time-zone change', async () => {
  const from = date('2024-05-13');
  const until = date('2024-05-16');
  await repo.habits.add({
    ...habit,
    archivedAt: instant('2024-05-13T07:00:00.000Z'),
    status: 'archived',
    archivePeriods: [{ from, until: null }],
  });
  await repo.habits.save({ ...habit, archivePeriods: [{ from, until }] });
  const calendarDay = (timeZone: string) =>
    new Intl.DateTimeFormat('sv-SE', { timeZone, dateStyle: 'short' }).format(
      new Date(now),
    );
  const original = date(calendarDay('America/Los_Angeles'));
  const afterTravel = date(calendarDay('Africa/Cairo'));
  expect([original, afterTravel]).toEqual(['2024-05-31', '2024-06-01']);
  await repo.habits.softDelete(habit.id, now, original);
  db.close();

  const stored = await repo.habits.get(habit.id);
  if (!stored) throw new Error('Expected tombstone');
  expect(stored.deletedLocalDate).toBe(original);
  expect(stored.deletedAt).toBe(now);
  expect(habitActivityOn(stored, from)).toBe('inactive');
  expect(habitActivityOn(stored, until)).toBe('active');
  expect(habitActivityOn(stored, date('2024-05-30'))).toBe('active');
  expect(habitActivityOn(stored, original)).toBe('inactive');
  expect(habitActivityOn(stored, afterTravel)).toBe('inactive');
});

it('upgrades v2 databases and v1 backups without guessing legacy deletion dates', async () => {
  const legacy = await legacyDatabase();
  const old = legacyHabit({
    ...habit,
    deletedAt: now,
    deletedLocalDate: date('2024-05-31'),
  });
  await legacy.add('habits', old);
  await legacy.add('habits', legacyHabit({ ...habit, id: 'live' }));
  await legacy.add('schedules', schedule);
  legacy.close();

  expect((await db.open()).version).toBe(3);
  expect(await repo.habits.get('live')).toMatchObject({
    deletedLocalDate: null,
  });
  const tombstone = await repo.habits.get(habit.id);
  if (!tombstone) throw new Error('Expected migrated habit');
  expect(tombstone).toEqual({ ...old, deletedLocalDate: 'unknown' });
  expect(habitActivityOn(tombstone, date('2024-05-31'))).toBe('unknown');
  expect(await repo.schedules.list()).toEqual([schedule]);
  const snapshot = await repo.snapshot(prefs, now);
  const restored = decodeBackup(
    JSON.stringify({
      ...snapshot,
      version: 1,
      habits: snapshot.habits.map(legacyHabit),
    }),
  );
  expect(restored).toEqual({ ok: true, backup: snapshot });
});

it('rolls back a failed migration and preserves the legacy schedule and habit records', async () => {
  const legacy = await legacyDatabase();
  const old = legacyHabit(habit);
  const overlap = {
    ...schedule,
    id: 'overlap',
    effectiveFrom: date('2024-05-02'),
  };
  await legacy.add('habits', old);
  await legacy.add('schedules', schedule);
  await legacy.add('schedules', overlap);
  legacy.close();
  await expect(db.open()).rejects.toThrow('Invalid legacy schedule history');
  expect(status.at(-1)).toBe('migration-error');
  const preserved = await openDB(name, 2);
  try {
    expect(preserved.version).toBe(2);
    expect(await preserved.getAll('habits')).toEqual([old]);
    expect(await preserved.count('schedules')).toBe(2);
    expect(
      Array.from(preserved.transaction('schedules').store?.indexNames ?? []),
    ).toEqual([]);
  } finally {
    preserved.close();
  }
});

it.each(['QuotaExceededError', 'UnknownError'])(
  'keeps %s visible until the matching write commits',
  async (name) => {
    const tracked = () =>
      db.run(
        ['habits'],
        'readwrite',
        async (tx) => {
          await tx.objectStore('habits').add(habit);
          throw new DOMException('Write failed', name);
        },
        'habit:write',
      );
    await expect(tracked()).rejects.toMatchObject({ name });
    const failure =
      name === 'QuotaExceededError' ? 'quota-error' : 'write-error';
    expect(status.at(-1)).toBe(failure);
    expect(await repo.habits.get(habit.id)).toBeUndefined();
    await db.retry();
    expect(status.at(-1)).toBe(failure);
    await repo.habits.add({ ...habit, id: 'other' });
    expect(status.at(-1)).toBe(failure);
    await db.run(
      ['habits'],
      'readwrite',
      (tx) => tx.objectStore('habits').add(habit),
      'habit:write',
    );
    expect(status.at(-1)).toBe('ready');
  },
);

const timer: FocusSession = {
  id: 'timer',
  taskId: null,
  taskTitleSnapshot: null,
  type: 'timer',
  status: 'completed',
  plannedDurationSeconds: 1800,
  actualDurationSeconds: 1799.6,
  startedAt: instant('2024-05-31T20:35:00.000Z'),
  endedAt: instant('2024-05-31T21:10:00.000Z'),
  completionLocalDate: date('2024-06-01'),
  completionTimezoneOffsetMinutes: -180,
};

it('validates elapsed time consistently on repository writes and backup decode', async () => {
  const snapshot = await repo.snapshot(prefs, now);
  const stopwatch = {
    ...timer,
    id: 'watch',
    type: 'stopwatch',
    plannedDurationSeconds: null,
    actualDurationSeconds: 1,
  } as const;
  const invalid: FocusSession[] = [
    { ...timer, actualDurationSeconds: 0, startedAt: timer.endedAt },
    { ...timer, actualDurationSeconds: 1600 },
    { ...timer, actualDurationSeconds: 1800, status: 'partial' },
    { ...timer, actualDurationSeconds: 2200, plannedDurationSeconds: 2200 },
    { ...stopwatch, actualDurationSeconds: 0.999 },
    { ...stopwatch, status: 'partial' },
  ];
  for (const session of invalid) {
    await expect(repo.sessions.add(session)).rejects.toThrow(
      'Invalid sessions record',
    );
    expect(
      decodeBackup(JSON.stringify({ ...snapshot, sessions: [session] })),
    ).toMatchObject({ ok: false, reason: 'invalid-data' });
  }

  const partial = {
    ...timer,
    id: 'partial',
    actualDurationSeconds: 1200.4,
    status: 'partial',
  } as const;
  const dst = {
    ...timer,
    id: 'dst',
    plannedDurationSeconds: 600,
    actualDurationSeconds: 600,
    startedAt: instant('2024-03-10T07:55:00.000Z'),
    endedAt: instant('2024-03-10T08:05:00.000Z'),
    completionLocalDate: date('2024-03-10'),
    completionTimezoneOffsetMinutes: 300,
  };
  for (const session of [timer, partial, stopwatch, dst]) {
    await repo.sessions.add(session);
    expect(
      decodeBackup(JSON.stringify({ ...snapshot, sessions: [session] })).ok,
    ).toBe(true);
  }
  expect(
    decodeBackup(
      JSON.stringify({
        ...snapshot,
        sessions: [{ ...timer, completionLocalDate: date('2024-05-31') }],
      }),
    ).ok,
  ).toBe(false);
  expect(toIsoInstant(new Date(timer.endedAt))).toBe(timer.endedAt);
});

it('caps multibyte backup input by UTF-8 bytes before parsing', () => {
  expect(decodeBackup('\u00e9'.repeat(5 * 1024 * 1024 + 1))).toEqual({
    ok: false,
    reason: 'too-large',
  });
});
