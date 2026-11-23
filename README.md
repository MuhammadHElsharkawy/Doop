# Doop

Doop is a local-first productivity workspace. M1 provides the responsive navigation shell and settings for language, appearance, and color theme. Destination pages are marked as upcoming.

## Setup

Use Node.js **22.22.3** (recorded in `.nvmrc`) and npm **12.2.0** to match CI. If your Node installation ships with an older npm, run `npm install --global npm@12.2.0` first. Doop enforces the Node and npm ranges declared in `package.json` and uses npm 12's default policy of blocking unapproved dependency install scripts.

Install dependencies from the npm lockfile and download the Chromium headless shell.

```sh
npm ci
npx playwright install --only-shell chromium
npm run dev
```

Open <http://localhost:4200>. On Linux, install required browser system packages with `npx playwright install --with-deps --only-shell chromium`, as CI does.

## Commands

| Command                | Purpose                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| `npm run dev`          | Start the Angular development server.                                 |
| `npm run build`        | Build static browser assets in `dist/doop/browser/`.                  |
| `npm run typecheck`    | Check Angular templates, application TypeScript, and test TypeScript. |
| `npm run lint`         | Lint TypeScript and Angular templates.                                |
| `npm run format`       | Format source and tooling files.                                      |
| `npm run format:check` | Check formatting.                                                     |
| `npm test`             | Run the Vitest unit suite once through Angular CLI.                   |
| `npm run test:watch`   | Watch and rerun unit tests.                                           |
| `npm run e2e`          | Smoke-test a production-configured server on port 4201 in Chromium.   |

`tsconfig.json` groups the application, unit test, and Playwright projects for editors. `npm run typecheck` checks each project, including Angular templates. Node types are scoped to the Playwright project.

## Toolchain

Angular, CLI, and build **22.3.0**, TypeScript **6.0.3**, Tailwind CSS and its PostCSS plugin **4.3.5**, PostCSS **8.5.33**, Vitest **5.1.1**, jsdom **31.0.1**, Playwright **1.65.1**, ESLint **10.15.0**, angular-eslint **22.8.0**, typescript-eslint **8.73.0**, and Prettier **3.10.1**. The [Angular compatibility table](https://angular.dev/reference/versions) and published npm peer dependencies guided the version selection. GitHub Actions runs the same checks and exercises desktop and narrow mobile viewport configurations in headless Chromium.

Angular Router serves the five lazy destinations. Configure static hosting to fall back to `index.html` for direct links. The app uses a typed runtime message catalog for English and Arabic, and stores appearance, theme, and language in browser-local preferences.

See [AGENTS.md](AGENTS.md), the [PRD](docs/PRD.md), the [design context](docs/DESIGN.md), the [interaction contract](docs/UX-CONTRACT.md), and the [implementation roadmap](docs/03-IMPLEMENTATION-ROADMAP.md).
