# Doop web release runbook

M10 depends on the completed M0–M9 web milestones. Its deliverables are the PRD section 17 acceptance review, keyboard and Arabic RTL review, mobile browser QA, bundle and performance review, production error feedback, local-only privacy and backup guidance, and deployment documentation. Public launch also requires a smoke test on the deployed HTTPS URL and human sign-off. See the [roadmap](03-IMPLEMENTATION-ROADMAP.md#m10--quality-and-public-web-launch).

## Launch decision

**Public launch is blocked by backup portability.** The app can download a valid workspace backup that the browser importer rejects because it exceeds 64 MiB or the parser’s complexity budget. Preserve the original browser profile and the downloaded file. Do not clear or migrate the original workspace based on a download alone. Verify a restore from a separate browser profile before relying on a backup. Do not split or edit the JSON by hand as a recovery procedure. M10 leaves the backup schema, storage limits and transactional behavior as documented in the [persistence contract](PERSISTENCE.md).

Doop uses the current browser profile and site origin for data. Clearing site data, using a private browsing session, browser eviction, or changing the deployment origin can leave the user without access to it. Doop sends no workspace records to a server and offers no account or cross-device sync. Backups can contain private task titles, habits, focus history, and preferences. Store them accordingly. Exact background alarms, continuous background playback and native-mobile behavior are outside the web release guarantee. See [mobile feasibility](MOBILE-FEASIBILITY.md).

## Build and deploy

1. Use the Node and npm versions in the [README](../README.md). Install with `npm ci`. Run formatting, lint, typecheck, unit tests, production build, E2E, and `git diff --check` from the candidate revision.
2. Publish the **contents of `dist/doop/browser/`** to an approved HTTPS origin at its root path. Keep the origin stable across releases. Deploy the complete build atomically. Enable Brotli or gzip on the host. Serve HTML with revalidation and content-hashed assets with long-lived immutable caching. Where supported, retain the previous build’s hashed assets through rollout so tabs already open can finish loading routes.
3. Return `index.html` for the root and for known Angular page routes on a direct visit or reload. A missing asset must return a real 404 with the correct MIME type on success. For example, on an Nginx HTTPS virtual host with its root set to the published directory:

   ```nginx
   include mime.types;

   location = /index.html {
       add_header Cache-Control "no-cache" always;
   }

   location ~ ^/(?:main|styles|chunk)-[A-Za-z0-9_-]+\.(?:js|css)$ {
       add_header Cache-Control "public, max-age=31536000, immutable";
       try_files $uri =404;
   }

   location ~ ^/(?:overview|tasks|habits|focus|progress)/?$ {
       try_files $uri /index.html;
   }

   location / {
       try_files $uri $uri/ =404;
   }
   ```

   Adapt route patterns and cache headers to the selected host. Verify the actual headers at the edge. If the host applies a Content Security Policy, verify Angular’s generated inline critical CSS and component styles against it on staging.

4. Smoke-test the candidate on an isolated staging origin or fresh browser profile using disposable records. Check default navigation, direct links and refresh, scripts and styles, task creation and reload, timer save and recovery, Settings, backup export and confirmed restore, and Clear All Data cancellation. Run the Playwright smoke suite against the actual candidate without starting Angular’s dev server.

   ```sh
   npx playwright install --only-shell chromium firefox webkit
   DOOP_TEST_URL=https://your-approved-origin.example DOOP_RELEASE_BROWSERS=1 \
     npm run e2e -- e2e/release.spec.ts
   DOOP_TEST_URL=https://your-approved-origin.example \
     npm run e2e -- e2e/settings-data.spec.ts e2e/focus.spec.ts
   ```

   In PowerShell, set `$env:DOOP_TEST_URL` and `$env:DOOP_RELEASE_BROWSERS` before running the equivalent `npm.cmd` commands. Remove the variables to return to the default Chromium suite on the local test server. The settings and timer commands above use the default Chromium projects. Run the same smoke on the approved production URL after deploying. Use dedicated browser sessions and keep actual workspace data out of test fixtures.

5. Record candidate revision, HTTPS URL, browser and device matrix, test output, outstanding risks, and reviewer sign-off below. For a rollback, first check IndexedDB compatibility with the candidate already served. Switching static assets does not revert a locally upgraded database. Retain affected browser profiles and avoid clearing site data.

## PRD section 17 acceptance evidence

The rows collectively cover the release checklist in [PRD section 17](PRD.md#17-mvp-acceptance-criteria). Browser specs live in `e2e/`. Domain and repository specs are colocated under `src/app/`.

| Section               | Criteria and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application structure | Overview default, five destinations, sidebar collapse, mobile bottom navigation and separate Settings. See `app.spec.ts` and `release.spec.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Overview              | Three summary metrics using due-today tasks, eligible habits and completed focus time. Overdue, due-today and undated task ordering, Overview task completion, all scheduled habits with contained scrolling, habit completion and undo, eligible session count in Focus Goal, navigation-only Start Focus, and both shared add forms. See `overview.spec.ts`, `tasks.spec.ts` and `habits.spec.ts`.                                                                                                                                                                                                                                   |
| Tasks                 | Create, edit, complete, reopen and delete. Validate titles, three priority levels, optional date-only due date and optional expected sessions. Exercise four filters, sorting and remembered view, derived overdue after local midnight, task association, derived eligible session progress and history retention on task deletion. See `tasks.spec.ts`, `overview.spec.ts`, `focus-m7.spec.ts`, `task-rules.spec.ts` and repository tests.                                                                                                                                                                                           |
| Habits                | Create, edit, archive, restore and delete. Support every day and selected weekdays; complete and undo on both routes. Enforce unique occurrences, preserve schedule versions and history through archive and deletion, and calculate rates only from eligible dates. See `habits.spec.ts`, `habit-rules.spec.ts`, `habit-workflow.spec.ts` and repository tests.                                                                                                                                                                                                                                                                       |
| Focus                 | Timer and Stopwatch. Check presets, 5–480 minute custom durations, +5 minutes, pause/resume, refresh, short/long break settings and transitions, pending and running skips, long-break reset and cycle accounting on natural Timer completion. Saved Stopwatch contributes to goals without advancing the cycle. Partial Timer is history only and discard saves no row. Check one independent ambient track, playback controls and volume, date-filtered history, and derived totals after removing a session without changing the cycle. See the four Focus browser specs and the timer, cycle, settings, and repository unit tests. |
| Progress              | Five date filters, eligible completed Focus metrics, excluded partial or discarded sessions, task completion-date analytics after soft delete, scheduled habit analytics, understandable deleted history, and charts with daily text equivalents. See `progress.spec.ts`, `progress-report.spec.ts` and `focus-m7.spec.ts`.                                                                                                                                                                                                                                                                                                            |
| Settings and data     | Independent Light/Dark/System and six themes including Slate, English/Arabic RTL, persistent timer/goal/sound settings, versioned JSON download, confirmed restore, malformed import leaves data intact, confirmed clear and restart persistence. See `app.spec.ts`, `settings-data.spec.ts`, `release.spec.ts` and repository tests. **FAIL for full backup portability.**                                                                                                                                                                                                                                                            |
| Quality               | Desktop/tablet/mobile layouts, destructive confirmations, keyboard and visible focus, contrast, accessible names, and reduced-motion behavior. See `release.spec.ts`, `app.spec.ts` and feature suites. Physical mobile and assistive-technology checks require the manual sign-off below.                                                                                                                                                                                                                                                                                                                                             |

## Manual sign-off

- [ ] Verify physical Android Chrome and iOS Safari in portrait and landscape. Check safe areas, the software keyboard in Task and Habit forms, touch targets, long Arabic text, and Focus after locking or backgrounding the browser.
- [ ] Spot-check announcements and keyboard focus with a screen reader. Cover navigation, timer completion, failed route recovery and nested destructive confirmations. Verify zoom and high-contrast operation on the selected desktop browsers.
- [ ] Record startup and interaction timings on representative mobile hardware. The build enforces a 400 kB warning and 450 kB error for the initial bundle. Use `npm run build -- --stats-json` to investigate regressions. Confirm that Focus and Progress load only when requested.
- [ ] Resolve the backup portability blocker before public release and demonstrate a large-workspace round trip.
- [ ] Record the production HTTPS URL, run deployed smoke tests, and obtain launch approval.
