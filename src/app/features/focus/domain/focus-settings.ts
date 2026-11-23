import type { WorkspaceSettings } from '../../../core/domain/workspace-records';

export const defaultFocusSettings: WorkspaceSettings = {
  id: 'settings',
  weekStartsOn: null,
  dailyGoal: 6,
  focusDurationMinutes: 25,
  shortBreakDurationMinutes: 5,
  longBreakDurationMinutes: 15,
  focusSessionsBeforeLongBreak: 4,
  breakTransition: 'automatic',
  ambientSound: null,
  ambientVolume: 100,
};

export type BreakSettings = Pick<
  WorkspaceSettings,
  | 'shortBreakDurationMinutes'
  | 'longBreakDurationMinutes'
  | 'focusSessionsBeforeLongBreak'
  | 'breakTransition'
>;

export function validFocusMinutes(minutes: number): boolean {
  return minutes >= 5 && minutes <= 480 && minutes % 5 === 0;
}

export function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function validBreakSetting(value: number, max: number): boolean {
  return positiveInteger(value) && value <= max;
}

export function safeMinutesMs(minutes: number, maximum: number): number {
  if (!validBreakSetting(minutes, maximum))
    throw new RangeError('Invalid duration');
  const duration = minutes * 60_000;
  if (!Number.isSafeInteger(duration)) throw new RangeError('Invalid duration');
  return duration;
}
