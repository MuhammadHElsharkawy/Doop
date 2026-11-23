import type { LocalDate } from '../clock/local-date';
import type { FocusSession } from './workspace-records';

export const defaultDailyFocusGoal = 6;

export function countsTowardFocus(session: FocusSession): boolean {
  return session.status === 'completed';
}

export function dailyFocus(sessions: readonly FocusSession[], date: LocalDate) {
  let count = 0;
  let seconds = 0;
  for (const session of sessions) {
    if (session.completionLocalDate === date && countsTowardFocus(session)) {
      count++;
      seconds += session.actualDurationSeconds;
    }
  }
  return { count, seconds };
}

export function selectFocusHistory(
  sessions: readonly FocusSession[],
  date: LocalDate | null,
): FocusSession[] {
  return sessions
    .filter((session) => date === null || session.completionLocalDate === date)
    .sort(
      (a, b) => b.endedAt.localeCompare(a.endedAt) || a.id.localeCompare(b.id),
    );
}
