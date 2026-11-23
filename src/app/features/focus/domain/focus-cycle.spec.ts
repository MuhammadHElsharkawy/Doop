import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { WorkspaceDatabase } from '../../../core/database/workspace-database';
import { WorkspaceRepository } from '../../../core/persistence/workspace.repository';
import { createRecordId } from '../../../core/domain/record-id';
import type {
  ActiveSession,
  PomodoroCycle,
} from '../../../core/domain/workspace-records';
import { recordValidators } from '../../../core/persistence/record-validation';
import {
  defaultFocusSettings,
  safeMinutesMs,
  validBreakSetting,
} from './focus-settings';
import {
  elapsedActiveMs,
  recoveryAnchor,
  remainingMs,
  transitionTimer,
  type TimerCommand,
  type TimerContext,
} from './focus-timer';

const start = Date.parse('2026-11-23T23:56:00Z');
const defaultSettings = {
  ...defaultFocusSettings,
  focusDurationMinutes: 5,
  shortBreakDurationMinutes: 2,
  longBreakDurationMinutes: 3,
  focusSessionsBeforeLongBreak: 2,
};

function step(
  active: ActiveSession | undefined,
  type: TimerCommand['type'],
  elapsedMs: number,
  offset: number,
  context: TimerContext = { settings: defaultSettings },
  observedCompletion = true,
  revision = type,
) {
  return transitionTimer(
    active,
    { type, sessionId: active?.sessionId ?? 'new-session' },
    {
      wall: start + offset,
      elapsedMs,
      zone: { timeZone: 'UTC', offsetMinutes: 0 },
      observedCompletion,
      revision,
    },
    context,
  );
}

function started(mode: 'start' | 'start-stopwatch' = 'start') {
  const active = step(undefined, mode, 0, 0)?.active;
  if (!active) throw new Error('Expected an active session');
  return active;
}

