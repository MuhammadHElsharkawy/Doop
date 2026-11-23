# Doop — Milestone-Based Implementation Roadmap

**Version:** 1.0 · **Delivery model:** Responsive web MVP first; Capacitor feasibility spike early; native releases later.

## Delivery policy

Each milestone is an independently reviewable vertical slice. The agent must stop after completing its acceptance checks, summarize changes and test results, and wait for approval before the next milestone. No invented dates or delivery estimates. `PRD.md` remains authoritative for feature scope.

| Milestone | Scope | Main dependencies | Completion gate |
|---|---|---|---|
| M0 | Repository and engineering baseline | None | Build, tests and lint scripts run; docs committed |
| M1 | Design system, shell, i18n, settings foundation | M0 | Five routes, responsive navigation, six themes, RTL |
| M2 | Typed persistence, migrations, backup contracts | M0–M1 | Transaction and migration tests; safe storage failure UX |
| M3 | Tasks and shared TaskForm | M2 | Task CRUD, filters, completion, soft deletion; Overview entry |
| M4 | Habits and shared HabitForm | M2–M3 | Schedules, completion/undo, history, archive; Overview entry |
| M5 | Focus state-machine proof of concept + Capacitor spike | M1–M2 | Deterministic timer tests; real-device feasibility findings |
| M6 | Complete Pomodoro, breaks, Stopwatch, recovery | M5 | All timing, cycle and recovery edge cases tested |
| M7 | Focus history, task linking, daily goal, sounds | M3, M6 | Eligible counts, audio, session history and deletion consistent |
| M8 | Fully integrated Overview | M3–M4, M7 | All sections, shared forms, actions and metrics correct |
| M9 | Progress and settings completion | M4, M7–M8 | Date filters, accurate derived statistics, import/export |
| M10 | Release hardening and launch | All | QA matrix, accessibility, mobile browsers, backup restore, deploy |

**Scheduling note:** M5 should start as soon as a minimal app shell and persistence abstraction exist; it need not wait for M3/M4. This de-risks Capacitor and timer recovery before large feature investment.

## M0 — Repository baseline

**Deliver:** Initialize current compatible Angular + TypeScript project with strict compiler/template checks; configure Tailwind, formatter, linter, Vitest, Playwright, package scripts, CI build/test workflow and concise README. Place `PRD.md`, architecture, standards and roadmap under `docs/`; add agent guidance file(s).

**Acceptance:** clean install and build; a passing unit test; a passing browser smoke test; no feature placeholders pretending to work; lockfile committed. Verify versions from real registries/documentation at execution time.

## M1 — Shell and design foundation

**Deliver:** Overview/Tasks/Habits/Focus/Progress routes and Settings access; collapsible desktop sidebar and mobile bottom navigation; light/dark/system appearance; six semantic color themes including emerald and slate; persistent preferences; English/Arabic and RTL foundation; accessible shared dialog/sheet primitives. Placeholder content only where clearly marked.

**Acceptance:** navigate via keyboard; theme and language survive refresh; RTL works; viewport tests; no hardcoded palette values in feature components. Do not build feature business logic yet.

## M2 — Persistence and data contracts

**Deliver:** IndexedDB database and migrations; repositories/contracts for Tasks, Habits, schedule versions, completions, sessions, active session and settings; local date/time helpers; stable ID generation; typed import/export schema and validation foundation; storage error reporting.

**Acceptance:** isolated database tests for CRUD, uniqueness, migration, transaction failure, malformed backup, and soft-deletion behavior. Do not expose private records to network services.

## M3 — Tasks vertical slice

**Deliver:** One TaskForm used from Tasks and Overview; create/edit, complete/reopen, soft-delete, filters, sorting, due-date/overdue logic, optional expected sessions; persistence and empty states. Overview's task section may initially be a thin integration without final dashboard metrics.

**Acceptance:** all Task PRD behaviors; delete confirmation; task form returns to origin; date-only due dates correct; tests for filters and completion; Playwright add/edit/complete/delete.

## M4 — Habits vertical slice

**Deliver:** One HabitForm used from Habits and Overview; daily/selected weekday schedule, versioned schedule history, scheduled-day completion and undo, archive/restore, soft-delete, completion rate and recent history. All habits scheduled today appear in Overview, scrollable when needed.

**Acceptance:** uniqueness of `(habitId, localDate)`; no completion on unscheduled days; edits preserve historical denominators; archive/delete effective dates honored; weekday/RTL and date tests; Playwright completion from Overview.

## M5 — Focus engine proof of concept and mobile feasibility

