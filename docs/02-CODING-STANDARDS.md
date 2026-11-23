# Doop — Coding Standards and AI Agent Rules

**Version:** 1.0 · **Applies to:** Codex, Claude Code, and human contributors · **Authority:** `PRD.md`, then `01-TECHNICAL-ARCHITECTURE.md` for technical design.

## 1. Agent operating rules

1. Read the relevant PRD sections, architecture and milestone acceptance criteria **before** modifying code.
2. Implement **only the current milestone**. Do not build future features, auth, cloud sync, billing, telemetry, or a native app without approval.
3. If a requirement is ambiguous or conflicts with another, report the specific conflict and propose a minimal resolution. Do not silently change product rules.
4. Before coding, briefly state the files/features affected and verification plan. For larger tasks, use a small plan and update it as work progresses.
5. Prefer small, reviewable changes and reuse existing patterns. Do not rewrite unrelated code or introduce unnecessary dependencies.
6. After coding, run available lint, typecheck/build and relevant tests. State what passed, what failed, and what was not run; never claim unexecuted tests passed.
7. End each milestone with: implementation summary, changed files, tests and results, known limitations, and next milestone. Do not start the next milestone automatically.
8. Never invent API endpoints, secrets, package versions, licensing, payment integrations or unavailable OS behavior.

## 2. TypeScript and Angular

- Use strict typing; avoid `any`, non-null assertions and unchecked casts. Use `unknown` for untrusted data and narrow it through validation.
- Prefer standalone components, Angular Signals and `computed` for synchronous derived UI state. Use RxJS for genuinely asynchronous streams when appropriate; avoid redundant mirrored state.
- Use `inject()` consistently; keep lifecycle cleanup explicit with supported Angular patterns.
- Keep components focused on rendering and interaction. Domain calculations belong in pure functions; orchestration in facades/use cases; persistence in repositories.
- Prefer `readonly` for injected dependencies and signals whose references should not be reassigned; do not use it where mutation is intentionally required.
- Use lazy feature routes and clear dependency boundaries. No imports from another feature's `pages/` or private UI internals.
- Do not mutate signal-held arrays/objects in place. Use immutable updates for state changes.
- Do not store redundant derived metrics as independent mutable signals when they can be computed.
- Favor semantic templates and built-in Angular control flow; keep template expressions simple.

## 3. Naming and file conventions

- File names: `kebab-case`; components: `*.component.ts`; services: `*.service.ts`; facades: `*.facade.ts`; repositories: `*.repository.ts`; tests: `*.spec.ts`.
- Types/interfaces: `PascalCase`; values/functions: `camelCase`; constants: `UPPER_SNAKE_CASE` only for genuine global constants.
- Use descriptive domain names: `completedLocalDate`, `plannedDurationMs`, `accumulatedActiveMs`; avoid vague `data`, `item`, `handleStuff`.
- Keep one clear responsibility per module; extract shared abstractions only after a real second use.
- Avoid giant generic `utils.ts`, god facades, and nested conditionals that hide business rules.

## 4. Domain correctness

- Implement time calculations using milliseconds and explicit timestamp anchors; UI ticks are not authoritative.
- Store date-only fields separately from instants. Avoid using UTC date conversion as a substitute for local calendar dates.
- Completion, import and recovery must be idempotent where specified. Use stable IDs and unique constraints/transactions.
- Keep soft-deleted task/habit historical snapshots for accurate Progress; no silent hard-delete.
- Never count partial/discarded Timer sessions in daily goal, focus time, task actual sessions, or Pomodoro cycle.
- Saved Stopwatch counts toward focus metrics and task sessions but not the Pomodoro cycle.
- A skipped long break resets the cycle; a skipped short break does not.
- Do not duplicate TaskForm/HabitForm for Overview. Open the same form and return to the original context.

## 5. Styling, accessibility and i18n

- Use semantic CSS variables for surfaces, text, borders, accents and states. Six color families × light/dark/system appearance are separate concepts.
- Use Tailwind utilities for layout and composition; do not sprinkle raw palette hex codes throughout feature components.
- Support keyboard navigation, correct labels, focus trapping/restoration in dialogs, reduced motion, meaningful empty/loading/error states.
- Use translated UI strings; no hardcoded English strings in feature templates after localization foundation is introduced.
- Test Arabic RTL and English LTR for navigation, dialogs, date formats and icon alignment.
- Do not introduce animation or decoration that distracts from focus workflows.

## 6. Data safety and privacy

- No external transfer of private productivity data without an explicit approved requirement.
- Validate all imported data against a versioned schema before applying any mutation; fail safely and preserve existing data.
- Escape user content, avoid unsafe HTML rendering, never log personal task/habit titles in production diagnostics.
- Treat local storage failure as a visible error, not a silent success. Document local-only data loss risk.
- No secrets in source code or committed configuration; use environment configuration only when necessary.

## 7. Testing expectations

| Change type | Minimum test coverage |
|---|---|
| Pure domain rule | Deterministic unit tests incl. boundary and invalid cases |
| Repository/schema | CRUD, uniqueness, migration, rollback/import tests |
| Timer/break engine | Fake-clock tests: pause/resume, refresh, double completion, skip, midnight |
| Cross-feature integration | Integration tests for derived stats and shared actions |
| Critical user flow | Playwright test at desktop and mobile viewport where relevant |
| Accessibility-sensitive UI | Keyboard and focus assertions; manual screen-reader spot check where possible |

A feature is not done because its happy path works. Cover at least one failure/empty-state path and relevant edge cases.

## 8. Commands and dependencies

- Use the package manager selected at initialization; commit its lockfile. Do not mix npm/pnpm/yarn lockfiles.
- Use standard scripts such as `dev`, `build`, `test`, `lint`, `e2e`, `typecheck` where supported; document the actual commands in the repository README.
- Prefer official maintained packages; check framework compatibility and licenses before installing.
- Add dependencies only for clear needs, and explain their tradeoffs. No unnecessary global state libraries, backend frameworks, or component suites.
- Run formatter and linter before finalizing changes. Never suppress type or lint errors without a documented reason.

## 9. Definition of Done — per milestone

- [ ] Meets all assigned PRD acceptance criteria and the milestone checklist.
- [ ] Domain logic is separate from UI and persistence.
- [ ] Relevant unit/integration/E2E tests are present and passing.
- [ ] Build and typecheck pass; lint passes if configured.
- [ ] Mobile viewport and keyboard interactions checked where applicable.
- [ ] No unauthorized scope additions or third-party data transmission.
- [ ] Documentation updated for architectural decisions and user-visible limitations.
- [ ] Agent reports what was tested and what remains unverified.

## 10. Review checklist

Review for: duplicate sources of truth; time-zone/date bugs; missing cleanup; race conditions and duplicate saves; storage transaction safety; keyboard traps; hardcoded colors/translations; hidden network requests; overengineering; accidental scope expansion; test assertions that only test mocks instead of behavior.