describe('M6 Focus transitions', () => {
  it('serializes concurrent long-break completion and skip, resetting the cycle once', async () => {
    const name = createRecordId();
    const db = new WorkspaceDatabase(name);
    const otherDb = new WorkspaceDatabase(name);
    const repo = new WorkspaceRepository(db);
    const peer = new WorkspaceRepository(otherDb);
    try {
      const cycle: PomodoroCycle = {
        id: 'cycle',
        completedFocusSessions: 2,
        pendingBreak: 'long',
      };
      await repo.cycle.save(cycle);
      const pending = await repo.focusSnapshot();
      const next = step(undefined, 'start-break', 0, 0, {
        cycle,
        settings: defaultSettings,
      });
      if (!next?.active) throw new Error('Missing break');
      await repo.updateFocus(pending, () => next, 'start-break');
      const expected = await repo.focusSnapshot();
      const active = expected.active;
      if (!active) throw new Error('Missing active break');
      const context = { cycle: expected.cycle, settings: defaultSettings };
      const [first, second] = await Promise.all([
        repo.updateFocus(
          expected,
          () => step(active, 'recover', 180_000, 180_000, context),
          'recover',
        ),
        peer.updateFocus(
          expected,
          () => step(active, 'skip-break', 180_000, 180_000, context),
          'skip-break',
        ),
      ]);
      expect([first.result, second.result].sort()).toEqual([
        'committed',
        'conflict',
      ]);
      expect(await repo.focusSnapshot()).toMatchObject({
        active: undefined,
        cycle: { completedFocusSessions: 0, pendingBreak: null },
      });
      expect(await repo.sessions.list()).toEqual([]);
    } finally {
      db.close();
      otherDb.close();
    }
  });
  it('enforces duration boundaries and safe conversion', () => {
    for (const [limit, valid] of [
      [60, 60],
      [120, 120],
      [12, 12],
    ]) {
      expect(validBreakSetting(1, limit)).toBe(true);
      expect(validBreakSetting(valid, limit)).toBe(true);
      for (const bad of [0, -1, limit + 1, Number.MAX_SAFE_INTEGER, 1.5])
        expect(validBreakSetting(bad, limit)).toBe(false);
    }
    expect(safeMinutesMs(120, 120)).toBe(7200000);
    expect(() => safeMinutesMs(Number.MAX_SAFE_INTEGER, 120)).toThrow();
  });

  it('anchors a delayed automatic break at the original deadline and finishes an already elapsed break', () => {
    const active = started();
    const delayed = step(active, 'recover', 301_500, 301_500);
    expect(delayed?.active).toMatchObject({
      startedAt: delayed?.completion?.endedAt,
      type: 'short-break',
      timing: { elapsedAtAnchorMs: 1500 },
    });
    expect(delayed?.active && remainingMs(delayed.active, 1500)).toBe(118500);
    if (!delayed?.active) throw new Error('Expected automatic break');
    const reopened = recoveryAnchor(delayed.active, {
      wall: start + 304_500,
      monotonic: 0,
    });
    expect(remainingMs(delayed.active, reopened.elapsedMs)).toBe(115500);
    const finished = step(active, 'recover', 420_000, 420_000);
    expect(finished).toMatchObject({
      active: null,
      cycle: { completedFocusSessions: 1, pendingBreak: null },
    });
    expect(finished?.completion?.status).toBe('completed');
    const long = step(active, 'recover', 480_000, 480_000, {
      cycle: { id: 'cycle', completedFocusSessions: 1, pendingBreak: null },
      settings: defaultSettings,
    });
    expect(long).toMatchObject({
      active: null,
      cycle: { completedFocusSessions: 0, pendingBreak: null },
    });
  });
  it.each([5, 25, 45, 60, 480])(
    'applies a %s-minute selection to the next timer',
    (minutes) => {
      expect(
        step(undefined, 'start', 0, 0, {
          settings: { ...defaultSettings, focusDurationMinutes: minutes },
        })?.active?.plannedDurationMs,
      ).toBe(minutes * 60_000);
    },
  );

  it('extends repeatedly, preserves elapsed time, and persists the effective target and UTC deadline', () => {
    const active = started();
    const extended = step(active, 'extend', 60_000, 60_000)?.active;
    if (!extended) throw new Error('Expected extension');
    const extendedAgain = step(extended, 'extend', 90_000, 90_000)?.active;
    if (!extendedAgain) throw new Error('Expected second extension');
    expect(remainingMs(extendedAgain, 90_000)).toBe(810_000);
    expect(extendedAgain.timing?.elapsedAtAnchorMs).toBe(90_000);
    expect(step(extendedAgain, 'recover', 899_999, 899_999)).toBeUndefined();
    const expired = step(extendedAgain, 'extend', 900_000, 900_000);
    expect(expired?.completion).toMatchObject({
      endedAt: '2026-11-24T00:11:00.000Z',
      completionLocalDate: '2026-11-24',
      plannedDurationSeconds: 900,
      actualDurationSeconds: 900,
      status: 'completed',
    });
    expect(expired?.active).toMatchObject({
      type: 'short-break',
      plannedDurationMs: 120_000,
      startedAt: expired?.completion?.endedAt,
    });
    expect(expired?.cycle).toMatchObject({
      completedFocusSessions: 1,
      pendingBreak: null,
    });
    expect(recordValidators.activeSession(expired?.active)).toBe(true);
  });

  it('supports pause, continue and partial or discard without advancing the cycle', () => {
    const active = started();
    const paused = step(active, 'pause', 42_500, 42_500)?.active;
    if (!paused) throw new Error('Expected pause');
    expect(step(paused, 'resume', 0, 90_000)?.active).toMatchObject({
      status: 'running',
      accumulatedActiveMs: 42_500,
    });
    expect(step(paused, 'extend', 0, 90_000)).toBeUndefined();
    expect(step(paused, 'save', 0, 90_000)).toMatchObject({
      active: null,
      completion: {
        plannedDurationSeconds: 300,
        actualDurationSeconds: 42.5,
        status: 'partial',
        endedAt: '2026-11-23T23:56:42.500Z',
      },
    });
    expect(step(paused, 'save', 0, 90_000)?.cycle).toBeUndefined();
    expect(step(paused, 'discard', 0, 90_000)).toEqual({ active: null });
  });

  it.each(['short', 'long'] as const)(
    'starts and skips a manual %s break and applies cycle rules before and after starting it',
    (kind) => {
      const count = kind === 'short' ? 1 : 2;
      const cycle: PomodoroCycle = {
        id: 'cycle',
        completedFocusSessions: count,
        pendingBreak: kind,
      };
      const ctx = {
        cycle,
        settings: { ...defaultSettings, breakTransition: 'manual' as const },
      };
      expect(step(undefined, 'start', 0, 0, ctx)).toBeUndefined();
      expect(step(undefined, 'start-stopwatch', 0, 0, ctx)).toBeUndefined();
      const expectedCycle = {
        completedFocusSessions: kind === 'short' ? count : 0,
        pendingBreak: null,
      };
      expect(step(undefined, 'skip-break', 0, 0, ctx)).toMatchObject({
        active: null,
        cycle: expectedCycle,
      });
      const breakStarted = step(undefined, 'start-break', 0, 0, ctx);
      const active = breakStarted?.active;
      if (!active) throw new Error('Expected break');
      const target = kind === 'short' ? 120_000 : 180_000;
      expect(active).toMatchObject({
        type: kind + '-break',
        plannedDurationMs: target,
      });
      expect(step(active, 'start', 0, 0, ctx)).toBeUndefined();
      expect(step(active, 'skip-break', 10_000, 10_000, ctx)).toMatchObject({
        active: null,
        cycle: expectedCycle,
      });
      const paused = step(active, 'pause', 10_000, 10_000, ctx)?.active;
      if (!paused) throw new Error('Expected paused break');
      expect(step(paused, 'recover', target, target, ctx)).toBeUndefined();
      expect(step(paused, 'skip-break', 0, 10_000, ctx)).toMatchObject({
        active: null,
        cycle: expectedCycle,
      });
      expect(
        step(active, 'recover', target - 1, target - 1, ctx, false),
      ).toBeUndefined();
      const recovered = step(active, 'recover', target, target, ctx, false);
      expect(recovered).toMatchObject({ active: null, cycle: expectedCycle });
      expect(recovered?.completion).toBeUndefined();
    },
  );

  it('keeps manual focus completion pending and also keeps closed automatic completion pending', () => {
    const active = started();
    const cycle: PomodoroCycle = {
      id: 'cycle',
      completedFocusSessions: 1,
      pendingBreak: null,
    };
    const expected = {
      active: null,
      cycle: { completedFocusSessions: 2, pendingBreak: 'long' },
    };
    expect(
      step(active, 'recover', 300_000, 300_000, {
        cycle,
        settings: { ...defaultSettings, breakTransition: 'manual' },
      }),
    ).toMatchObject(expected);
    expect(
      step(
        active,
        'recover',
        301_000,
        301_000,
        { cycle, settings: defaultSettings },
        false,
      ),
    ).toMatchObject(expected);
    expect(
      step(active, 'recover', 300_000, 300_000, {
        cycle,
        settings: defaultSettings,
      }),
    ).toMatchObject({
      active: { type: 'long-break', plannedDurationMs: 180_000 },
      cycle: { completedFocusSessions: 2, pendingBreak: null },
    });
  });

  it.each([0, 999, 1000, 21_111])(
    'enforces stopwatch save minimum at %s ms and does not advance the cycle',
    (spent) => {
      const active = started('start-stopwatch');
      expect(recordValidators.activeSession(active)).toBe(true);
      expect(step(active, 'recover', 86_400_000, 86_400_000)).toBeUndefined();
      const paused = step(active, 'pause', spent, spent)?.active;
      if (!paused) throw new Error('Expected paused stopwatch');
      expect(recordValidators.activeSession(paused)).toBe(true);
      expect(elapsedActiveMs(paused, 100_000)).toBe(spent);
      expect(step(paused, 'resume', 0, spent + 100)?.active).toMatchObject({
        status: 'running',
        plannedDurationMs: null,
      });
      const saved = step(paused, 'save', 0, spent + 100);
      if (spent < 1000) expect(saved).toBeUndefined();
      else
        expect(saved).toEqual({
          active: null,
          completion: expect.objectContaining({
            type: 'stopwatch',
            status: 'completed',
            plannedDurationSeconds: null,
            actualDurationSeconds: spent / 1000,
          }),
        });
      expect(step(paused, 'discard', 0, spent)).toEqual({ active: null });
    },
  );
});
