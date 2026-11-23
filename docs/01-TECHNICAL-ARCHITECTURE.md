# Doop — Technical Architecture

**Version:** 1.0 · **Status:** Implementation baseline · **Product authority:** `PRD.md` (v1.3)

## 1. Architecture decisions

| Concern | Decision | Rationale |
|---|---|---|
| Web framework | Angular (current stable release at project initialization), standalone APIs | Maintainable, typed, familiar, suitable for feature-rich web UI |
| Language | TypeScript, strict mode | Prevent inconsistent domain and persistence contracts |
| Styling | Tailwind CSS + semantic CSS custom properties | Fast composition; six selectable color families and light/dark/system appearance |
| UI state | Angular Signals; computed selectors; narrowly scoped services/facades | Simple reactive state without a mandatory global state library |
| Persistence | IndexedDB via a small, typed repository layer; lightweight preferences in localStorage only if justified | Structured local-first data, versioned upgrades |
| Tests | Vitest for unit/integration; Playwright for critical end-to-end flows | Fast deterministic checks and browser coverage |
| Internationalization | Angular-compatible runtime translation approach selected and documented in milestone 1 | English/Arabic switching and RTL without duplication |
| Web delivery | Static hosting with appropriate SPA fallback; avoid mandatory server runtime | Low-cost MVP deployment |
| Native delivery | Capacitor feasibility spike early; Android/iOS production release later | One web-first codebase where practical, validated platform behavior |
| Cloud/backend | None in MVP | Avoid premature auth, sync and operating costs |

**Version discipline:** Verify current package compatibility before installing. Record actual versions in package manifests and lockfile; do not invent or pin unverified versions in prompts.

## 2. Guiding boundaries

- `PRD.md` defines *what* and acceptance criteria; this document defines *how*. If they conflict, stop and flag the mismatch instead of silently changing product behavior.
- Feature UI never reads/writes IndexedDB directly. Domain calculations are pure functions, with dependencies passed explicitly.
- Persisted records are the source of truth. Aggregates are computed and cached only when safe; never persist competing totals.
- No implicit network transfer of task titles, habits or session history. Analytics instrumentation is **not** authorized in the MVP without a separate privacy decision.
- Prefer a modular monolith: one Angular application with feature boundaries, not microfrontends, microservices, or a premature monorepo.
- No production subscriptions, authentication or cloud sync in MVP. Keep interfaces replaceable, not speculative implementations.

## 3. Proposed folder structure

```text
src/
  app/
    app.config.ts
    app.routes.ts
    core/
      clock/                   # clock abstraction and local-date helpers
      database/                # IndexedDB open, migration, transactions
      persistence/             # repository interfaces + implementations
      domain/                  # shared domain types, IDs, invariants
      localization/            # language selection and RTL integration
      preferences/             # settings and theme state
      errors/                  # recoverable storage and app errors
    shared/
      ui/                      # dialog, form fields, buttons, confirmations
      forms/                   # reusable form helpers
      layout/                  # shell, sidebar, bottom navigation
      utilities/               # non-domain helpers only
    features/
      overview/
      tasks/
        domain/                # task rules and selectors
        data-access/           # task repository adapters
        application/           # task facade/use cases
        ui/                    # task form, list, filters
        pages/
      habits/
        domain/
        data-access/
        application/
        ui/
        pages/
      focus/
        domain/                # timer state machine and cycle rules
        data-access/
        application/
        ui/
        pages/
      progress/
      settings/
  assets/
    i18n/
    sounds/                    # only licensed/original assets
```

This is a target structure, not a mandate to create empty folders. Add files when they serve real use cases. Prefer `*.spec.ts` beside tested source files.

## 4. Dependency direction

```text
Pages / Presentational UI
         ↓
Application facades / use cases
         ↓
Pure domain rules + repository contracts
         ↑
IndexedDB repository implementations
```

- Feature-to-feature communication uses explicit use cases or shared read models, not imports between page components.
- Overview composes task, habit, and focus read models and calls their existing completion/create actions.
- Shared TaskForm and HabitForm are **one implementation each**, opened from Overview or the corresponding feature page. On desktop use an accessible dialog; on mobile a full-screen sheet is acceptable. Return to the originating page after save.
- Prefer route-level lazy loading for feature pages; dialogs can be lazy loaded where beneficial.

## 5. Domain model and persistence

Implement the entities and rules in PRD section 11. The schema should include stable IDs, schema version, and explicit timestamp/date-only semantics. Prefer storing dates as `YYYY-MM-DD` and instants as ISO timestamps. Store session completion's **local date and timezone offset at completion**, per PRD 12.4. Avoid locale-dependent parsing.

Suggested repository interfaces (illustrative contracts, not implementation):

```ts
interface TaskRepository {
  list(options?: { includeDeleted?: boolean }): Promise<Task[]>;
  get(id: string): Promise<Task | undefined>;
  save(task: Task): Promise<void>;
  softDelete(id: string, deletedAt: string): Promise<void>;
}

interface FocusSessionRepository {
  list(): Promise<FocusSession[]>;
  saveIfAbsent(session: FocusSession): Promise<boolean>;
  delete(id: string): Promise<void>;
}
```

Use transactions for multi-record updates (e.g., completion + cycle state + active-state cleanup). Enforce uniqueness for habit completion `(habitId, localDate)` and session ID; duplicate timer completion/recovery must be idempotent. Keep task/habit tombstones or snapshots as specified in PRD 12.5; clearing all data is the explicit full-erasure path. Schema upgrades must be tested with fixtures from prior versions.

### Data loss and backup

