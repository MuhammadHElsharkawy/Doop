import { isIsoInstant, isLocalDate } from '../clock/local-date';
import {
  appearances,
  languages,
  themes,
  type Preferences,
} from '../preferences/preferences.service';
import { weekdays, type WorkspaceRecords } from '../domain/workspace-records';

type Guard<T> = (value: unknown) => value is T;

export class InvalidRecordError extends Error {}
export class InvalidActiveSessionError extends InvalidRecordError {}

export function object<T>(
  shape: { [K in keyof T]: Guard<T[K]> },
  rule?: (value: T) => boolean,
): Guard<T> {
  const fields = Object.entries<Guard<unknown>>(shape);
  return (value): value is T => {
    if (!isObject(value) || Object.keys(value).length !== fields.length)
      return false;
    if (
      !fields.every(
        ([key, check]) => Object.hasOwn(value, key) && check(value[key]),
      )
    )
      return false;
    // Every required field has been validated against the corresponding guard.
    return rule?.(value as T) ?? true;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const string: Guard<string> = (value): value is string =>
  typeof value === 'string';
const nonblank: Guard<string> = (value): value is string =>
  string(value) && value.trim().length > 0;

function number(rule: (value: number) => boolean): Guard<number> {
  return (value): value is number =>
    typeof value === 'number' && Number.isFinite(value) && rule(value);
}

export function nullable<T>(check: Guard<T>): Guard<T | null> {
  return (value): value is T | null => value === null || check(value);
}

export function choice<T>(...values: readonly T[]): Guard<T> {
  return (value): value is T => values.some((item) => item === value);
}

export function list<T>(check: Guard<T>): Guard<T[]> {
  return (value): value is T[] =>
    Array.isArray(value) && Array.from(value).every(check);
}

const positiveInt = number((value) => Number.isSafeInteger(value) && value > 0);
const nonnegativeInt = number(
  (value) => Number.isSafeInteger(value) && value >= 0,
);
const nonnegative = number((value) => value >= 0);
const historical = {
  id: nonblank,
  createdAt: isIsoInstant,
  updatedAt: isIsoInstant,
  deletedAt: nullable(isIsoInstant),
};
const association = {
  taskId: nullable(nonblank),
  taskTitleSnapshot: nullable(nonblank),
};

const archivePeriod = object<
  WorkspaceRecords['habits']['archivePeriods'][number]
>(
  { from: isLocalDate, until: nullable(isLocalDate) },
  (period) => period.until === null || period.until >= period.from,
);
const legacyHabitShape = {
  ...historical,
  name: nonblank,
  description: nullable(string),
  startDate: isLocalDate,
  status: choice('active', 'archived'),
  archivedAt: nullable(isIsoInstant),
  archivePeriods: list(archivePeriod),
} satisfies {
  [K in keyof Omit<WorkspaceRecords['habits'], 'deletedLocalDate'>]: Guard<
    WorkspaceRecords['habits'][K]
  >;
};
const isLegacyHabit =
  object<Omit<WorkspaceRecords['habits'], 'deletedLocalDate'>>(
    legacyHabitShape,
  );

export function upgradeLegacyHabit(value: unknown): WorkspaceRecords['habits'] {
  if (isLegacyHabit(value)) {
    const habit = {
      ...value,
      deletedLocalDate: value.deletedAt === null ? null : 'unknown',
    } as const;
    if (recordValidators.habits(habit)) return habit;
  }
  throw new InvalidRecordError('Invalid legacy habit record');
}

export function isLegacyHabitRecord(
  value: unknown,
): value is Omit<WorkspaceRecords['habits'], 'deletedLocalDate'> {
  return isLegacyHabit(value);
}

function validSessionDuration(session: WorkspaceRecords['sessions']): boolean {
  const { actualDurationSeconds: actual, plannedDurationSeconds: target } =
    session;
  const wall =
    (Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000;
  if (wall < 0 || actual - wall >= 1) return false;
  if (session.type === 'stopwatch')
    return target === null && session.status === 'completed' && actual >= 1;
  if (target === null) return false;
  if (session.status === 'partial') return actual < target;
  return actual > 0 && Math.abs(actual - target) < 1;
}

export const isPreferences = object<Preferences>({
  appearance: choice(...appearances),
  theme: choice(...themes),
  language: choice(...languages),
});

type Active = WorkspaceRecords['activeSession'];
const activeFields = {
  ...association,
  id: choice('active'),
  sessionId: nonblank,
  type: choice('timer', 'stopwatch', 'short-break', 'long-break'),
  status: choice('running', 'paused'),
  startedAt: isIsoInstant,
  resumedAt: nullable(isIsoInstant),
  accumulatedActiveMs: nonnegativeInt,
  plannedDurationMs: nullable(positiveInt),
} satisfies { [K in keyof Omit<Active, 'timing'>]: Guard<Active[K]> };

const legacyActive = object<Omit<Active, 'timing'>>(activeFields);
const activeWithTiming = object<Required<Active>>({
  ...activeFields,
  timing: object<NonNullable<Active['timing']>>({
    revision: nonblank,
    pausedAt: nullable(isIsoInstant),
    wallAnchor: isIsoInstant,
    elapsedAtAnchorMs: nonnegativeInt,
    timeZone: nullable((value): value is string => {
      if (!nonblank(value)) return false;
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
    offsetMinutes: number(
      (value) => Number.isInteger(value) && Math.abs(value) < 1440,
    ),
  }),
});

function validActiveSession(value: unknown): value is Active {
  if (!legacyActive(value) && !activeWithTiming(value)) return false;
  const active: Active = value;
  const { accumulatedActiveMs, plannedDurationMs, resumedAt, timing } = active;
  if (
    (active.status === 'running') !== (resumedAt !== null) ||
    (active.type === 'stopwatch') !== (plannedDurationMs === null) ||
    (active.taskId === null) !== (active.taskTitleSnapshot === null)
  )
    return false;
  if (plannedDurationMs !== null && accumulatedActiveMs >= plannedDurationMs)
    return false;
  const earliest = Date.parse(active.startedAt) + accumulatedActiveMs;
  if (resumedAt !== null) {
    const resume = Date.parse(resumedAt);
    const deadline = new Date(
      resume + (plannedDurationMs ?? accumulatedActiveMs) - accumulatedActiveMs,
    );
    if (
      resume < earliest ||
      !Number.isFinite(deadline.getTime()) ||
      deadline.getUTCFullYear() > 9999
    )
      return false;
  }
  if (!timing) return true;
  if (active.status === 'paused') {
    return (
      timing.pausedAt !== null &&
      Date.parse(timing.pausedAt) >= earliest &&
      timing.elapsedAtAnchorMs === 0
    );
  }
  return (
    timing.pausedAt === null &&
    (plannedDurationMs === null ||
      timing.elapsedAtAnchorMs < plannedDurationMs - accumulatedActiveMs)
  );
}

const cycleFields = {
  id: choice('cycle' as const),
  completedFocusSessions: nonnegativeInt,
  pendingBreak: nullable(choice('short' as const, 'long' as const)),
};
type Cycle = WorkspaceRecords['cycle'];
const legacyCycle = object<Omit<Cycle, 'revision'>>(cycleFields);
const versionedCycle = object<Required<Cycle>>({
  ...cycleFields,
  revision: nonblank,
});

const legacySettings = object<WorkspaceRecords['settings']>({
  id: choice('settings'),
  weekStartsOn: nullable(choice(0, 1, 6)),
  dailyGoal: positiveInt,
  focusDurationMinutes: number(
    (value) => value >= 5 && value <= 480 && value % 5 === 0,
  ),
  shortBreakDurationMinutes: positiveInt,
  longBreakDurationMinutes: positiveInt,
  focusSessionsBeforeLongBreak: positiveInt,
  breakTransition: choice('automatic', 'manual'),
  ambientSound: nullable(
    choice('rain', 'coffee-shop', 'ocean-waves', 'forest'),
  ),
  ambientVolume: number((value) => value >= 0 && value <= 100),
});

export function recoverLegacySettings(
  value: unknown,
): WorkspaceRecords['settings'] {
  if (!legacySettings(value))
    throw new InvalidRecordError('Invalid settings record');
  return {
    ...value,
    shortBreakDurationMinutes:
      value.shortBreakDurationMinutes <= 60
        ? value.shortBreakDurationMinutes
        : 5,
    longBreakDurationMinutes:
      value.longBreakDurationMinutes <= 120
        ? value.longBreakDurationMinutes
        : 15,
    focusSessionsBeforeLongBreak:
      value.focusSessionsBeforeLongBreak <= 12
        ? value.focusSessionsBeforeLongBreak
        : 4,
  };
}

type Metadata = WorkspaceRecords['metadata'];
const metadataFields = {
  id: choice('workspace' as const),
  generation: nonnegativeInt,
  preferences: nullable(isPreferences),
};
const metadataWithoutRevision =
  object<Omit<Metadata, 'revision'>>(metadataFields);

export function restoreMissingMetadataRevision(
  value: unknown,
): Metadata | undefined {
  if (!metadataWithoutRevision(value)) return undefined;
  return { ...value, revision: 0 };
}

export const recordValidators: {
  [K in keyof WorkspaceRecords]: Guard<WorkspaceRecords[K]>;
} = {
  tasks: object<WorkspaceRecords['tasks']>(
    {
      ...historical,
      title: nonblank,
      priority: choice('low', 'medium', 'high'),
      dueDate: nullable(isLocalDate),
      expectedSessions: nullable(positiveInt),
      status: choice('pending', 'completed'),
      completedAt: nullable(isIsoInstant),
    },
    (task) => (task.status === 'completed') === (task.completedAt !== null),
  ),
  habits: object<WorkspaceRecords['habits']>(
    {
      ...legacyHabitShape,
      deletedLocalDate: nullable(
        (value): value is WorkspaceRecords['habits']['deletedLocalDate'] =>
          value === 'unknown' || isLocalDate(value),
      ),
    },
    (habit) => {
      const periods = habit.archivePeriods;
      const open = periods.at(-1)?.until === null;
      return (
        (habit.deletedAt === null) === (habit.deletedLocalDate === null) &&
        (habit.status === 'archived') === open &&
        open === (habit.archivedAt !== null) &&
        periods.every((period, index) => {
          const previous = periods[index - 1];
          return (
            !previous ||
            (previous.until !== null && previous.until <= period.from)
          );
        })
      );
    },
  ),
  schedules: object<WorkspaceRecords['schedules']>(
    {
      id: nonblank,
      habitId: nonblank,
      weekdays: list(choice(...weekdays)),
      effectiveFrom: isLocalDate,
      effectiveTo: nullable(isLocalDate),
      createdAt: isIsoInstant,
    },
    (schedule) =>
      schedule.weekdays.length > 0 &&
      new Set(schedule.weekdays).size === schedule.weekdays.length &&
      (schedule.effectiveTo === null ||
        schedule.effectiveTo > schedule.effectiveFrom),
  ),
  completions: object<WorkspaceRecords['completions']>({
    id: nonblank,
    habitId: nonblank,
    habitNameSnapshot: nonblank,
    scheduledDate: isLocalDate,
    completedAt: isIsoInstant,
  }),
  sessions: object<WorkspaceRecords['sessions']>(
    {
      ...association,
      id: nonblank,
      type: choice('timer', 'stopwatch'),
      plannedDurationSeconds: nullable(positiveInt),
      actualDurationSeconds: nonnegative,
      startedAt: isIsoInstant,
      endedAt: isIsoInstant,
      completionLocalDate: isLocalDate,
      completionTimezoneOffsetMinutes: number(
        (value) => Number.isInteger(value) && Math.abs(value) < 1440,
      ),
      status: choice('completed', 'partial'),
    },
    (session) =>
      (session.taskId === null) === (session.taskTitleSnapshot === null) &&
      validSessionDuration(session) &&
      new Date(
        Date.parse(session.endedAt) -
          session.completionTimezoneOffsetMinutes * 60000,
      )
        .toISOString()
        .slice(0, 10) === session.completionLocalDate,
  ),
  activeSession: validActiveSession,
  cycle: (value): value is Cycle => legacyCycle(value) || versionedCycle(value),
  metadata: object<Metadata>({
    ...metadataFields,
    revision: nonnegativeInt,
  }),
  settings: object<WorkspaceRecords['settings']>({
    id: choice('settings'),
    weekStartsOn: nullable(choice(0, 1, 6)),
    dailyGoal: positiveInt,
    focusDurationMinutes: number(
      (value) => value >= 5 && value <= 480 && value % 5 === 0,
    ),
    shortBreakDurationMinutes: number(
      (value) => Number.isSafeInteger(value) && value >= 1 && value <= 60,
    ),
    longBreakDurationMinutes: number(
      (value) => Number.isSafeInteger(value) && value >= 1 && value <= 120,
    ),
    focusSessionsBeforeLongBreak: number(
      (value) => Number.isSafeInteger(value) && value >= 1 && value <= 12,
    ),
    breakTransition: choice('automatic', 'manual'),
    ambientSound: nullable(
      choice('rain', 'coffee-shop', 'ocean-waves', 'forest'),
    ),
    ambientVolume: number((value) => value >= 0 && value <= 100),
  }),
};
