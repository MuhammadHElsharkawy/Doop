import type { LocalDate } from '../clock/local-date';
import type { Habit, HabitSchedule } from './workspace-records';

export function weekdayOf(date: LocalDate): HabitSchedule['weekdays'][number] {
  // Use the date label directly. The viewer's time zone must not shift its weekday.
  return new Date(date).getUTCDay() as HabitSchedule['weekdays'][number];
}

export function scheduleOn(
  schedules: readonly HabitSchedule[],
  date: LocalDate,
): HabitSchedule | undefined {
  return schedules.find(
    ({ effectiveFrom, effectiveTo }) =>
      effectiveFrom <= date && (effectiveTo === null || date < effectiveTo),
  );
}

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
  habits: readonly Pick<Habit, 'id'>[],
  schedules: readonly HabitSchedule[],
): boolean {
  const ids = new Set(habits.map(({ id }) => id));
  return (
    schedules.every(({ habitId }) => ids.has(habitId)) &&
    nonOverlappingSchedules(schedules)
  );
}
