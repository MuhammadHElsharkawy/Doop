import {
  isLocalDate,
  toIsoInstant,
  type IsoInstant,
} from '../../../core/clock/local-date';
import type {
  ActiveSession,
  ActiveTimerTiming,
  FocusSession,
  PomodoroCycle,
  WorkspaceSettings,
} from '../../../core/domain/workspace-records';

import { defaultFocusSettings, safeMinutesMs } from './focus-settings';

export const focusDurationMs = 25 * 60_000;
export type TimerCommand = {
  type:
    | 'start'
    | 'start-stopwatch'
    | 'start-break'
    | 'pause'
    | 'resume'
    | 'extend'
    | 'skip-break'
    | 'save'
    | 'discard'
    | 'recover'
    | 'checkpoint';
  sessionId: string;
  taskId?: string;
};
export type TimerChange = {
  active: ActiveSession | null;
  completion?: FocusSession;
  cycle?: PomodoroCycle;
};

export interface ClockSample {
  wall: number;
  monotonic: number;
}

export interface RunningAnchor extends ClockSample {
  elapsedMs: number;
}

interface Zone {
  timeZone: string | null;
  offsetMinutes: number;
}

export function recoveryAnchor(
  active: ActiveSession,
  sample: ClockSample,
): RunningAnchor {
  const wall = Date.parse(
    active.timing?.wallAnchor ?? active.resumedAt ?? active.startedAt,
  );
  return {
    wall: sample.wall,
    monotonic: sample.monotonic,
    elapsedMs:
      active.status === 'running'
        ? (active.timing?.elapsedAtAnchorMs ?? 0) +
          Math.max(0, sample.wall - wall)
        : 0,
  };
}

export function elapsedSinceResume(
  anchor: RunningAnchor,
  monotonic: number,
): number {
  return (
    anchor.elapsedMs + Math.max(0, Math.floor(monotonic - anchor.monotonic))
  );
}

export function clockDisagrees(
  anchor: RunningAnchor,
  sample: ClockSample,
): boolean {
  return (
    Math.abs(
      sample.wall - anchor.wall - (sample.monotonic - anchor.monotonic),
    ) >= 1000
  );
}

export function remainingMs(active: ActiveSession, elapsedMs: number): number {
  return Math.max(
    0,
    (active.plannedDurationMs ?? 0) -
      active.accumulatedActiveMs -
      (active.status === 'running' ? elapsedMs : 0),
  );
}

export function localZone(wall: number): Zone {
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    offsetMinutes: new Date(wall).getTimezoneOffset(),
  };
}

function completionDate(deadline: Date, zone: Zone) {
  let offsetMinutes = zone.offsetMinutes;
  if (zone.timeZone) {
    const text = new Intl.DateTimeFormat('en-US', {
      timeZone: zone.timeZone,
      timeZoneName: 'longOffset',
    })
      .formatToParts(deadline)
      .find(({ type }) => type === 'timeZoneName')?.value;
    const match = /^GMT([+-])(\d\d):(\d\d)$/.exec(text ?? '');
    if (text === 'GMT') offsetMinutes = 0;
    else if (match)
      offsetMinutes =
        (match[1] === '+' ? -1 : 1) *
        (Number(match[2]) * 60 + Number(match[3]));
  }
  const date = new Date(deadline.getTime() - offsetMinutes * 60_000)
    .toISOString()
    .slice(0, 10);
  if (!isLocalDate(date)) throw new RangeError('Invalid completion date');
  return {
    completionLocalDate: date,
    completionTimezoneOffsetMinutes: offsetMinutes || 0,
  };
}

export interface TimerInput {
  wall: number;
  elapsedMs: number;
  zone: Zone;
  observedCompletion: boolean;
  revision: string;
}

