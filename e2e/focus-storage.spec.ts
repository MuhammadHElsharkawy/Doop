import { expect, test, type Page } from '@playwright/test';

const settings = {
  id: 'settings',
  weekStartsOn: 6,
  dailyGoal: 7,
  focusDurationMinutes: 45,
  shortBreakDurationMinutes: 10,
  longBreakDurationMinutes: 25,
  focusSessionsBeforeLongBreak: 3,
  breakTransition: 'manual',
  ambientSound: 'rain',
  ambientVolume: 62,
};
const task = {
  id: 'legacy-task',
  title: 'Preserved task',
  priority: 'medium',
  dueDate: null,
  expectedSessions: null,
  status: 'pending',
  completedAt: null,
  deletedAt: null,
  createdAt: '2026-01-01T12:00:00.000Z',
  updatedAt: '2026-01-01T12:00:00.000Z',
};
const active = {
  id: 'active',
  sessionId: 'legacy-session',
  taskId: null,
  taskTitleSnapshot: null,
  type: 'timer',
  status: 'paused',
  startedAt: '2026-01-01T12:00:00.000Z',
  resumedAt: null,
  accumulatedActiveMs: 60_000,
  plannedDurationMs: 45 * 60_000,
};
const paused = { id: 'cycle', completedFocusSessions: 1, pendingBreak: null };

async function seedWorkspace(
  page: Page,
  invalid: boolean,
  language: 'en' | 'ar' = 'en',
  metadata?: object,
) {
  await page.route('**/storage-fixture', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }),
  );
  await page.goto('/storage-fixture');
  await page.evaluate(
    ({ language, settings, active, task, paused, metadata }) =>
      new Promise<void>((resolve, reject) => {
        localStorage.setItem(
          'doop.preferences',
          JSON.stringify({ appearance: 'dark', theme: 'indigo', language }),
        );
        const request = indexedDB.open('doop-workspace', metadata ? 4 : 3);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore('tasks', { keyPath: 'id' }).add(task);
          const habits = db.createObjectStore('habits', { keyPath: 'id' });
          const schedules = db.createObjectStore('schedules', {
            keyPath: 'id',
          });
          schedules.createIndex('byHabit', 'habitId');
          const completions = db.createObjectStore('completions', {
            keyPath: 'id',
          });
          completions.createIndex(
            'byOccurrence',
            ['habitId', 'scheduledDate'],
            { unique: true },
          );
          const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
          if (metadata) {
            db.createObjectStore('metadata', { keyPath: 'id' }).add(metadata);
            const date = '2026-01-01';
            const instant = '2026-01-01T12:00:00.000Z';
            habits.add({
              id: 'habit',
              name: 'Read',
              description: null,
              status: 'active',
              startDate: date,
              createdAt: instant,
              updatedAt: instant,
              deletedAt: null,
              deletedLocalDate: null,
              archivedAt: null,
              archivePeriods: [],
            });
            schedules.add({
              id: 'schedule',
              habitId: 'habit',
              weekdays: [0, 1, 2, 3, 4, 5, 6],
              effectiveFrom: date,
              effectiveTo: null,
              createdAt: instant,
            });
            completions.add({
              id: 'completion',
              habitId: 'habit',
              habitNameSnapshot: 'Read',
              scheduledDate: date,
              completedAt: instant,
            });
            sessions.add({
              id: 'session',
              type: 'stopwatch',
              actualDurationSeconds: 60,
              plannedDurationSeconds: null,
              taskId: task.id,
              taskTitleSnapshot: task.title,
              status: 'completed',
              startedAt: instant,
              endedAt: '2026-01-01T12:01:00.000Z',
              completionLocalDate: date,
              completionTimezoneOffsetMinutes: 0,
            });
          }
          db.createObjectStore('cycle', { keyPath: 'id' }).add(paused);
          db.createObjectStore('activeSession', { keyPath: 'id' }).add(active);
          db.createObjectStore('settings', { keyPath: 'id' }).add(settings);
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
      }),
    {
      language,
      settings: invalid ? { ...settings, ambientVolume: 101 } : settings,
      task,
      active,
      paused,
      metadata,
    },
  );
}

