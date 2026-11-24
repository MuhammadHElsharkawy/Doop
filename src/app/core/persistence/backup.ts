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

export const maxBackupBytes = 64 * 1024 * 1024;
const maxBackupStructure = 2_000_000;
const maxBackupDepth = 16;

export type BackupDecodeResult =
  | { ok: true; backup: BackupV2 }
  | {
      ok: false;
      reason:
        | 'too-large'
        | 'resource-limit'
        | 'invalid-json'
        | 'unsupported-version'
        | 'invalid-data';
    };

export function decodeBackup(json: string): BackupDecodeResult {
  if (
    json.length > maxBackupBytes ||
    (json.length > maxBackupBytes / 3 &&
      new TextEncoder().encode(json).length > maxBackupBytes)
  ) {
    return { ok: false, reason: 'too-large' };
  }

  if (exceedsStructureLimit(json))
    return { ok: false, reason: 'resource-limit' };

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

function exceedsStructureLimit(json: string): boolean {
  let depth = 0;
  let structure = 0;
  let quoted = false;
  for (let index = 0; index < json.length; index++) {
    const character = json.charCodeAt(index);
    if (character === 34) quoted = !quoted;
    else if (quoted && character === 92) index++;
    else if (!quoted) {
      if (character === 91 || character === 123) {
        if (++depth > maxBackupDepth) return true;
        structure++;
      } else if (character === 93 || character === 125) depth--;
      else if (character === 44 || character === 58) structure++;
      if (structure > maxBackupStructure) return true;
    }
  }
  return false;
}

export function encodeBackup(backup: BackupV2): string {
  assertValidBackup(backup);
  return JSON.stringify(backup);
}

export function assertValidBackup(value: unknown): asserts value is BackupV2 {
  if (!isBackup(value) || !hasValidCollections(value))
    throw new TypeError('Invalid backup');
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
