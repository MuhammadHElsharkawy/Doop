# Doop — AI Coding Agent Entry Point

Read in this order before implementing anything:

1. `docs/PRD.md` — source of truth for product behavior and acceptance criteria.
2. `docs/01-TECHNICAL-ARCHITECTURE.md` — architecture and technical boundaries.
3. `docs/02-CODING-STANDARDS.md` — quality and agent operating rules.
4. `docs/03-IMPLEMENTATION-ROADMAP.md` — current milestone and acceptance gate.

**Critical:** Implement one milestone at a time. Do not silently modify product rules or add authentication, subscriptions, cloud sync, telemetry or native app release to the web MVP. At the end of each milestone, report actual verification results and STOP for approval. Do not treat tests as passed unless executed.

**Product invariants:** One shared TaskForm and one shared HabitForm across Overview and their feature pages. Skipping a long break resets the Pomodoro cycle. Saved Stopwatch counts toward focus metrics, not Pomodoro cycle. Partial/discarded Timer sessions do not count. All today's scheduled habits appear on Overview. Six color themes independent of light/dark/system. Local-first data; no cross-device sync promise.

Keep this file at repository root and the referenced documents under `docs/`.