- Show a clear local-only storage warning and accessible export/import controls.
- JSON export contains format ID, format version, export timestamp, and supported entities/settings. Exclude transient sound playback state unless required.
- Validate the entire import before mutating local data; confirm replacement; apply atomically where possible; show actionable error on failure.
- Do not pretend that browser local storage automatically synchronizes with native storage. Design adapters and compatible export formats for later migration.

## 6. Time and focus engine

**Core design:** a pure, testable timer state machine + clock abstraction + persisted active-session snapshot. Never decrement a stored number once per interval as the source of truth.

States should explicitly cover `idle`, `running`, `paused`, `completion-pending`, `break-running`, and `break-paused` (or a well-documented equivalent). Stopwatch and Pomodoro are distinct modes; one active focus/break session at a time.

- Persist transitions with stable session IDs, mode, start/resume timestamps, accumulated active elapsed time, target duration/deadline, task association, and cycle context.
- Render time by comparing a clock to the persisted anchor; UI intervals only trigger repaint. Paused time must not accumulate.
- `Add 5 Minutes` extends the active focus target and deadline without losing elapsed time; repeatable.
- On reopening an expired running Pomodoro, complete exactly once at its planned deadline and show the next break decision. Do **not** start the next focus session while the app is closed.
- On reopening an expired break, mark it finished once and wait for user action.
- Stopwatch saved sessions require at least one second of active elapsed time; save/discard choice on stop.
- Naturally completed Pomodoro sessions advance the Pomodoro cycle. Saved Stopwatch sessions count toward the daily goal and focus time, **not** the cycle. Partial/discarded sessions do not count.
- **Skipped long break resets the cycle to zero.** Skipped short break preserves cycle count. Completed long break resets it too.
- Deleting an old focus history record changes derived statistics but never retroactively rewinds cycle state.
- Sessions spanning midnight belong entirely to the stored local date of `endedAt`.

**Time testing:** fake clock and deterministic timers; test pause/resume, multiple extensions, refresh/reopen, double recovery, clock changes, midnight, DST, long/short break skips, and task association.

**Browser limitation:** the MVP cannot guarantee background alarms, continuous audio, or precise notifications when the browser is suspended/closed. Correct elapsed time and recovery are required; do not claim always-on background execution. Capacitor feasibility tests must explicitly investigate app backgrounding, OS suspension and native notification capabilities.

## 7. Feature integration and derived read models

| Feature | Owns writes | Other consumers |
|---|---|---|
| Tasks | Task CRUD, complete/reopen, soft-delete | Overview task list, Progress, Focus task picker |
| Habits | Schedules, completion/undo, archive/delete | Overview all scheduled habits, Progress |
| Focus | Active state, history, break cycle | Overview goal/focus time, task actual sessions, Progress |
| Settings | Theme, language, timer preferences, backup | All relevant features |
| Overview | No duplicate task/habit forms or data stores | Aggregated selectors and feature actions |
| Progress | No independent event truth | Derived aggregates from persisted source records |

Avoid broad app-wide subscriptions that re-query the entire database on every tick. Update reactive snapshots after transactions and use computed selectors. Refresh day-scoped views on local day change and app resume.

## 8. Accessibility, design and localization

- Semantic HTML, keyboard access, focus management and restoration for dialogs, visible focus indicators, adequate contrast, reduced-motion support.
- Six **color families** (including emerald and slate) independent of appearance modes `light`, `dark`, `system`; use semantic CSS tokens, not hardcoded component colors.
- English and Arabic with correct RTL direction, translated validation, date/time display and icon mirroring when appropriate. Keep persisted enums/IDs language-neutral.
- Responsive desktop sidebar and mobile bottom navigation. A mobile browser layout is not the same as a native application.
- Respect the user's wish to let the coding agent choose minor visual details while keeping design tokens and accessibility consistent.

## 9. Quality, performance, security

- Enable TypeScript strictness and Angular template type checking.
- Test core domain logic independently of Angular and IndexedDB; integration-test repositories with isolated databases.
- Critical Playwright flows: add/edit/complete/delete task; schedule/complete habit; timer lifecycle; refresh recovery; stopwatch; theme/language; export/import.
- Measure bundle size and real mobile performance; lazy load routes and heavy charting/audio modules. No invented performance promises.
- Sanitize/escape user-generated text; avoid unsafe HTML injection. Validate imported JSON and cap sensible file size. Do not load untrusted scripts from third parties.
- Error UX must cover unavailable/quota-exceeded storage, failed imports, and corrupted records without silently losing data.

## 10. Capacitor feasibility milestone (early, not full mobile release)

After the app shell and a minimal timer proof of concept exist, create a disposable/isolated Capacitor spike. Validate: Android build on a real device, iOS build where macOS/Xcode access exists, background/resume timer accuracy, pause state, persistence, audio interruption, keyboard/safe areas, and navigation. Record results and blockers. **Do not ship native apps or add platform-specific complexity to every feature during the web MVP.** Native distribution requires store compliance and separate testing.

## 11. Deferred architectural decisions

Select and record only when needed: exact IndexedDB wrapper, localization library, charting library, Capacitor plugins, native persistence strategy, backend/auth provider, sync conflict resolution, billing provider, telemetry/consent model. Prefer evidence from a small spike over speculative infrastructure.

## 12. Architecture acceptance gate

Before feature delivery: strict build and tests pass; persistence adapter exists; timer has deterministic tests; one reusable creation form per entity; no feature writes directly to storage; no unauthorized backend or analytics; PRD requirements remain traceable to implementation milestones.
