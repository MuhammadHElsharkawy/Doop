import { isIsoInstant, type IsoInstant } from '../clock/local-date';
import type { WorkspaceRecords } from '../domain/workspace-records';
import { validScheduleHistory } from '../domain/habit-history';
import type { Preferences } from '../preferences/preferences.service';
import {
  choice,
  isPreferences,
  isLegacyHabitRecord,
  list,
  nullable,
  object,
  recordValidators,
  upgradeLegacyHabit,
} from './record-validation';

export interface BackupV2 {
  format: 'doop-backup';
  version: 2;
  exportedAt: IsoInstant;
  tasks: WorkspaceRecords['tasks'][];
  habits: WorkspaceRecords['habits'][];
  schedules: WorkspaceRecords['schedules'][];
  completions: WorkspaceRecords['completions'][];
  sessions: WorkspaceRecords['sessions'][];
  settings: {
    preferences: Preferences;
    workspace: WorkspaceRecords['settings'] | null;
  };
}

const backupFields = {
  format: choice('doop-backup' as const),
  exportedAt: isIsoInstant,
  tasks: list(recordValidators.tasks),
  schedules: list(recordValidators.schedules),
  completions: list(recordValidators.completions),
  sessions: list(recordValidators.sessions),
  settings: object<BackupV2['settings']>({
    preferences: isPreferences,
    workspace: nullable(recordValidators.settings),
  }),
};

const isBackup = object<BackupV2>({
  ...backupFields,
  version: choice(2),
  habits: list(recordValidators.habits),
});
type LegacyBackup = Omit<BackupV2, 'version' | 'habits'> & {
  version: 1;
  habits: Omit<WorkspaceRecords['habits'], 'deletedLocalDate'>[];
};
const isLegacyBackup = object<LegacyBackup>({
  ...backupFields,
  version: choice(1),
  habits: list(isLegacyHabitRecord),
});

const maxBytes = 10 * 1024 * 1024;

export type BackupDecodeResult =
  | { ok: true; backup: BackupV2 }
  | {
      ok: false;
      reason:
        'too-large' | 'invalid-json' | 'unsupported-version' | 'invalid-data';
    };

export function decodeBackup(json: string): BackupDecodeResult {
  if (
    json.length > maxBytes ||
    new TextEncoder().encode(json).length > maxBytes
  ) {
    return { ok: false, reason: 'too-large' };
  }

  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'format' in value &&
    value.format === 'doop-backup' &&
    'version' in value &&
    value.version !== 1 &&
    value.version !== 2
  ) {
    return { ok: false, reason: 'unsupported-version' };
  }

  if (isLegacyBackup(value)) {
    try {
      value = {
        ...value,
        version: 2,
        habits: value.habits.map(upgradeLegacyHabit),
      };
    } catch {
      return { ok: false, reason: 'invalid-data' };
    }
  }

  if (!isBackup(value) || !hasValidCollections(value))
    return { ok: false, reason: 'invalid-data' };
  return { ok: true, backup: value };
}

export function encodeBackup(backup: BackupV2): string {
  if (!isBackup(backup) || !hasValidCollections(backup))
    throw new TypeError('Invalid backup');
  const json = JSON.stringify(backup);
  if (
    json.length > maxBytes ||
    new TextEncoder().encode(json).length > maxBytes
  ) {
    throw new RangeError('Backup exceeds size limit');
  }
  return json;
}

function hasValidCollections(backup: BackupV2): boolean {
  const { tasks, habits, schedules, completions, sessions } = backup;
  const collections: (readonly { id: string }[])[] = [
    tasks,
    habits,
    schedules,
    completions,
    sessions,
  ];
  if (
    !collections.every(
      (records) => new Set(records.map(({ id }) => id)).size === records.length,
    )
  )
    return false;
  if (
    new Set(
      completions.map(({ habitId, scheduledDate }) =>
        JSON.stringify([habitId, scheduledDate]),
      ),
    ).size !== completions.length
  )
    return false;

  return validScheduleHistory(habits, schedules);
}
