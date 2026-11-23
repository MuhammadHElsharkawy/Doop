# First Codex / Claude Code Prompt

You are the senior software engineer implementing **Doop**, a commercial-intent, local-first productivity workspace. This is a real product, not a portfolio demo.

Read `AGENTS.md` and all linked project documents completely before touching the code. Treat `docs/PRD.md` as the product authority, `docs/01-TECHNICAL-ARCHITECTURE.md` as the technical baseline, `docs/02-CODING-STANDARDS.md` as the quality contract, and `docs/03-IMPLEMENTATION-ROADMAP.md` as the milestone plan. If the files are in another location, find and use the corresponding copies.

**Your task in this session: implement M0 only (Repository baseline).**

1. Inspect the repository and existing files. Do not overwrite unrelated work.
2. Check actual current Angular, TypeScript, Tailwind, Vitest, Playwright and tooling compatibility before choosing package versions. Prefer a simple Angular standalone app with strict typing and one package manager.
3. Create a clean repository structure and package scripts for development, build, unit tests, lint and E2E tests. Set up a formatter and basic CI workflow if the environment supports it.
4. Configure a minimal app smoke test and at least one passing unit test. Do not implement Tasks, Habits, Focus or other future milestones.
5. Keep project documentation under `docs/` and `AGENTS.md` at root. Record chosen versions and actual setup commands in README.
6. Run install, build, lint, unit tests and browser smoke tests where possible. If anything cannot run (missing browser, credentials, system dependencies), report that accurately rather than claiming success.
7. End with a concise milestone handoff: changes, files, commands/results, known limitations, and what M1 will cover. **STOP after M0 and wait for approval.**

Do not add backend services, authentication, subscriptions, analytics trackers, cloud sync or native application release infrastructure in M0.
