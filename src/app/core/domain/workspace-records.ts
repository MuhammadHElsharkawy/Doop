import type { IsoInstant, LocalDate } from '../clock/local-date';

interface HistoricalRecord {
  id: string;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
  deletedAt: IsoInstant | null;
}

export interface Task extends HistoricalRecord {
  title: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: LocalDate | null;
  expectedSessions: number | null;
  status: 'pending' | 'completed';
  completedAt: IsoInstant | null;
}

export interface Habit extends HistoricalRecord {
  name: string;
  description: string | null;
  startDate: LocalDate;
  status: 'active' | 'archived';
  archivedAt: IsoInstant | null;
  deletedLocalDate: LocalDate | 'unknown' | null;
  archivePeriods: { from: LocalDate; until: LocalDate | null }[];
}

export const weekdays = [0, 1, 2, 3, 4, 5, 6] as const;

export interface HabitSchedule {
  id: string;
  habitId: string;
  weekdays: (typeof weekdays)[number][];
  effectiveFrom: LocalDate;
  effectiveTo: LocalDate | null;
  createdAt: IsoInstant;
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  habitNameSnapshot: string;
  scheduledDate: LocalDate;
  completedAt: IsoInstant;
}

interface TaskAssociation {
  taskId: string | null;
  taskTitleSnapshot: string | null;
}

export interface FocusSession extends TaskAssociation {
  id: string;
  type: 'timer' | 'stopwatch';
  plannedDurationSeconds: number | null;
  actualDurationSeconds: number;
  startedAt: IsoInstant;
  endedAt: IsoInstant;
  completionLocalDate: LocalDate;
  completionTimezoneOffsetMinutes: number;
  status: 'completed' | 'partial';
}

export interface ActiveTimerTiming {
  revision: string;
  pausedAt: IsoInstant | null;
  wallAnchor: IsoInstant;
  elapsedAtAnchorMs: number;
  timeZone: string | null;
  offsetMinutes: number;
}

export interface ActiveSession extends TaskAssociation {
  id: 'active';
  sessionId: string;
  type: FocusSession['type'] | 'short-break' | 'long-break';
  status: 'running' | 'paused';
  startedAt: IsoInstant;
  resumedAt: IsoInstant | null;
  accumulatedActiveMs: number;
  plannedDurationMs: number | null;
  timing?: ActiveTimerTiming;
}

export interface PomodoroCycle {
  id: 'cycle';
  completedFocusSessions: number;
  pendingBreak: 'short' | 'long' | null;
  revision?: string;
}

export interface WorkspaceSettings {
  id: 'settings';
  weekStartsOn: 0 | 1 | 6 | null;
  dailyGoal: number;
  focusDurationMinutes: number;
  shortBreakDurationMinutes: number;
  longBreakDurationMinutes: number;
  focusSessionsBeforeLongBreak: number;
  breakTransition: 'automatic' | 'manual';
  ambientSound: 'rain' | 'coffee-shop' | 'ocean-waves' | 'forest' | null;
  ambientVolume: number;
}

export interface WorkspaceRecords {
  tasks: Task;
  habits: Habit;
  schedules: HabitSchedule;
  completions: HabitCompletion;
  sessions: FocusSession;
  activeSession: ActiveSession;
  cycle: PomodoroCycle;
  settings: WorkspaceSettings;
}
