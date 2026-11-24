import {
  addCalendarDays,
  isLocalDate,
  projectLocalDate,
  type LocalDate,
} from '../../../core/clock/local-date';
import { countsTowardFocus } from '../../../core/domain/focus-metrics';
import {
  habitActivityOn,
  scheduleOn,
  weekdayOf,
} from '../../../core/domain/habit-history';
import type {
  FocusSession,
  Habit,
  HabitCompletion,
  HabitSchedule,
  Task,
} from '../../../core/domain/workspace-records';
import { consistency, periodStart } from '../../habits/domain/habit-rules';
import { isOverdue } from '../../tasks/domain/task-rules';

export const periods = [
  'today',
  'week',
  'monthRolling',
  'month',
  'custom',
] as const;
export type Period = (typeof periods)[number];
export interface DateRange {
  from: LocalDate;
  through: LocalDate;
}
export interface ReportRecords {
  tasks: readonly Task[];
  habits: readonly Habit[];
  schedules: readonly HabitSchedule[];
  completions: readonly HabitCompletion[];
  sessions: readonly FocusSession[];
}

export const trendPageSize = 30;
const dayMs = 86_400_000;
const daysBetween = (from: LocalDate, through: LocalDate) =>
  (Date.parse(through) - Date.parse(from)) / dayMs;
const inRange = (date: LocalDate, range: DateRange) =>
  date >= range.from && date <= range.through;

export function reportPeriod(
  period: Period,
  today: LocalDate,
  from: string,
  through: string,
): DateRange | null {
  if (period === 'custom') {
    return isLocalDate(from) &&
      isLocalDate(through) &&
      from <= through &&
      through <= today
      ? { from, through }
      : null;
  }
  const monthStart = today.slice(0, 8) + '01';
  const start =
    period === 'month' && isLocalDate(monthStart)
      ? monthStart
      : periodStart(
          today,
          period === 'week' ? 7 : period === 'monthRolling' ? 30 : 1,
        );
  return { from: start, through: today };
}

export function trendPage(range: DateRange, page: number): DateRange {
  const span = daysBetween(range.from, range.through);
  const offset = Math.min(span, page * trendPageSize);
  return {
    from: addCalendarDays(
      range.through,
      -Math.min(span, offset + trendPageSize - 1),
    ),
    through: addCalendarDays(range.through, -offset),
  };
}

function groupByHabit<T extends { habitId: string }>(records: readonly T[]) {
  const grouped = new Map<string, T[]>();
  for (const record of records) {
    const group = grouped.get(record.habitId) ?? [];
    group.push(record);
    grouped.set(record.habitId, group);
  }
  return grouped;
}

export function buildProgress(
  records: ReportRecords,
  range: DateRange,
  today: LocalDate,
) {
  const focusByDay = new Map<LocalDate, number>();
  const tasksByDay = new Map<LocalDate, number>();
  let focusSeconds = 0;
  let timers = 0;
  let stopwatches = 0;
  for (const session of records.sessions) {
    const date = session.completionLocalDate;
    if (!inRange(date, range) || !countsTowardFocus(session)) continue;
    focusSeconds += session.actualDurationSeconds;
    focusByDay.set(
      date,
      (focusByDay.get(date) ?? 0) + session.actualDurationSeconds,
    );
    if (session.type === 'timer') timers++;
    else stopwatches++;
  }

  let tasksCompleted = 0;
  let currentCompleted = 0;
  let pending = 0;
  let overdue = 0;
  const completedTaskHistory: { task: Task; date: LocalDate }[] = [];
  for (const task of records.tasks) {
    if (task.deletedAt === null) {
      if (task.status === 'completed') currentCompleted++;
      else pending++;
      if (isOverdue(task, today)) overdue++;
    }
    if (task.status === 'completed' && task.completedAt !== null) {
      const date = projectLocalDate(new Date(task.completedAt));
      if (date !== undefined && inRange(date, range)) {
        tasksCompleted++;
        tasksByDay.set(date, (tasksByDay.get(date) ?? 0) + 1);
        completedTaskHistory.push({ task, date });
      }
    }
  }
  completedTaskHistory.sort((a, b) =>
    (b.task.completedAt ?? '').localeCompare(a.task.completedAt ?? ''),
  );

  const schedules = groupByHabit(records.schedules);
  const completions = groupByHabit(records.completions);
  let habitScheduled = 0;
  let habitCompleted = 0;
  let uncertainHabits = 0;
  const habits = records.habits.flatMap((habit) => {
    const versions = (schedules.get(habit.id) ?? []).filter(
      (schedule) =>
        schedule.effectiveFrom <= range.through &&
        (schedule.effectiveTo === null || schedule.effectiveTo > range.from),
    );
    if (versions.length === 0 || habit.startDate > range.through) return [];
    const done = completions.get(habit.id) ?? [];
    const totals = consistency(
      habit,
      versions,
      done,
      range.through,
      range.from,
    );
    if (totals.eligible === null) uncertainHabits++;
    else {
      habitScheduled += totals.eligible;
      habitCompleted += totals.completed;
    }
    if (totals.eligible === 0) return [];
    const recentScheduled = done
      .filter(
        ({ scheduledDate }) =>
          inRange(scheduledDate, range) &&
          habitActivityOn(habit, scheduledDate) === 'active' &&
          scheduleOn(versions, scheduledDate)?.weekdays.includes(
            weekdayOf(scheduledDate),
          ),
      )
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
      .slice(0, 5);
    return [
      {
        habit,
        versions,
        totals,
        recentScheduled,
        completedDates: new Set(done.map((row) => row.scheduledDate)),
      },
    ];
  });
  const recent = records.completions
    .filter((row) => inRange(row.scheduledDate, range))
    .sort(
      (a, b) =>
        b.scheduledDate.localeCompare(a.scheduledDate) ||
        b.completedAt.localeCompare(a.completedAt),
    );
  return {
    focusSeconds,
    timers,
    stopwatches,
    tasksCompleted,
    currentCompleted,
    completedTaskHistory,
    pending,
    overdue,
    habitScheduled,
    habitCompleted,
    uncertainHabits,
    habits,
    recent,
    focusByDay,
    tasksByDay,
  };
}

export function trendRows(
  report: ReturnType<typeof buildProgress>,
  range: DateRange,
) {
  return Array.from(
    { length: daysBetween(range.from, range.through) + 1 },
    (_, index) => {
      const date = addCalendarDays(range.from, index);
      let scheduled = 0;
      let completed = 0;
      for (const row of report.habits) {
        if (
          habitActivityOn(row.habit, date) !== 'active' ||
          !scheduleOn(row.versions, date)?.weekdays.includes(weekdayOf(date))
        )
          continue;
        scheduled++;
        if (row.completedDates.has(date)) completed++;
      }
      return {
        date,
        focusSeconds: report.focusByDay.get(date) ?? 0,
        tasksCompleted: report.tasksByDay.get(date) ?? 0,
        scheduled,
        completed,
      };
    },
  );
}