async function storedFocus(page: Page, repair?: typeof settings) {
  return page.evaluate(
    (replacement) =>
      new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open('doop-workspace');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(
            ['settings', 'activeSession', 'cycle', 'tasks'],
            replacement ? 'readwrite' : 'readonly',
          );
          if (replacement) tx.objectStore('settings').put(replacement);
          const previousSettings = tx.objectStore('settings').get('settings');
          const active = tx.objectStore('activeSession').get('active');
          const cycle = tx.objectStore('cycle').get('cycle');
          const task = tx.objectStore('tasks').get('legacy-task');
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
          tx.oncomplete = () => {
            db.close();
            resolve({
              version: db.version,
              settings: previousSettings.result,
              active: active.result,
              cycle: cycle.result,
              task: task.result,
            });
          };
        };
      }),
    repair,
  );
}

test('recovers valid legacy Focus records after a v3 upgrade and reload without rewriting them', async ({
  page,
}) => {
  await seedWorkspace(page, false);
  await page.goto('/focus');
  for (let visit = 0; visit < 2; visit++) {
    if (visit) await page.reload();
    await expect(
      page.getByRole('button', { name: 'Resume', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('timer')).toHaveText('44:00');
    await expect(page.locator('#ambient-track')).toHaveValue('rain');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'indigo');
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(await storedFocus(page)).toEqual({
      version: 5,
      settings,
      active,
      cycle: paused,
      task,
    });
  }
});

for (const language of ['en', 'ar'] as const) {
  test(`reports invalid Focus settings in ${language} and recovers after the record is corrected`, async ({
    page,
  }) => {
    const english = language === 'en';
    const invalidMessage = english
      ? /stored Focus record is invalid/
      : /سجلّ تركيز محفوظ غير صالح/;
    const warning = english
      ? /couldn’t read a stored workspace record/
      : /تعذّر على Doop قراءة أحد سجلات مساحة العمل/;
    const retryName = english
      ? 'Retry loading timer'
      : 'إعادة محاولة تحميل المؤقت';

    await seedWorkspace(page, true, language);
    await page.goto('/focus');
    const global = page.getByRole('alert').filter({ hasText: warning });
    await expect(global).toBeVisible();
    await expect(
      page.getByRole('alert').filter({ hasText: invalidMessage }),
    ).toBeVisible();
    await expect(
      page.getByText(english ? 'Loading timer…' : 'جارٍ تحميل المؤقت…'),
    ).toBeHidden();
    await expect(
      page
        .getByText(
          english ? 'Loading focus settings…' : 'جارٍ تحميل إعدادات التركيز…',
        )
        .first(),
    ).toBeHidden();
    await expect(page.getByRole('button', { name: retryName })).toBeVisible();

    const retry = page.getByRole('button', { name: retryName });
    await retry.press('Enter');
    await expect(retry).toBeFocused();
    await expect(global).toBeVisible();
    expect(await storedFocus(page)).toEqual({
      version: 5,
      settings: { ...settings, ambientVolume: 101 },
      active,
      cycle: paused,
      task,
    });

    await page
      .getByRole('link', { name: english ? 'Tasks' : 'المهام', exact: true })
      .click();
    await expect(page.getByText(task.title, { exact: true })).toBeVisible();
    await expect(global).toBeVisible();
    await page
      .getByRole('link', { name: english ? 'Focus' : 'التركيز', exact: true })
      .click();
    await expect(
      page.getByRole('alert').filter({ hasText: invalidMessage }),
    ).toBeVisible();

    // Replace only the test fixture's bad row, simulating an external repair.
    await storedFocus(page, settings);
    const resume = page.getByRole('button', {
      name: english ? 'Resume' : 'استئناف',
      exact: true,
    });
    if (english) {
      await retry.press('Enter');
      await expect(resume).toBeFocused();
    } else {
      await page
        .getByRole('button', { name: 'إعادة محاولة فتح التخزين' })
        .press('Enter');
    }
    await expect(resume).toBeVisible();
    await expect(global).toBeHidden();
    await expect(page.locator('#ambient-track')).toHaveValue('rain');
    expect(await storedFocus(page)).toEqual({
      version: 5,
      settings,
      active,
      cycle: paused,
      task,
    });
  });
}

test('leaves loading and retries a temporary Focus snapshot read failure', async ({
  page,
}) => {
  await seedWorkspace(page, false);
  await page.addInitScript(() => {
    const transaction = IDBDatabase.prototype.transaction;
    let fail = true;
    window.addEventListener('enable-focus-read', () => {
      fail = false;
    });
    IDBDatabase.prototype.transaction = function (stores, mode, options) {
      if (
        fail &&
        Array.isArray(stores) &&
        stores.includes('activeSession') &&
        mode === 'readonly'
      )
        throw new DOMException('Temporary focus read failure', 'UnknownError');
      return transaction.call(this, stores, mode, options);
    };
  });
  await page.goto('/focus');
  const global = page
    .getByRole('alert')
    .filter({ hasText: 'couldn’t read workspace data' });
  await expect(global).toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: 'couldn’t load the timer' }),
  ).toBeVisible();
  await expect(page.getByText('Loading focus settings…').first()).toBeHidden();
  await page.evaluate(() =>
    window.dispatchEvent(new Event('enable-focus-read')),
  );
  await page
    .getByRole('button', { name: 'Retry loading timer' })
    .press('Enter');
  await expect(
    page.getByRole('button', { name: 'Resume', exact: true }),
  ).toBeFocused();
  await expect(global).toBeHidden();
  expect(await storedFocus(page)).toEqual({
    version: 5,
    settings,
    active,
    cycle: paused,
    task,
  });
});

