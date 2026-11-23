# Doop — Implementation Package

This package is designed for either Codex or Claude Code. It contains the full product requirements plus the architecture, coding rules and stepwise roadmap.

## Contents

- `PRD.md`: Doop Product Requirements Document v1.3 (product authority).
- `01-TECHNICAL-ARCHITECTURE.md`: Angular web-first design, data boundaries, timer architecture and Capacitor spike.
- `02-CODING-STANDARDS.md`: coding, testing, accessibility, privacy and agent operating rules.
- `03-IMPLEMENTATION-ROADMAP.md`: milestones M0–M10 with acceptance gates.
- `AGENTS.md`: concise instructions for coding agents; keep at repository root.
- `FIRST-AGENT-PROMPT.md`: copyable prompt for the first coding session.

## How to use

1. Create an empty Doop Git repository.
2. Put `AGENTS.md` at repository root and the other files in `docs/`. Update the paths in `AGENTS.md` to use `docs/` (or keep a copy in root if preferred).
3. Start Codex or Claude Code in the repository and paste `FIRST-AGENT-PROMPT.md`.
4. Review M0 before approving M1. Work through milestones sequentially, except the early Capacitor feasibility spike can be scheduled once prerequisites exist.
5. Preserve PRD v1.3 as the product authority; record approved changes explicitly in a later version.

## Business note

The web MVP is local-first. Native mobile distribution and cross-device sync are future releases. Monetization and analytics are *not* included by default; these require separate product/privacy decisions once real user feedback is available.