function newActive(
  type: ActiveSession['type'],
  duration: number | null,
  sessionId: string,
  startedAt: IsoInstant,
  timing: ActiveTimerTiming,
  task?: Pick<ActiveSession, 'taskId' | 'taskTitleSnapshot'>,
): ActiveSession {
  if (duration !== null) {
    const end = Date.parse(startedAt) + duration;
    if (
      !Number.isSafeInteger(end) ||
      !Number.isFinite(new Date(end).getTime()) ||
      new Date(end).getUTCFullYear() > 9999
    )
      throw new RangeError('Timer deadline is outside the supported range');
  }
  return {
    id: 'active',
    sessionId,
    type,
    status: 'running',
    startedAt,
    resumedAt: startedAt,
    accumulatedActiveMs: 0,
    plannedDurationMs: duration,
    taskId: null,
    taskTitleSnapshot: null,
    ...task,
    timing,
  };
}

export interface TimerContext {
  cycle?: PomodoroCycle;
  settings?: WorkspaceSettings;
  task?: Pick<ActiveSession, 'taskId' | 'taskTitleSnapshot'>;
}

export function elapsedActiveMs(
  active: ActiveSession,
  segmentMs: number,
): number {
  return (
    active.accumulatedActiveMs + (active.status === 'running' ? segmentMs : 0)
  );
}

