import { describe, expect, it } from 'vitest';
import { toIsoInstant, toLocalDate } from '../clock/local-date';
import type { FocusSession } from './workspace-records';
import { dailyFocus, selectFocusHistory } from './focus-metrics';

const day = toLocalDate(new Date(2026, 10, 23, 0));
const prior = toLocalDate(new Date(2026, 10, 22, 0));
const session: FocusSession = {
  id: 'timer',
  type: 'timer',
  status: 'completed',
  taskId: null,
  taskTitleSnapshot: null,
  startedAt: toIsoInstant(new Date('2026-11-22T20:40:00.000Z')),
  endedAt: toIsoInstant(new Date('2026-11-22T21:05:00.000Z')),
  completionLocalDate: day,
  completionTimezoneOffsetMinutes: -180,
  actualDurationSeconds: 1500,
  plannedDurationSeconds: 1500,
};

describe('focus history and daily totals', () => {
  it('uses the stored local completion day and includes the full duration only when eligible', () => {
    const sessions: FocusSession[] = [
      session,
      {
        ...session,
        id: 'partial',
        status: 'partial',
        actualDurationSeconds: 22,
      },
      {
        ...session,
        id: 'stopwatch',
        type: 'stopwatch',
        plannedDurationSeconds: null,
        actualDurationSeconds: 34,
      },
      { ...session, id: 'prior', completionLocalDate: prior },
    ];
    expect(dailyFocus(sessions, day)).toEqual({ count: 2, seconds: 1534 });
    expect(dailyFocus(sessions, prior)).toEqual({ count: 1, seconds: 1500 });
    expect(
      dailyFocus(
        sessions.filter((row) => row.id !== 'timer'),
        day,
      ),
    ).toEqual({ count: 1, seconds: 34 });
  });

  it('filters by recorded day and sorts by end time, including partials', () => {
    const later = {
      ...session,
      id: 'partial',
      status: 'partial' as const,
      endedAt: toIsoInstant(new Date('2026-11-22T21:06:00.000Z')),
    };
    const otherDay = { ...session, id: 'prior', completionLocalDate: prior };
    const sessions = [session, later, otherDay];
    expect(selectFocusHistory(sessions, day)).toEqual([later, session]);
    expect(selectFocusHistory(sessions, null)).toHaveLength(3);
    expect(sessions[0]).toBe(session);
  });
});