**Deliver:** Pure clock-driven timer state machine and persisted active snapshot; minimal Pomodoro start/pause/resume/refresh; fake-clock unit tests. Create an isolated Capacitor feasibility branch/spike to check Android on device and iOS when Mac tooling is available; record OS suspension, persistence, audio and safe-area findings.

**Acceptance:** timer accuracy after tab suspension and refresh; idempotent completion proof; explicit findings in `docs/MOBILE-FEASIBILITY.md`. No full native feature parity or app-store release.

## M6 — Full Focus engine

**Deliver:** presets 25/45/60, custom 5 minutes–8 hours in 5-minute increments, add 5 minutes, early stop partial/discard/continue, automatic/manual break transitions, configurable short/long breaks and frequency, long-break skip resets cycle, short-break skip retains cycle, Stopwatch save/discard (minimum 1 second), closed-app recovery.

**Acceptance:** state transition table and exhaustive fake-clock tests; one active session; cycle persistence; no double save; midnight completion attribution; browser suspension limitations communicated. Cross-browser manual checks.

## M7 — History, goal, task association, ambient sounds

**Deliver:** optional task association; stable task-title snapshots; focus history filtering/deletion; daily goal (default six) and eligible session counting; Focus Time; task actual sessions; one-at-a-time ambient sounds with volume and licensed/original audio assets.

**Acceptance:** partial/discarded excluded; saved Stopwatch included in goal/time/task progress but excluded from Pomodoro cycle; deleting history updates derived metrics without changing cycle; no unauthorized sound assets; browser audio restrictions handled.

## M8 — Overview integration

**Deliver:** greeting/date, three summary metrics, up to five prioritized Today's Tasks, **all** Today's Habits, Focus Goal, quick actions Start Focus/Add Task/Add Habit, shared forms, completion/undo, responsive layout. Start Focus navigates to Focus without auto-starting.

**Acceptance:** no duplicate forms; task/habit changes update immediately; summary rules match PRD; mobile scrolling and empty states; Playwright complete task and habit directly from Overview.

## M9 — Progress, preferences and data management

**Deliver:** PRD-defined summary and date filters, focus/task/habit trends, clear data, validated JSON backup import/export with replacement confirmation, remaining timer and sound settings, shortcut documentation. Charts should be accessible and loaded only where needed.

**Acceptance:** derived totals reconcile with stored records, soft-deleted history, timezone/date boundary tests, imported backup roundtrip, malformed import leaves existing data intact, Clear All Data confirmation works.

## M10 — Quality and public web launch

**Deliver:** full acceptance checklist from PRD section 17; keyboard/accessibility review; Arabic RTL review; mobile-browser QA; performance and bundle review; production error UX; local-only privacy disclosure; backup guidance; deployment documentation; optional privacy-conscious aggregate telemetry only if separately approved.

**Acceptance:** all blocking tests pass; known limitations documented; successful production build and smoke test on deployed URL; launch checklist signed off. Do not promise native apps or cross-device sync at web launch.

## Explicit post-MVP roadmap (not authorized for current implementation)

**R2 — Native mobile:** Based on M5 feasibility, integrate Capacitor adapters and release Android/iOS with separate OS-level QA, background handling, platform policies, distribution and billing decisions.

**R3 — Conditional commercial services:** Evaluate accounts/sync, pricing, premium entitlements, subscriptions, privacy and consent based on actual retention and user demand. App-store billing policies and platform fees must be verified when this work starts.

## Risk register

| Risk | Impact | Mitigation / milestone |
|---|---|---|
| Timer runs across sleep, refresh, or app background | Wrong sessions/goals | Pure time model, fake clock, M5/M6 tests |
| IndexedDB data is cleared | User data loss | Local-only warning, versioned export/import, M2/M9 |
| Historical stats change after schedule edits | Misleading Progress | Effective-dated schedules and soft deletion, M4/M9 |
| Capacitor plugin or background behavior differs from browser | Mobile delay | Early real-device feasibility spike, M5 |
| Six themes × two languages × two appearance modes | Visual inconsistency | Semantic tokens, shared components, M1/M10 |
| AI agent overbuilds future business features | Cost and regressions | Milestone stop rule, explicit scope guard, reviews |
| No validated willingness to pay | Business risk | Ship web MVP, measure qualitative retention, defer billing |

## Milestone handoff template

```text
Milestone: Mx — [name]
Requirements covered: [PRD section numbers]
Implemented: [user-visible behavior]
Files changed: [paths]
Verification run: [commands and results]
Manual checks: [what was actually verified]
Open issues / assumptions: [explicit]
Scope deviations: [none or details]
Ready for review: [yes/no]
Next milestone (not started): [name]
```
