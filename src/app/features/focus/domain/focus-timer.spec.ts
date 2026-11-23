import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { toIsoInstant } from '../../../core/clock/local-date';
import { WorkspaceDatabase } from '../../../core/database/workspace-database';
import { createRecordId } from '../../../core/domain/record-id';
import type { ActiveSession } from '../../../core/domain/workspace-records';
import { recordValidators } from '../../../core/persistence/record-validation';
import { WorkspaceRepository } from '../../../core/persistence/workspace.repository';
import {
  clockDisagrees,
  elapsedSinceResume,
  focusDurationMs,
  recoveryAnchor,
  remainingMs,
  transitionTimer,
  type TimerCommand,
} from './focus-timer';

const start = Date.parse('2026-03-08T04:50:00Z');
const zone = { timeZone: 'America/New_York', offsetMinutes: 300 };

function change(
  active: ActiveSession | undefined,
  type: TimerCommand['type'],
  wall: number,
  elapsedMs = 0,
  observedCompletion = false,
) {
  return transitionTimer(
    active,
    { type, sessionId: 'focus-1' },
    { wall, elapsedMs, zone, observedCompletion, revision: createRecordId() },
  );
}

function activeAfter(...args: Parameters<typeof change>): ActiveSession {
  const active = change(...args)?.active;
  if (!active) throw new Error('Expected active session');
  return active;
}

describe('M5 focus timer', () => {
  it('uses only monotonic progress across wall-clock jumps and rebases without double counting', () => {
    const active = activeAfter(undefined, 'start', start);
    const anchor = recoveryAnchor(active, { wall: start, monotonic: 10_000 });
    for (const delta of [-3_600_000, 3_600_000]) {
      const sample = { wall: start + delta, monotonic: 12_000 };
      expect(clockDisagrees(anchor, sample)).toBe(true);
      const elapsed = elapsedSinceResume(anchor, sample.monotonic);
      expect(remainingMs(active, elapsed)).toBe(focusDurationMs - 2000);
      const rebased = activeAfter(active, 'checkpoint', sample.wall, elapsed);
      expect(rebased.resumedAt).toBe(active.resumedAt);
      const reopened = recoveryAnchor(rebased, {
        wall: sample.wall + 1000,
        monotonic: 20,
      });
      expect(elapsedSinceResume(reopened, 1020)).toBe(4000);
    }
  });

  it('excludes multiple pauses, completes at the exact deadline and saves the effective target', () => {
    const active = activeAfter(undefined, 'start', start);
    const paused = activeAfter(active, 'pause', start + 2000, 2000);
    expect(remainingMs(paused, 900_000)).toBe(focusDurationMs - 2000);
    expect(change(paused, 'recover', start + 9_000_000)).toBeUndefined();
    const resumed = activeAfter(paused, 'resume', start + 10_000);
    const pausedAgain = activeAfter(resumed, 'pause', start + 13_000, 3000);
    const finalRun = activeAfter(pausedAgain, 'resume', start + 20_000);
    expect(
      change(finalRun, 'recover', start + 9_000_000, focusDurationMs - 5001),
    ).toBeUndefined();
    const result = change(
      finalRun,
      'recover',
      start + 9_000_000,
      focusDurationMs - 5000,
    );
    expect(result).toMatchObject({
      active: null,
      completion: {
        endedAt: toIsoInstant(new Date(start + focusDurationMs + 15_000)),
        completionLocalDate: '2026-03-08',
        completionTimezoneOffsetMinutes: 300,
        actualDurationSeconds: 1500,
        plannedDurationSeconds: 1500,
        status: 'completed',
      },
    });
  });

  it('attributes an unobserved deadline to the persisted zone and honors its DST rules', () => {
    const active = activeAfter(
      undefined,
      'start',
      Date.parse('2026-03-08T06:50:00Z'),
    );
    const input = {
      wall: start + 9_000_000,
      elapsedMs: focusDurationMs,
      zone: { timeZone: 'America/Los_Angeles', offsetMinutes: 480 },
      revision: 'new',
    };
    const command = { type: 'recover', sessionId: 'focus-1' } as const;
    expect(
      transitionTimer(active, command, { ...input, observedCompletion: false })
        ?.completion,
    ).toMatchObject({
      endedAt: '2026-03-08T07:15:00.000Z',
      completionLocalDate: '2026-03-08',
      completionTimezoneOffsetMinutes: 240,
    });
    expect(
      transitionTimer(active, command, { ...input, observedCompletion: true })
        ?.completion,
    ).toMatchObject({
      endedAt: '2026-03-08T07:15:00.000Z',
      completionLocalDate: '2026-03-07',
      completionTimezoneOffsetMinutes: 480,
    });
  });

  it('rejects invalid running and paused anchors while reading consistent legacy records', () => {
    const active = activeAfter(undefined, 'start', start);
    const paused = activeAfter(active, 'pause', start + 5000, 5000);
    const historical = toIsoInstant(new Date(start - 1));
    expect(
      recordValidators.activeSession({ ...active, resumedAt: historical }),
    ).toBe(false);
    expect(
      recordValidators.activeSession({
        ...active,
        timing: { ...active.timing, elapsedAtAnchorMs: focusDurationMs },
      }),
    ).toBe(false);
    expect(
      recordValidators.activeSession({
        ...paused,
        timing: { ...paused.timing, pausedAt: historical },
      }),
    ).toBe(false);
    expect(
      recordValidators.activeSession({
        ...paused,
        accumulatedActiveMs: focusDurationMs,
      }),
    ).toBe(false);
    const { timing, ...legacy } = paused;
    expect(timing).toBeDefined();
    expect(recordValidators.activeSession(legacy)).toBe(true);
  });

  it('finishes once across two database connections and rejects stale pause and resume revisions', async () => {
    const name = createRecordId();
    const first = new WorkspaceDatabase(name);
    const second = new WorkspaceDatabase(name);
    const repo = new WorkspaceRepository(first);
    const peer = new WorkspaceRepository(second);
    try {
      const running = activeAfter(undefined, 'start', start);
      await repo.updateFocus(
        { active: undefined, cycle: undefined },
        () => ({ active: running }),
        'start',
      );
      const paused = activeAfter(running, 'pause', start + 1000, 1000);
      await repo.updateFocus(
        { active: running, cycle: undefined },
        () => ({ active: paused }),
        'pause',
      );
      const resumed = activeAfter(paused, 'resume', start + 3000);
      await repo.updateFocus(
        { active: paused, cycle: undefined },
        () => ({ active: resumed }),
        'resume',
      );
      expect(
        (
          await peer.updateFocus(
            { active: running, cycle: undefined },
            () => ({ active: paused }),
            'pause',
          )
        ).result,
      ).toBe('conflict');
      expect(
        (
          await peer.updateFocus(
            { active: paused, cycle: undefined },
            () => ({ active: resumed }),
            'resume',
          )
        ).result,
      ).toBe('conflict');
      first.close();
      expect((await repo.focusSnapshot()).active).toEqual(resumed);
      const recover = () =>
        change(resumed, 'recover', start + 9_000_000, focusDurationMs);
      const results = await Promise.all([
        repo.updateFocus(
          { active: resumed, cycle: undefined },
          recover,
          'recover',
        ),
        peer.updateFocus(
          { active: resumed, cycle: undefined },
          recover,
          'recover',
        ),
      ]);
      expect(results.map(({ result }) => result).sort()).toEqual([
        'committed',
        'conflict',
      ]);
      expect(await peer.sessions.list()).toHaveLength(1);
      expect(await repo.focusSnapshot()).toMatchObject({
        active: undefined,
        cycle: {
          id: 'cycle',
          completedFocusSessions: 1,
          pendingBreak: 'short',
        },
      });
    } finally {
      first.close();
      second.close();
    }
  });
});

