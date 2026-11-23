import type { LocalDate } from '../clock/local-date';
import type { Habit, HabitSchedule } from './workspace-records';

export function habitActivityOn(
  habit: Habit,
  date: LocalDate,
): 'active' | 'inactive' | 'unknown' {
  if (
    date < habit.startDate ||
    habit.archivePeriods.some(
      ({ from, until }) => from <= date && (until === null || date < until),
    )
  )
    return 'inactive';
  const deletion = habit.deletedLocalDate;
  if (deletion === 'unknown') return 'unknown';
  return deletion !== null && deletion <= date ? 'inactive' : 'active';
}

export function nonOverlappingSchedules(
  schedules: readonly HabitSchedule[],
): boolean {
  const latest = new Map<string, HabitSchedule>();
  for (const schedule of [...schedules].sort((left, right) =>
    left.effectiveFrom.localeCompare(right.effectiveFrom),
  )) {
    const previous = latest.get(schedule.habitId);
    if (
      previous &&
      (previous.effectiveTo === null ||
        previous.effectiveTo > schedule.effectiveFrom)
    )
      return false;
    latest.set(schedule.habitId, schedule);
  }
  return true;
}

export function validScheduleHistory(
  habits: readonly Habit[],
  schedules: readonly HabitSchedule[],
): boolean {
  const ids = new Set(habits.map(({ id }) => id));
  return (
    schedules.every(({ habitId }) => ids.has(habitId)) &&
    nonOverlappingSchedules(schedules)
  );
}