test('reopens unavailable storage from Focus and restores the saved timer', async ({
  page,
}) => {
  await seedWorkspace(page, false);
  await page.addInitScript(() => {
    const open = indexedDB.open.bind(indexedDB);
    let blocked = true;
    window.addEventListener('enable-storage', () => {
      blocked = false;
    });
    indexedDB.open = (name, version) => {
      if (blocked)
        throw new DOMException('Storage unavailable', 'SecurityError');
      return open(name, version);
    };
  });
  await page.goto('/focus');
  const global = page
    .getByRole('alert')
    .filter({ hasText: 'couldn’t open workspace storage' });
  await expect(global).toBeVisible();
  const retry = page.getByRole('button', { name: 'Retry loading timer' });
  await retry.press('Enter');
  await expect(retry).toBeFocused();
  await expect(global).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new Event('enable-storage')));
  await retry.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Resume', exact: true }),
  ).toBeFocused();
  await expect(global).toBeHidden();
  expect(await storedFocus(page)).toEqual({
    version: 5,
    settings,
    active,
    cycle: paused,
    task,
  });
});

function readFixtureRows(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ version: number; rows: Record<string, unknown[]> }>(
        (resolve, reject) => {
          const request = indexedDB.open('doop-workspace');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const names = Array.from(db.objectStoreNames);
            const tx = db.transaction(names, 'readonly');
            const reads = names.map(
              (name) => [name, tx.objectStore(name).getAll()] as const,
            );
            tx.onabort = () => {
              db.close();
              reject(tx.error);
            };
            tx.oncomplete = () => {
              const rows = Object.fromEntries(
                reads.map(([name, read]) => [name, read.result]),
              );
              db.close();
              resolve({ version: db.version, rows });
            };
          };
        },
      ),
  );
}

test('repairs existing v4 metadata across concurrent Focus tabs and preserves all workspace rows', async ({
  page,
  context,
}) => {
  const metadata = {
    id: 'workspace',
    generation: 7,
    preferences: { appearance: 'dark', theme: 'slate', language: 'en' },
  };
  await seedWorkspace(page, false, 'en', metadata);
  const before = await readFixtureRows(page);
  expect(before.version).toBe(4);
  const peer = await context.newPage();
  await Promise.all([page.goto('/focus'), peer.goto('/focus')]);

  for (const tab of [page, peer]) {
    await expect(
      tab.getByRole('button', { name: 'Resume', exact: true }),
    ).toBeVisible();
    await expect(tab.getByRole('timer')).toHaveText('44:00');
    await expect(tab.locator('#ambient-track')).toHaveValue('rain');
    await expect(tab.locator('html')).toHaveAttribute('data-theme', 'slate');
    await expect(tab.getByRole('alert')).toHaveCount(0);
  }

  const repaired = {
    version: 5,
    rows: { ...before.rows, metadata: [{ ...metadata, revision: 0 }] },
  };
  expect(await readFixtureRows(page)).toEqual(repaired);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Resume', exact: true }),
  ).toBeVisible();
  expect(await readFixtureRows(page)).toEqual(repaired);
  await page.getByRole('link', { name: 'Tasks', exact: true }).click();
  await expect(page.getByText(task.title, { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Focus', exact: true }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(
    peer.getByRole('button', { name: 'Pause', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(
    peer.getByRole('button', { name: 'Resume', exact: true }),
  ).toBeVisible();

  const { rows } = await readFixtureRows(peer);
  expect({ ...rows, activeSession: before.rows['activeSession'] }).toEqual(
    repaired.rows,
  );
  expect(rows['activeSession']).toMatchObject([
    { id: 'active', sessionId: active.sessionId, status: 'paused' },
  ]);
});
