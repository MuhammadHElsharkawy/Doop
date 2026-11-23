import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  isLocalDate,
  toIsoInstant,
  toLocalDate,
} from '../clock/local-date';
import {
  WorkspaceDatabase,
  type StorageStatus,
} from '../database/workspace-database';
import { createRecordId } from '../domain/record-id';
import type { FocusSession, Task } from '../domain/workspace-records';
import { decodeBackup, encodeBackup } from './backup';
import {
  UnavailableFocusTaskError,
  WorkspaceRepository,
} from './workspace.repository';
import { defaultFocusSettings } from '../../features/focus/domain/focus-settings';
import {
  transitionTimer,
  type TimerCommand,
} from '../../features/focus/domain/focus-timer';

const date = new Date(2024, 1, 29, 12);
const day = toLocalDate(date);
const now = toIsoInstant(date);
const preferences = {
  appearance: 'system',
  theme: 'emerald',
  language: 'en',
} as const;
const task: Task = {
  id: 'task',
  title: 'Read',
  priority: 'low',
  dueDate: day,
  expectedSessions: null,
  status: 'pending',
  createdAt: now,
  updatedAt: now,
  completedAt: null,
  deletedAt: null,
};
const completion = {
  id: 'completion',
  habitId: 'habit',
  habitNameSnapshot: 'Read',
  scheduledDate: day,
  completedAt: now,
};
const session: FocusSession = {
  id: 'session',
  type: 'stopwatch',
  taskId: task.id,
  taskTitleSnapshot: task.title,
  plannedDurationSeconds: null,
  actualDurationSeconds: 30,
  startedAt: now,
  endedAt: toIsoInstant(new Date(date.getTime() + 30000)),
  completionLocalDate: day,
  completionTimezoneOffsetMinutes: date.getTimezoneOffset(),
  status: 'completed',
};