export function transitionTimer(
  active: ActiveSession | undefined,
  command: TimerCommand,
  input: TimerInput,
  context: TimerContext = {},
): TimerChange | undefined {
  const { wall, elapsedMs, zone, revision } = input;
  const settings = context.settings ?? defaultFocusSettings;
  const cycle = context.cycle;
  const pending = cycle?.pendingBreak;
  const count = cycle?.completedFocusSessions ?? 0;
  const wallAnchor = toIsoInstant(new Date(wall));
  const timing: ActiveTimerTiming = {
    ...zone,
    revision,
    wallAnchor,
    elapsedAtAnchorMs: 0,
    pausedAt: null,
  };
  const nextCycle = (
    completedFocusSessions: number,
    pendingBreak: PomodoroCycle['pendingBreak'],
  ): PomodoroCycle => ({
    id: 'cycle',
    completedFocusSessions,
    pendingBreak,
    revision,
  });
  const breakSession = (
    kind: 'short' | 'long',
    startedAt: IsoInstant,
    id: string,
  ) =>
    newActive(
      kind === 'short' ? 'short-break' : 'long-break',
      safeMinutesMs(
        kind === 'short'
          ? settings.shortBreakDurationMinutes
          : settings.longBreakDurationMinutes,
        kind === 'short' ? 60 : 120,
      ),
      id,
      startedAt,
      timing,
    );

  if (!active) {
    if (pending) {
      if (command.type === 'start-break')
        return {
          active: breakSession(pending, wallAnchor, command.sessionId),
          cycle: nextCycle(count, null),
        };
      if (command.type === 'skip-break')
        return {
          active: null,
          cycle: nextCycle(pending === 'long' ? 0 : count, null),
        };
      return;
    }
    if (command.type === 'start')
      return {
        active: newActive(
          'timer',
          settings.focusDurationMinutes * 60_000,
          command.sessionId,
          wallAnchor,
          timing,
          context.task,
        ),
      };
    if (command.type === 'start-stopwatch')
      return {
        active: newActive(
          'stopwatch',
          null,
          command.sessionId,
          wallAnchor,
          timing,
          context.task,
        ),
      };
    return;
  }
  if (active.sessionId !== command.sessionId) return;

  const isBreak = active.type === 'short-break' || active.type === 'long-break';
  const target = active.plannedDurationMs;
  const elapsed = elapsedActiveMs(active, elapsedMs);
  const endedAt =
    active.resumedAt === null
      ? Date.parse(active.timing?.pausedAt ?? wallAnchor)
      : Date.parse(active.resumedAt) + elapsedMs;
  const fallback = active.timing ?? { timeZone: 'UTC', offsetMinutes: 0 };
  const record = (
    type: FocusSession['type'],
    status: FocusSession['status'],
    end: number,
    duration: number,
    attribution: Zone,
  ): FocusSession => {
    const when = new Date(
      Math.max(end, Date.parse(active.startedAt) + duration),
    );
    return {
      id: active.sessionId,
      type,
      status,
      startedAt: active.startedAt,
      endedAt: toIsoInstant(when),
      plannedDurationSeconds: target === null ? null : target / 1000,
      actualDurationSeconds: duration / 1000,
      ...completionDate(when, attribution),
      taskId: active.taskId,
      taskTitleSnapshot: active.taskTitleSnapshot,
    };
  };

  if (target !== null && active.resumedAt !== null && elapsed >= target) {
    if (isBreak)
      return {
        active: null,
        cycle: nextCycle(active.type === 'long-break' ? 0 : count, null),
      };
    const deadline =
      Date.parse(active.resumedAt) + target - active.accumulatedActiveMs;
    const completion = record(
      'timer',
      'completed',
      deadline,
      target,
      input.observedCompletion ? zone : fallback,
    );
    const kind =
      count + 1 >= settings.focusSessionsBeforeLongBreak ? 'long' : 'short';
    const automatic =
      settings.breakTransition === 'automatic' && input.observedCompletion;
    const breakDuration = safeMinutesMs(
      kind === 'short'
        ? settings.shortBreakDurationMinutes
        : settings.longBreakDurationMinutes,
      kind === 'short' ? 60 : 120,
    );
    const breakElapsed = Math.min(breakDuration, Math.max(0, elapsed - target));
    if (automatic && breakElapsed >= breakDuration)
      return {
        active: null,
        completion,
        cycle: nextCycle(kind === 'long' ? 0 : count + 1, null),
      };
    const automaticBreak = automatic
      ? breakSession(kind, completion.endedAt, revision)
      : null;
    if (automaticBreak?.timing)
      automaticBreak.timing.elapsedAtAnchorMs = breakElapsed;
    return {
      active: automaticBreak,
      completion,
      cycle: nextCycle(count + 1, automatic ? null : kind),
    };
  }
  if (command.type === 'skip-break' && isBreak)
    return {
      active: null,
      cycle: nextCycle(active.type === 'long-break' ? 0 : count, null),
    };
  if (command.type === 'discard' && !isBreak) return { active: null };
  if (command.type === 'save' && active.status === 'paused') {
    if (active.type === 'timer')
      return {
        active: null,
        completion: record(
          'timer',
          'partial',
          endedAt,
          elapsed,
          active.timing ?? zone,
        ),
      };
    if (active.type === 'stopwatch' && elapsed >= 1000)
      return {
        active: null,
        completion: record(
          'stopwatch',
          'completed',
          endedAt,
          elapsed,
          active.timing ?? zone,
        ),
      };
    return;
  }
  if (
    command.type === 'extend' &&
    active.type === 'timer' &&
    active.status === 'running' &&
    target !== null
  ) {
    const extended = target + 300_000;
    const deadline =
      Date.parse(active.resumedAt ?? active.startedAt) +
      extended -
      active.accumulatedActiveMs;
    if (
      !Number.isSafeInteger(extended) ||
      !Number.isSafeInteger(deadline) ||
      !Number.isFinite(new Date(deadline).getTime()) ||
      new Date(deadline).getUTCFullYear() > 9999
    )
      throw new RangeError('Timer deadline is outside the supported range');
    return {
      active: {
        ...active,
        plannedDurationMs: extended,
        timing: {
          ...timing,
          timeZone: fallback.timeZone,
          offsetMinutes: fallback.offsetMinutes,
          elapsedAtAnchorMs: elapsedMs,
        },
      },
    };
  }
  if (command.type === 'checkpoint' && active.status === 'running')
    return {
      active: {
        ...active,
        timing: {
          ...timing,
          timeZone: fallback.timeZone,
          offsetMinutes: fallback.offsetMinutes,
          elapsedAtAnchorMs: elapsedMs,
        },
      },
    };
  if (command.type === 'pause' && active.status === 'running')
    return {
      active: {
        ...active,
        status: 'paused',
        resumedAt: null,
        accumulatedActiveMs: elapsed,
        timing: { ...timing, pausedAt: toIsoInstant(new Date(endedAt)) },
      },
    };
  if (command.type === 'resume' && active.status === 'paused') {
    const earliest = Date.parse(active.timing?.pausedAt ?? active.startedAt);
    const resumed = Math.max(
      wall,
      earliest,
      Date.parse(active.startedAt) + active.accumulatedActiveMs,
    );
    return {
      active: {
        ...active,
        status: 'running',
        resumedAt: toIsoInstant(new Date(resumed)),
        timing,
      },
    };
  }
  return undefined;
}
