import { describe, expect, it } from 'vitest';
import {
  isLocalDate,
  projectLocalDate,
  toIsoInstant,
} from '../../../core/clock/local-date';
import type {
  FocusSession,
  Habit,
  Task,
} from '../../../core/domain/workspace-records';
import {
  buildProgress,
  reportPeriod,
  trendPage,
  trendRows,
  type ReportRecords,
} from './progress-report';

const day = (value: string) => {
  if (!isLocalDate(value)) throw new Error(value);
  return value;
};
const today = day('2026-03-11');
const at = toIsoInstant(new Date(2026, 2, 10, 23, 45));
const completed: Task = {
  id: 'deleted',
  title: 'Completed earlier',
  createdAt: at,
  updatedAt: at,
  status: 'completed',
  completedAt: at,
  deletedAt: at,
  dueDate: today,
  priority: 'medium',
  expectedSessions: null,
};
const habit: Habit = {
  id: 'habit',
  name: 'Walk',
  description: null,
  createdAt: at,
  updatedAt: at,
  startDate: day('2026-03-06'),
  status: 'active',
  archivePeriods: [{ from: day('2026-03-08'), until: day('2026-03-09') }],
  archivedAt: null,
  deletedAt: at,
  deletedLocalDate: day('2026-03-11'),
};
const session: FocusSession = {
  id: 'timer',
  type: 'timer',
  status: 'completed',
  startedAt: at,
  endedAt: at,
  taskId: null,
  taskTitleSnapshot: null,
  plannedDurationSeconds: 1500,
  actualDurationSeconds: 1500,
  completionLocalDate: today,
  completionTimezoneOffsetMinutes: -120,
};

describe('Progress selectors', () => {
  it('does not build date labels outside the supported local year range', () => {
    const date = new Date(2000, 0, 1);
    for (const year of [-1, 10000]) {
      date.setFullYear(year);
      expect(projectLocalDate(date)).toBeUndefined();
    }
    date.setFullYear(9999);
    expect(projectLocalDate(date)).toBe('9999-01-01');
  });
  it('uses inclusive calendar dates and bounds each trend page across a DST week', () => {
    expect(reportPeriod('week', today, '', '')).toEqual({
      from: '2026-03-05',
      through: today,
    });
    expect(reportPeriod('monthRolling', today, '', '')).toEqual({
      from: '2026-02-10',
      through: today,
    });
    expect(reportPeriod('month', today, '', '')).toEqual({
      from: '2026-03-01',
      through: today,
    });
    expect(
      reportPeriod('custom', today, '2026-03-10', '2026-03-12'),
    ).toBeNull();
    expect(
      reportPeriod('custom', today, '2026-03-11', '2026-03-10'),
    ).toBeNull();
    expect(trendPage({ from: day('2026-01-01'), through: today }, 2)).toEqual({
      from: '2026-01-01',
      through: '2026-01-10',
    });
  });

  it('counts stored focus dates, task completion dates, and effective habit occurrences', () => {
    const records: ReportRecords = {
      tasks: [
        completed,
        {
          ...completed,
          id: 'overdue',
          status: 'pending',
          completedAt: null,
          deletedAt: null,
          dueDate: day('2026-03-10'),
        },
        {
          ...completed,
          id: 'undated',
          status: 'pending',
          completedAt: null,
          deletedAt: null,
          dueDate: null,
        },
      ],
      habits: [
        habit,
        { ...habit, id: 'uncertain', deletedLocalDate: 'unknown' },
      ],
      schedules: [
        {
          id: 'original',
          habitId: habit.id,
          effectiveFrom: habit.startDate,
          effectiveTo: day('2026-03-09'),
          weekdays: [5, 0],
          createdAt: at,
        },
        {
          id: 'edited',
          habitId: habit.id,
          effectiveFrom: day('2026-03-09'),
          effectiveTo: null,
          weekdays: [1, 3],
          createdAt: at,
        },
        {
          id: 'legacy',
          habitId: 'uncertain',
          effectiveFrom: habit.startDate,
          effectiveTo: null,
          weekdays: [1],
          createdAt: at,
        },
      ],
      completions: ['2026-03-06', '2026-03-08', '2026-03-10'].map((date) => ({
        id: date,
        habitId: habit.id,
        scheduledDate: day(date),
        habitNameSnapshot: 'Original name',
        completedAt: at,
      })),
      sessions: [
        session,
        {
          ...session,
          id: 'watch',
          type: 'stopwatch',
          plannedDurationSeconds: null,
          actualDurationSeconds: 30,
        },
        {
          ...session,
          id: 'partial',
          status: 'partial',
          actualDurationSeconds: 10,
        },
      ],
    };
    const range = { from: day('2026-03-06'), through: today };
    const report = buildProgress(records, range, today);
    expect(report).toMatchObject({
      focusSeconds: 1530,
      timers: 1,
      stopwatches: 1,
      tasksCompleted: 1,
      pending: 2,
      overdue: 1,
      currentCompleted: 0,
      habitScheduled: 2,
      habitCompleted: 1,
      uncertainHabits: 1,
    });
    expect(report.completedTaskHistory[0]?.date).toBe('2026-03-10');
    expect(report.recent).toHaveLength(3);
    expect(report.habits[0]?.recentScheduled).toHaveLength(1);
    const trends = trendRows(report, range);
    expect(trends.find(({ date }) => date === today)).toMatchObject({
      focusSeconds: 1530,
      scheduled: 0,
    });
    expect(trends.reduce((sum, row) => sum + row.completed, 0)).toBe(
      report.habitCompleted,
    );
    expect(
      buildProgress(
        { ...records, sessions: [records.sessions[1]] },
        range,
        today,
      ).focusSeconds,
    ).toBe(30);
  });
});