describe('workspace repositories', () => {
  let name: string;
  let db: WorkspaceDatabase;
  let repositories: WorkspaceRepository;

  beforeEach(() => {
    name = 'test-' + createRecordId();
    db = new WorkspaceDatabase(name);
    repositories = new WorkspaceRepository(db);
  });

  afterEach(() => db.close());

  it('resolves a live task on start and freezes its latest title on the saved session', async () => {
    const wall = date.getTime();
    const start: TimerCommand = {
      type: 'start-stopwatch',
      sessionId: 'linked',
      taskId: task.id,
    };
    const input = (elapsedMs: number) => ({
      wall: wall + elapsedMs,
      elapsedMs,
      observedCompletion: true,
      revision: 'rev-' + elapsedMs,
      zone: { timeZone: null, offsetMinutes: date.getTimezoneOffset() },
    });
    const initial = await repositories.focusSnapshot();
    const begin = () =>
      repositories.updateFocus(
        initial,
        (snapshot, task) =>
          transitionTimer(snapshot.active, start, input(0), {
            ...snapshot,
            task,
          }),
        start.type,
        start.taskId,
      );
    await expect(begin()).rejects.toBeInstanceOf(UnavailableFocusTaskError);
    expect(await repositories.focusSnapshot()).toEqual(initial);

    await repositories.tasks.add(task);
    expect(await begin()).toMatchObject({
      active: { taskId: task.id, taskTitleSnapshot: task.title },
      result: 'committed',
    });
    await repositories.tasks.update(
      task.id,
      (row) => ({ ...row, title: 'Before save' }),
      'edit',
    );
    const apply = async (type: 'pause' | 'save', elapsedMs: number) => {
      const expected = await repositories.focusSnapshot();
      return repositories.updateFocus(
        expected,
        (snapshot) =>
          transitionTimer(
            snapshot.active,
            { type, sessionId: start.sessionId },
            input(elapsedMs),
            snapshot,
          ),
        type,
      );
    };
    await apply('pause', 2000);
    await apply('save', 3000);
    expect(await repositories.sessions.list()).toMatchObject([
      {
        taskId: task.id,
        taskTitleSnapshot: 'Before save',
        actualDurationSeconds: 2,
      },
    ]);
    await repositories.tasks.update(
      task.id,
      (row) => ({ ...row, title: 'After save' }),
      'edit',
    );
    await repositories.tasks.softDelete(task.id, now);
    await expect(begin()).rejects.toBeInstanceOf(UnavailableFocusTaskError);
    const backup = await repositories.snapshot(preferences, now);
    expect(backup.sessions[0]?.taskTitleSnapshot).toBe('Before save');
    expect(decodeBackup(encodeBackup(backup))).toMatchObject({ ok: true });
  });

  it('rejects invalid settings in backups and repairs legacy stored break limits on the next successful focus write', async () => {
    const snapshot = await repositories.snapshot(preferences, now);
    const bad = {
      ...defaultFocusSettings,
      shortBreakDurationMinutes: Number.MAX_SAFE_INTEGER,
      longBreakDurationMinutes: 120,
      focusSessionsBeforeLongBreak: 12,
      dailyGoal: 9,
    };
    expect(
      decodeBackup(
        JSON.stringify({
          ...snapshot,
          settings: { ...snapshot.settings, workspace: bad },
        }),
      ),
    ).toMatchObject({ ok: false, reason: 'invalid-data' });
    await expect(repositories.settings.save(bad)).rejects.toThrow();
    const raw = await openDB(name);
    await raw.put('settings', bad);
    raw.close();
    const state = await repositories.focusSnapshot();
    expect(state.settings).toMatchObject({
      shortBreakDurationMinutes: 5,
      longBreakDurationMinutes: 120,
      focusSessionsBeforeLongBreak: 12,
      dailyGoal: 9,
    });
    await repositories.updateFocus(
      state,
      () => ({
        active: {
          id: 'active',
          sessionId: 'repair',
          type: 'timer',
          status: 'running',
          startedAt: now,
          resumedAt: now,
          accumulatedActiveMs: 0,
          plannedDurationMs: 1500000,
          taskId: null,
          taskTitleSnapshot: null,
        },
      }),
      'start',
    );
    expect(await repositories.settings.get('settings')).toEqual(state.settings);
  });

  it('creates and edits tasks, persists across reopen, and preserves session history after soft deletion', async () => {
    expect(await repositories.tasks.list()).toEqual([]);
    await repositories.tasks.add(task);
    await repositories.sessions.saveIfAbsent(session);
    await repositories.tasks.save({ ...task, title: 'Edited' });
    db.close();
    expect(await repositories.tasks.get(task.id)).toMatchObject({
      title: 'Edited',
    });
    expect(await repositories.tasks.softDelete(task.id, now)).toBe(true);
    expect(await repositories.tasks.softDelete(task.id, now)).toBe(false);
    await expect(repositories.tasks.save(task)).rejects.toMatchObject({
      name: 'ConstraintError',
    });
    expect(await repositories.tasks.list()).toEqual([]);
    expect(await repositories.tasks.list({ includeDeleted: true })).toEqual([
      { ...task, title: 'Edited', deletedAt: now },
    ]);
    expect(await repositories.sessions.get(session.id)).toEqual(session);
  });

  it('serializes competing session inserts and enforces habit/date uniqueness', async () => {
    const saved = await Promise.all([
      repositories.sessions.saveIfAbsent(session),
      repositories.sessions.saveIfAbsent(session),
    ]);
    expect(saved.sort()).toEqual([false, true]);
    expect(await repositories.sessions.list()).toEqual([session]);
    await repositories.completions.add(completion);
    await expect(
      repositories.completions.add({ ...completion, id: 'duplicate' }),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
    expect(
      await repositories.completions.getOccurrence(completion.habitId, day),
    ).toEqual(completion);
    await repositories.completions.delete(completion.id);
    expect(await repositories.completions.list()).toEqual([]);
  });

  it('applies completion and edits to the latest task in the write transaction', async () => {
    await repositories.tasks.add(task);
    await Promise.all([
      repositories.tasks.update(
        task.id,
        (current) => ({
          ...current,
          status: 'completed',
          completedAt: now,
          updatedAt: now,
        }),
        'complete',
      ),
      repositories.tasks.update(
        task.id,
        (current) => ({ ...current, title: 'New title' }),
        'edit',
      ),
    ]);
    expect(await repositories.tasks.get(task.id)).toMatchObject({
      title: 'New title',
      status: 'completed',
      completedAt: now,
    });
    await repositories.tasks.softDelete(task.id, now);
    await expect(
      repositories.tasks.update(
        task.id,
        (current) => ({ ...current, status: 'pending', completedAt: null }),
        'reopen',
      ),
    ).resolves.toBeUndefined();
    expect(await repositories.tasks.get(task.id)).toMatchObject({
      deletedAt: now,
      status: 'completed',
    });
  });

  it('preserves v1 records and installs the unique index on upgrade', async () => {
    const legacy = await openDB(name, 1, {
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
    await legacy.add('tasks', task);
    await legacy.add('completions', completion);
    legacy.close();
    expect((await db.open()).version).toBe(3);
    expect(await repositories.tasks.get(task.id)).toEqual(task);
    expect(
      await repositories.completions.getOccurrence(completion.habitId, day),
    ).toEqual(completion);
    await expect(
      repositories.completions.add({ ...completion, id: 'duplicate' }),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
  });

  it('rolls back every write in a failed multi-store transaction', async () => {
    await repositories.completions.add(completion);
    await expect(
      db.run(['tasks', 'completions'], 'readwrite', async (tx) => {
        await tx.objectStore('tasks').add(task);
        await tx
          .objectStore('completions')
          .add({ ...completion, id: 'duplicate' });
      }),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
    expect(await repositories.tasks.get(task.id)).toBeUndefined();
    expect(await repositories.completions.list()).toEqual([completion]);
  });

  it('round-trips a backup snapshot and rejects malformed or duplicate data without writes', async () => {
    await repositories.tasks.add(task);
    await repositories.completions.add(completion);
    const snapshot = await repositories.snapshot(preferences, now);
    expect(decodeBackup(encodeBackup(snapshot))).toEqual({
      ok: true,
      backup: snapshot,
    });
    expect(decodeBackup('{')).toEqual({ ok: false, reason: 'invalid-json' });
    expect(decodeBackup(JSON.stringify({ ...snapshot, version: 4 }))).toEqual({
      ok: false,
      reason: 'unsupported-version',
    });
    expect(
      decodeBackup(
        JSON.stringify({
          ...snapshot,
          tasks: [{ ...task, dueDate: '2024-02-30' }],
        }),
      ),
    ).toEqual({ ok: false, reason: 'invalid-data' });
    expect(
      decodeBackup(
        JSON.stringify({
          ...snapshot,
          completions: [completion, { ...completion, id: 'duplicate' }],
        }),
      ),
    ).toEqual({ ok: false, reason: 'invalid-data' });
    expect(await repositories.snapshot(preferences, now)).toEqual(snapshot);
  });

  it('reports corrupted stored records without silently filtering or deleting them', async () => {
    const status: StorageStatus[] = [];
    const observed = new WorkspaceDatabase(name, (change) =>
      status.push(change),
    );
    try {
      await observed.run(['tasks'], 'readwrite', (tx) =>
        tx.objectStore('tasks').put({ ...task, title: '' }),
      );
      await expect(
        new WorkspaceRepository(observed).tasks.list(),
      ).rejects.toThrow('Invalid tasks record');
      expect(status.at(-1)).toBe('invalid-record');
      await expect(observed.retry()).rejects.toThrow('Invalid tasks record');
      expect(status.at(-1)).toBe('invalid-record');
      expect(await (await observed.open()).count('tasks')).toBe(1);
      await observed.run(['tasks'], 'readwrite', (tx) =>
        tx.objectStore('tasks').put(task),
      );
      expect(status.at(-1)).toBe('invalid-record');
      await observed.retry();
      expect(status.at(-1)).toBe('ready');
    } finally {
      observed.close();
    }
  });
});

it('handles local calendar boundaries, impossible dates, and ID uniqueness', () => {
  expect(toLocalDate(new Date(2024, 1, 29, 23, 59))).toBe('2024-02-29');
  expect(addCalendarDays(day, 1)).toBe('2024-03-01');
  expect(isLocalDate('2023-02-29')).toBe(false);
  expect(isLocalDate('2024-02-29T00:00:00.000Z')).toBe(false);
  expect(createRecordId()).not.toBe(createRecordId());
});
