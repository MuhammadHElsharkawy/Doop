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

M4 creates the habit and initial schedule together. Edits commit habit details and the schedule change together. Edited weekdays apply from the current local date, or from the habit's start date if it is still in the future. If an older version covers today, it closes at today's exclusive boundary. Versions beginning today or later are superseded, including pending changes saved under the earlier next-day rule. Repeated edits on the same date update the version in place. Eligibility before today remains intact. The start date stays fixed once the habit has begun.

Schedule edits do not write to the completion store. History keeps all completion snapshots, while completion rates count a record only when its date is eligible under the effective schedule and habit activity rules. Restoring eligibility makes the same record count again. Archive and restore open and close a local-date interval. Completion writes check the live habit, effective schedule, and unique occurrence in the same transaction. Undo checks the stored occurrence ID. Archived and deleted habits retain completion snapshots.

The shell distinguishes connection, migration, read, invalid-record, quota, and other write failures. Retrying a read reruns validation. Writes require repeating the original action and clear its warning after the matching transaction commits.

Focus history uses elapsed active seconds and the effective Timer target after any extensions. Completed Timer elapsed time must be positive and within less than one second of the target. Partial Timer time must be below the target. Stopwatch records require a completed outcome, no target, and at least one second of active time. The wall-clock interval may include pauses. Active time cannot exceed it by one second or more.

M5 uses the existing active-session singleton. Its optional timer metadata stores a revision, pause timestamp, wall-clock recovery anchor, elapsed time at that anchor, and a time zone with a fixed-offset fallback. Older snapshots remain readable when their anchors are consistent. They acquire metadata on their next write. The database version and backup format stay at versions 3 and 2 respectively. Active timers remain outside backups.

A resumed timestamp and accumulated active milliseconds derive the exact UTC deadline. Live documents advance elapsed time with a monotonic clock and re-anchor wall-clock recovery when the clocks disagree by at least one second. The checkpoint preserves both observed elapsed time and the UTC deadline. A reopened document seeds its monotonic clock once from persisted wall-clock elapsed time. Paused time never accrues.

The write transaction compares the expected snapshot revision before applying a transition. It inserts history by stable session ID, advances the cycle for a new record, and clears the active snapshot atomically. Cross-tab commit notifications invalidate the local snapshot. Receivers reread IndexedDB after notifications, on foregrounding, and periodically while visible. With BroadcastChannel available, a reopened document briefly gives live peers a chance to checkpoint contrary monotonic evidence before completing from wall time. Invalid active snapshots remain in storage and block timer recovery without an automatic retry loop.

Observed completion uses the device zone during observation. Unobserved completion uses the running segment's persisted zone and the offset in effect at its UTC deadline. If only an offset was captured, it remains fixed. Legacy snapshots without either zone or offset use UTC for unobserved completion.

M6 extends the existing timing metadata to breaks and Stopwatch. The cycle can carry an optional revision, and existing unversioned cycle rows are still readable. Focus settings use the existing workspace settings row. Timer mutations read those settings and check both active and cycle revisions in the transaction. Focus completion, cycle advancement, and any automatic break snapshot commit together. Partial focus and completed Stopwatch history preserve the effective target and measured elapsed time respectively. A stopped session uses its saved pause instant for the history end time. Active sessions and cycle data remain outside backups. Database and backup versions stay at 3 and 2.

Short breaks are limited to 1–60 minutes, long breaks to 1–120 minutes, and the long-break frequency to 1–12 sessions. Backup decoding rejects out-of-range settings. Existing settings rows written under earlier rules are read with the affected out-of-range values replaced by their defaults. Other preferences are preserved. The repaired row is committed alongside the next successful Focus transition or settings save.

Focus start resolves the optional task ID against the latest non-deleted task in the timer transaction. It stores a title snapshot on the active session. History uses the title at save time, including a valid task tombstone. If the task record is missing or unreadable, history keeps the start snapshot. Later task edits or deletion leave saved history intact.

Focus and Tasks derive counts from completed history records. Daily metrics and history date filters use the stored local completion date. History shows the end time at its recorded offset and the start instant in the viewer’s local time zone because the history format does not store a start offset. History deletion removes only the history row. Commit notifications refresh the shared history in open tabs and views refresh again when foregrounded. The daily goal, sound selection, and volume use the existing workspace settings fields. Audio playback state stays in memory. Database and backup versions stay at 3 and 2.

## JSON backup

The version 2 contract uses the `doop-backup` format identifier and includes an export timestamp, durable productivity collections, workspace settings, and appearance preferences. It carries the habit deletion-date field. The decoder upgrades valid version 1 payloads in memory using the same unknown-date policy. Active session and cycle state stay outside the backup. A readonly transaction captures the IndexedDB portion as one snapshot.

The decoder checks the full envelope and record shapes, duplicate keys and habit occurrences, schedule references and overlaps, and a 10 MiB UTF-8 limit. It returns a validated payload or a reason for failure without writing records.

M9 owns file selection, replacement confirmation, applying imports, export downloads, and clear-data controls. When implementing replacement, coordinate the IndexedDB transaction and appearance preferences before reporting success.
