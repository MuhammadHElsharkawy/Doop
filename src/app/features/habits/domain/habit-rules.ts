import {
  addCalendarDays,
  isLocalDate,
  type LocalDate,
} from '../../../core/clock/local-date';
import {
  habitActivityOn,
  scheduleOn,
  weekdayOf,
} from '../../../core/domain/habit-history';
import {
  weekdays,
  type Habit,
  type HabitCompletion,
  type HabitSchedule,
} from '../../../core/domain/workspace-records';

export interface HabitDraft {
  name: string;
  description: string | null;
  startDate: LocalDate;
  weekdays: HabitSchedule['weekdays'];
}

export type HabitField = 'name' | 'startDate' | 'weekdays';

export function validateHabitDraft(
  name: string,
  description: string,
  startDate: string,
  days: HabitSchedule['weekdays'],
): HabitDraft | HabitField {
  if (!name.trim()) return 'name';
  if (!isLocalDate(startDate)) return 'startDate';
  const selected = weekdays.filter((day) => days.includes(day));
  if (selected.length === 0) return 'weekdays';
  return {
    name: name.trim(),
    description: description.trim() || null,
    startDate,
    weekdays: selected,
  };
}

export function orderedWeekdays(
  language: 'en' | 'ar',
): HabitSchedule['weekdays'] {
  return language === 'ar' ? [6, 0, 1, 2, 3, 4, 5] : [...weekdays];
}

export function weekdayNames(
  language: 'en' | 'ar',
  width: 'long' | 'short',
): string[] {
  const format = new Intl.DateTimeFormat(language, {
    weekday: width,
    timeZone: 'UTC',
  });
  return weekdays.map((day) =>
    format.format(new Date(Date.UTC(2024, 0, 7 + day))),
  );
}

const dayNumber = (date: LocalDate): number => Date.parse(date) / 86_400_000;

export function consistency(
  habit: Habit,
  schedules: readonly HabitSchedule[],
  completions: readonly HabitCompletion[],
  today: LocalDate,
  from: LocalDate = habit.startDate,
): { eligible: number | null; completed: number } {
  const eligibleOn = (date: LocalDate) =>
    habitActivityOn(habit, date) === 'active' &&
    scheduleOn(schedules, date)?.weekdays.includes(weekdayOf(date));
  const completed = completions.filter(
    ({ scheduledDate }) =>
      scheduledDate >= from &&
      scheduledDate <= today &&
      (habit.deletedLocalDate === 'unknown' || eligibleOn(scheduledDate)),
  ).length;
  if (habit.deletedLocalDate === 'unknown')
    return { eligible: null, completed };

  const end = Math.min(
    dayNumber(today) + 1,
    habit.deletedLocalDate === null
      ? Infinity
      : dayNumber(habit.deletedLocalDate),
  );
  const start = Math.max(dayNumber(from), dayNumber(habit.startDate));
  const eligible = schedules.reduce((total, schedule) => {
    const left = Math.max(start, dayNumber(schedule.effectiveFrom));
    const right = Math.min(
      end,
      schedule.effectiveTo === null
        ? Infinity
        : dayNumber(schedule.effectiveTo),
    );
    const count = (low: number, high: number) => {
      const length = Math.max(0, high - low);
      const firstDay = (((low + 4) % 7) + 7) % 7;
      return (
        Math.floor(length / 7) * schedule.weekdays.length +
        schedule.weekdays.filter((day) => (day + 7 - firstDay) % 7 < length % 7)
          .length
      );
    };
    if (left >= right) return total;
    const archived = habit.archivePeriods.reduce(
      (sum, period) =>
        sum +
        count(
          Math.max(left, dayNumber(period.from)),
          Math.min(
            right,
            period.until === null ? Infinity : dayNumber(period.until),
          ),
        ),
      0,
    );
    return total + count(left, right) - archived;
  }, 0);
  return { eligible, completed };
}

export function periodStart(today: LocalDate, days: number): LocalDate {
  const earliest = '0000-01-01';
  if (
    dayNumber(today) - Date.parse(earliest) / 86_400_000 < days - 1 &&
    isLocalDate(earliest)
  )
    return earliest;
  return addCalendarDays(today, 1 - days);
}
