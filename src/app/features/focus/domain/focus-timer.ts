import { isLocalDate, toIsoInstant } from '../../../core/clock/local-date';
import type {
  ActiveSession,
  ActiveTimerTiming,
  FocusSession,
} from '../../../core/domain/workspace-records';

export const focusDurationMs = 25 * 60_000;
export type TimerCommand = {
  type: 'start' | 'pause' | 'resume' | 'recover' | 'checkpoint';
  sessionId: string;
};
export type TimerChange = {
  active: ActiveSession | null;
  completion?: FocusSession;
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

export function transitionTimer(
  active: ActiveSession | undefined,
  command: TimerCommand,
  input: TimerInput,
): TimerChange | undefined {
  const { wall, elapsedMs, zone, revision } = input;
  const wallAnchor = toIsoInstant(new Date(wall));
  const timing: ActiveTimerTiming = {
    ...zone,
    revision,
    wallAnchor,
    elapsedAtAnchorMs: 0,
    pausedAt: null,
  };
  if (command.type === 'start') {
    if (active) return;
    return {
      active: {
        id: 'active',
        sessionId: command.sessionId,
        type: 'timer',
        status: 'running',
        startedAt: wallAnchor,
        resumedAt: wallAnchor,
        accumulatedActiveMs: 0,
        plannedDurationMs: focusDurationMs,
        taskId: null,
        taskTitleSnapshot: null,
        timing,
      },
    };
  }
  if (
    active?.type !== 'timer' ||
    active.sessionId !== command.sessionId ||
    active.plannedDurationMs === null
  )
    return;

  const remaining = remainingMs(active, elapsedMs);
  if (active.resumedAt !== null && remaining === 0) {
    const deadline = new Date(
      Date.parse(active.resumedAt) +
        active.plannedDurationMs -
        active.accumulatedActiveMs,
    );
    const seconds = active.plannedDurationMs / 1000;
    const attribution = input.observedCompletion
      ? zone
      : (active.timing ?? { timeZone: 'UTC', offsetMinutes: 0 });
    return {
      active: null,
      completion: {
        id: active.sessionId,
        type: 'timer',
        status: 'completed',
        startedAt: active.startedAt,
        endedAt: toIsoInstant(deadline),
        plannedDurationSeconds: seconds,
        actualDurationSeconds: seconds,
        ...completionDate(deadline, attribution),
        taskId: active.taskId,
        taskTitleSnapshot: active.taskTitleSnapshot,
      },
    };
  }
  if (command.type === 'checkpoint' && active.status === 'running') {
    const fallback = active.timing ?? { timeZone: 'UTC', offsetMinutes: 0 };
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
  }
  if (command.type === 'pause' && active.resumedAt !== null) {
    return {
      active: {
        ...active,
        status: 'paused',
        resumedAt: null,
        accumulatedActiveMs: active.plannedDurationMs - remaining,
        timing: {
          ...timing,
          pausedAt: toIsoInstant(
            new Date(Date.parse(active.resumedAt) + elapsedMs),
          ),
        },
      },
    };
  }
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
