import { describe, expect, it } from 'vitest';
import {
  isLocalDate,
  toIsoInstant,
  type LocalDate,
} from '../../../core/clock/local-date';
import { weekdayOf } from '../../../core/domain/habit-history';
import type {
  Habit,
  HabitCompletion,
  HabitSchedule,
} from '../../../core/domain/workspace-records';
import {
  consistency,
  orderedWeekdays,
  periodStart,
  validateHabitDraft,
} from './habit-rules';

function day(value: string): LocalDate {
  if (!isLocalDate(value)) throw new Error('Invalid fixture date');
  return value;
}
const now = toIsoInstant(new Date('2026-03-06T12:00:00Z'));
const habit: Habit = {
  id: 'read',
  name: 'Read',
  description: null,
  startDate: day('2026-03-06'),
  status: 'active',
  archivedAt: null,
  deletedAt: null,
  deletedLocalDate: null,
  archivePeriods: [],
  createdAt: now,
  updatedAt: now,
};
const daily: HabitSchedule = {
  id: 'daily',
  habitId: 'read',
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  effectiveFrom: habit.startDate,
  effectiveTo: day('2026-03-09'),
  createdAt: now,
};
const weekdays: HabitSchedule = {
  ...daily,
  id: 'weekdays',
  weekdays: [1, 2, 3, 4, 5],
  effectiveFrom: day('2026-03-09'),
  effectiveTo: null,
};
const completion: HabitCompletion = {
  id: 'done',
  habitId: 'read',
  scheduledDate: day('2026-03-08'),
  habitNameSnapshot: 'Old name',
  completedAt: now,
};

describe('habit date rules', () => {
  it('validates the inputs and keeps localized weekday order separate from stored weekday values', () => {
    expect(validateHabitDraft('  ', '', habit.startDate, [1])).toBe('name');
    expect(validateHabitDraft('Read', '', '2026-02-29', [1])).toBe('startDate');
    expect(validateHabitDraft('Read', '', habit.startDate, [])).toBe(
      'weekdays',
    );
    expect(
      validateHabitDraft(' Read ', ' ', habit.startDate, [6, 0, 6]),
    ).toMatchObject({ name: 'Read', description: null, weekdays: [0, 6] });
    expect(orderedWeekdays('ar')).toEqual([6, 0, 1, 2, 3, 4, 5]);
    expect(weekdayOf(day('2026-03-08'))).toBe(0);
    expect(periodStart(day('2026-03-09'), 7)).toBe('2026-03-03');
  });

  it('keeps the former schedule in the denominator across a DST boundary and excludes future and archived occurrences', () => {
    const paused = {
      ...habit,
      archivePeriods: [{ from: day('2026-03-09'), until: day('2026-03-11') }],
    };
    expect(
      consistency(paused, [daily, weekdays], [completion], day('2026-03-11')),
    ).toEqual({ eligible: 4, completed: 1 });
    expect(
      consistency(
        paused,
        [daily, weekdays],
        [],
        day('2026-03-10'),
        day('2026-03-09'),
      ),
    ).toEqual({ eligible: 0, completed: 0 });
    expect(
      consistency(
        habit,
        [daily, weekdays],
        [completion],
        day('2026-03-14'),
        day('2026-03-09'),
      ),
    ).toEqual({ eligible: 5, completed: 0 });
  });

  it('uses the stored deletion date and keeps an unknown legacy cutoff unknown', () => {
    expect(
      consistency(
        { ...habit, deletedAt: now, deletedLocalDate: day('2026-03-09') },
        [daily, weekdays],
        [completion],
        day('2026-03-11'),
      ),
    ).toEqual({ eligible: 3, completed: 1 });
    expect(
      consistency(
        { ...habit, deletedAt: now, deletedLocalDate: 'unknown' },
        [daily, weekdays],
        [completion],
        day('2026-03-11'),
      ),
    ).toEqual({ eligible: null, completed: 1 });
  });

  it('excludes a retained completion from the rate when an edit removes today and counts it once when restored', () => {
    const today = completion.scheduledDate;
    const prior = { ...daily, effectiveTo: today };
    const current = { ...weekdays, effectiveFrom: today };
    expect(consistency(habit, [prior, current], [completion], today)).toEqual({
      eligible: 2,
      completed: 0,
    });
    expect(
      consistency(
        habit,
        [prior, { ...current, weekdays: [0, 1] }],
        [completion],
        today,
      ),
    ).toEqual({
      eligible: 3,
      completed: 1,
    });
  });
});