it('commits automatic breaks with focus history and cycle, or rolls all three back', async () => {
  const database = new WorkspaceDatabase(createRecordId());
  const repo = new WorkspaceRepository(database);
  try {
    const running = activeAfter(undefined, 'start', start);
    await repo.updateFocus(
      { active: undefined, cycle: undefined },
      () => ({ active: running }),
      'start',
    );
    const expected = await repo.focusSnapshot();
    const expire = () =>
      change(
        running,
        'recover',
        start + focusDurationMs,
        focusDurationMs,
        true,
      );
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'activeSession' && value?.type === 'short-break')
        throw new DOMException('Storage full', 'QuotaExceededError');
      return put.call(this, value, key);
    };
    try {
      await expect(
        repo.updateFocus(expected, expire, 'recover'),
      ).rejects.toMatchObject({ name: 'QuotaExceededError' });
    } finally {
      IDBObjectStore.prototype.put = put;
    }
    expect(await repo.focusSnapshot()).toEqual(expected);
    expect(await repo.sessions.list()).toEqual([]);
    expect((await repo.updateFocus(expected, expire, 'recover')).result).toBe(
      'committed',
    );
    expect((await repo.updateFocus(expected, expire, 'recover')).result).toBe(
      'conflict',
    );
    expect(await repo.focusSnapshot()).toMatchObject({
      active: { type: 'short-break', plannedDurationMs: 300_000 },
      cycle: { completedFocusSessions: 1, pendingBreak: null },
    });
    expect(await repo.sessions.list()).toHaveLength(1);
  } finally {
    database.close();
  }
});
