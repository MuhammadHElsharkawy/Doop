# Persistence and backup contracts

M2 stores workspace records in the browser's `doop-workspace` IndexedDB database. Clearing site data can erase local records and preferences. The workspace database uses the typed `idb` adapter. Vitest uses `fake-indexeddb` to exercise migrations and transactions with isolated databases. Browser tests use native IndexedDB.

## Schema

- Version 1 creates the task, habit, schedule, completion, focus history, active session, cycle, and settings stores.
- Version 2 adds a unique index on habit ID and scheduled local date. The upgrade and index are transactional. Existing duplicate occurrences cause the upgrade to fail with the previous data intact.
- Version 3 adds a schedule index by habit and validates legacy schedule relationships and intervals in the upgrade transaction. Orphaned or overlapping legacy schedules abort the upgrade and retain the original version and rows. Previously valid historical schedules, including schedules for retained habit tombstones, are preserved.
- Tasks and habits use tombstones. Active lists hide deleted records, while history retains task and habit name snapshots. Habit archive periods preserve the effective local dates needed for later reporting.
- Habit deletion stores both the UTC instant and the effective local date. The archive and deletion boundaries are exclusive cutoffs for activity. Historical calculations use the stored date through `habitActivityOn`. Legacy habits with a deletion instant and no original local date are marked `unknown`. Reporting must keep that uncertainty rather than infer a cutoff from the current zone.
- Active session, cycle, and workspace settings use singleton IDs. Focus history uses a stable per-session ID. Session eligibility is derived from type and outcome when later features calculate metrics.
- Records distinguish local calendar dates from UTC ISO instants. Completion dates and UTC offsets are saved together for historical reporting. Weekday numbers follow JavaScript's Sunday-zero convention. New IDs use the browser's secure-context UUID generator.

## Application integration

Components use the persistence service and repositories. Repository operations resolve after their IndexedDB transactions complete. Multi-store transactions must await only database requests while the transaction is active. The shell reports unavailable storage, blocked upgrades, and failed operations. Repository reads detect invalid records without dropping or rewriting them.

Task edits, completion, reopen, and undo update the current row inside a write transaction. Deleted tasks stay in storage for historical reporting and cannot be edited or reopened. Sort and filter choices use the local `doop.tasks.view` preference key. They are presentation choices outside the workspace backup.

The M1 appearance, theme, and language preferences remain in the existing localStorage adapter so the shell can apply them synchronously. Workspace settings such as timer preferences use IndexedDB. A failure in either storage system has its own notice.

Schedule writes require an existing habit without a tombstone. Replacement closes the current interval and inserts the next one within one transaction. Its effective date must be later than the current interval's start. Adjacent intervals are valid.

The shell distinguishes connection, migration, read, invalid-record, quota, and other write failures. Retrying a read reruns validation. Writes require repeating the original action and clear its warning after the matching transaction commits.

Focus history uses elapsed active seconds and the effective Timer target after any extensions. Completed Timer elapsed time must be positive and within less than one second of the target. Partial Timer time must be below the target. Stopwatch records require a completed outcome, no target, and at least one second of active time. The wall-clock interval may include pauses. Active time cannot exceed it by one second or more.

## JSON backup

The version 2 contract uses the `doop-backup` format identifier and includes an export timestamp, durable productivity collections, workspace settings, and appearance preferences. It carries the habit deletion-date field. The decoder upgrades valid version 1 payloads in memory using the same unknown-date policy. Active session and cycle state stay outside the backup. A readonly transaction captures the IndexedDB portion as one snapshot.

The decoder checks the full envelope and record shapes, duplicate keys and habit occurrences, schedule references and overlaps, and a 10 MiB UTF-8 limit. It returns a validated payload or a reason for failure without writing records.

M9 owns file selection, replacement confirmation, applying imports, export downloads, and clear-data controls. When implementing replacement, coordinate the IndexedDB transaction and appearance preferences before reporting success.
