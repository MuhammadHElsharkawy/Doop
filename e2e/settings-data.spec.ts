import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { defaultFocusSettings } from '../src/app/features/focus/domain/focus-settings';

const button = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true });
async function settings(page: Page) {
  await button(page, 'Settings').click();
  return page.getByRole('dialog', { name: 'Settings', exact: true });
}
async function task(page: Page, title: string) {
  await button(page, 'Add task').click();
  const editor = page.getByRole('dialog', { name: 'Add task' });
  await editor.getByLabel('Task title').fill(title);
  await editor.getByRole('button', { name: 'Save task' }).click();
  await expect(editor).toBeHidden();
}
const file = (page: Page, contents: string | Buffer) =>
  page.getByLabel('JSON backup file').setInputFiles({
    name: 'doop-backup-test.json',
    mimeType: 'application/json',
    buffer: Buffer.from(contents),
  });

test('saves the shared timer and sound settings on change and preserves a paused session', async ({
  page,
}) => {
  await page.goto('/focus');
  await button(page, 'Start').click();
  await button(page, 'Pause').click();
  const remaining = await page.getByRole('timer').innerText();
  const panel = await settings(page);
  await expect(
    panel.getByRole('heading', { name: 'Keyboard shortcuts' }),
  ).toBeVisible();
  const duration = panel.getByLabel('Default focus minutes');
  await duration.fill('26');
  await duration.press('Tab');
  await expect(duration).toHaveAttribute('aria-invalid', 'true');
  await duration.fill('45');
  await duration.press('Tab');
  await expect(panel.getByText('Settings saved.')).toBeVisible();
  await panel.getByLabel('Break transition').selectOption('manual');
  await expect(panel.getByText('Settings saved.')).toBeVisible();
  await panel.getByLabel('Preferred sound').selectOption('forest');
  await expect(panel.getByText('Settings saved.')).toBeVisible();
  const volume = panel.getByLabel('Volume', { exact: true });
  await volume.fill('35');
  await volume.press('Tab');
  await expect(panel.getByText('Settings saved.')).toBeVisible();
  const goal = panel.getByLabel('Daily focus goal');
  await goal.fill('4');
  await goal.press('Tab');
  await expect(panel.getByText('Settings saved.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('timer')).toHaveText(remaining);
  await page.reload();
  await expect(page.getByRole('timer')).toHaveText(remaining);
  await expect(page.getByText('0 of 4 sessions')).toBeVisible();
  await settings(page);
  await expect(duration).toHaveValue('45');
  await expect(panel.getByLabel('Preferred sound')).toHaveValue('forest');
  await expect(panel.getByLabel('Break transition')).toHaveValue('manual');
  await expect(volume).toHaveValue('35');
});

test('downloads a versioned backup, round-trips it, and invalidates a peer timer', async ({
  page,
  context,
}) => {
  test.setTimeout(45_000);
  await page.goto('/overview');
  await task(page, 'Saved in backup');
  const panel = await settings(page);
  await panel
    .getByRole('heading', { name: 'Data management' })
    .scrollIntoViewIfNeeded();
  await expect(
    panel.getByRole('button', { name: 'Close', exact: true }),
  ).toBeInViewport();
  const downloaded = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloaded;
  const path = await download.path();
  if (!path) throw new Error('Missing downloaded backup');
  const fileContents = await readFile(path);
  expect(JSON.parse(fileContents.toString())).toMatchObject({
    format: 'doop-backup',
    version: 2,
    tasks: [{ title: 'Saved in backup' }],
  });
  await page.keyboard.press('Escape');
  await task(page, 'Added after export');

  const peer = await context.newPage();
  await peer.goto('/focus');
  await button(peer, 'Start').click();
  await expect(button(peer, 'Pause')).toBeVisible();

  await settings(page);
  await file(page, '{ broken');
  await expect(
    panel.getByText('This file does not contain valid JSON.'),
  ).toBeVisible();
  await file(page, '{"format":"doop-backup","version":999}');
  await expect(
    panel.getByText('This backup version is unsupported.'),
  ).toBeVisible();
  await page.getByLabel('JSON backup file').evaluate((input) => {
    if (!(input instanceof HTMLInputElement))
      throw new Error('Backup input missing');
    const block = new Blob(['x'.repeat(1024 * 1024)]);
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(
        Array.from({ length: 65 }, () => block),
        'oversized.json',
      ),
    );
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(
    panel.getByText('Choose a backup file no larger than 64 MiB.'),
  ).toBeVisible();
  await file(page, fileContents);
  const confirmation = page.getByRole('dialog', {
    name: 'Replace local data?',
  });
  await expect(
    confirmation.getByRole('button', { name: 'Cancel' }),
  ).toBeFocused();
  await expect(confirmation).toHaveAccessibleDescription(
    /Any active timer and Pomodoro cycle will be cleared/,
  );
  await page.keyboard.press('Escape');
  await expect(
    panel.getByRole('button', { name: 'Import backup' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Added after export')).toBeVisible();

  await settings(page);
  await file(page, fileContents);
  await confirmation.getByRole('button', { name: 'Replace data' }).click();
  await expect(panel.getByText('Backup restored.')).toBeVisible();
  await expect(peer.getByText('Ready to focus')).toBeVisible();
  await expect(peer.getByRole('timer')).toHaveText('25:00');
  await page.keyboard.press('Escape');
  await expect(page.getByText('Saved in backup')).toBeVisible();
  await expect(page.getByText('Added after export')).toHaveCount(0);
  await peer.reload();
  await expect(peer.getByText('Ready to focus')).toBeVisible();
});

test('failed replacement rolls back and Clear All Data requires confirmation', async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.addInitScript(() => {
    const write = IDBObjectStore.prototype.put;
    let failed = false;
    IDBObjectStore.prototype.put = function (record, key) {
      const request = write.call(this, record, key);
      if (
        !failed &&
        this.name === 'metadata' &&
        record.preferences?.theme === 'indigo'
      ) {
        failed = true;
        this.transaction.abort();
      }
      return request;
    };
    Storage.prototype.setItem = () => {
      throw new DOMException(
        'Preference cache is unavailable',
        'QuotaExceededError',
      );
    };
    Storage.prototype.removeItem = () => {
      throw new DOMException(
        'Preference cache cannot be rolled back',
        'QuotaExceededError',
      );
    };
  });
  await page.goto('/overview');
  await task(page, 'Keep until confirmed');
  const panel = await settings(page);
  await panel.getByRole('radio', { name: 'Rose', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'rose');
  const backup = {
    format: 'doop-backup',
    version: 2,
    exportedAt: '2026-03-08T10:00:00.000Z',
    tasks: [],
    habits: [],
    schedules: [],
    completions: [],
    sessions: [],
    settings: {
      preferences: { appearance: 'dark', theme: 'indigo', language: 'en' },
      workspace: { ...defaultFocusSettings, dailyGoal: 8 },
    },
  };
  await file(page, JSON.stringify(backup));
  const confirmation = page.getByRole('dialog', {
    name: 'Replace local data?',
  });
  await confirmation
    .getByRole('button', { name: 'Replace data' })
    .press('Enter');
  await expect(confirmation.getByRole('alert')).toContainText(
    'couldn’t be completed',
  );
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'rose');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByText('Keep until confirmed')).toBeVisible();

  await settings(page);
  await file(page, JSON.stringify(backup));
  await confirmation.getByRole('button', { name: 'Replace data' }).click();
  await expect(panel.getByText('Backup restored.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'indigo');
  await expect(panel.getByLabel('Daily focus goal')).toHaveValue('8');

  await panel.getByRole('button', { name: 'Clear All Data' }).click();
  const clear = page.getByRole('dialog', { name: 'Clear all local data?' });
  await expect(clear.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expect(clear).toHaveAccessibleDescription(
    /This removes all Doop tasks/,
  );
  await clear.getByRole('button', { name: 'Cancel' }).press('Enter');
  await expect(panel.getByLabel('Daily focus goal')).toHaveValue('8');
  await panel.getByRole('button', { name: 'Clear All Data' }).click();
  await clear.getByRole('button', { name: 'Clear All Data' }).click();
  await expect(panel.getByText('Local data cleared.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'emerald');
  await expect(panel.getByLabel('Daily focus goal')).toHaveValue('6');
  await page.reload();
  await expect(page.getByText('0 of 6 sessions')).toBeVisible();
  await expect(page.getByText('Keep until confirmed')).toHaveCount(0);
});

test('exports the committed preference from another tab', async ({
  page,
  context,
}) => {
  const peer = await context.newPage();
  await peer.goto('/overview');
  await expect(peer.locator('html')).toHaveAttribute('data-theme', 'emerald');
  await page.goto('/overview');
  const panel = await settings(page);
  await panel.getByRole('radio', { name: 'Indigo' }).check();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('doop.preferences')))
    .toContain('indigo');
  const peerPanel = await settings(peer);
  const response = peer.waitForEvent('download');
  await peerPanel.getByRole('button', { name: 'Export backup' }).click();
  const path = await (await response).path();
  if (!path) throw new Error('Missing backup');
  expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({
    settings: { preferences: { theme: 'indigo' } },
  });
});

for (const replacement of ['import', 'clear'] as const) {
  test(
    'drops pending timer retry when a peer misses ' +
      replacement +
      ' notification',
    async ({ page, context }) => {
      const peer = await context.newPage();
      await peer.addInitScript(() => {
        const Native = window.BroadcastChannel;
        window.BroadcastChannel = class extends Native {
          constructor(name: string) {
            super(name);
            if (name === 'doop-workspace-replacement')
              this.addEventListener('message', (event) =>
                event.stopImmediatePropagation(),
              );
          }
        };
        const put = IDBObjectStore.prototype.put;
        let fail = true;
        IDBObjectStore.prototype.put = function (row, key) {
          if (this.name === 'activeSession' && fail) {
            fail = false;
            throw new DOMException(
              'First timer start aborted',
              'QuotaExceededError',
            );
          }
          return put.call(this, row, key);
        };
      });
      await peer.goto('/focus');
      await button(peer, 'Start').click();
      await expect(button(peer, 'Retry timer action')).toBeVisible();
      await page.goto('/overview');
      const panel = await settings(page);
      if (replacement === 'clear') {
        await panel.getByRole('button', { name: 'Clear All Data' }).click();
        await page
          .getByRole('dialog', { name: 'Clear all local data?' })
          .getByRole('button', { name: 'Clear All Data' })
          .click();
        await expect(panel.getByText('Local data cleared.')).toBeVisible();
      } else {
        await file(
          page,
          JSON.stringify({
            format: 'doop-backup',
            version: 2,
            exportedAt: '2026-03-08T10:00:00.000Z',
            tasks: [],
            habits: [],
            schedules: [],
            completions: [],
            sessions: [],
            settings: {
              workspace: null,
              preferences: {
                language: 'en',
                appearance: 'system',
                theme: 'emerald',
              },
            },
          }),
        );
        await page
          .getByRole('dialog', { name: 'Replace local data?' })
          .getByRole('button', { name: 'Replace data' })
          .click();
        await expect(panel.getByText('Backup restored.')).toBeVisible();
      }
      await expect(button(peer, 'Retry timer action')).toBeHidden();
      await expect(peer.getByText('Ready to focus')).toBeVisible();
      await expect(peer.getByRole('timer')).toHaveText('25:00');
      await expect(
        peer.getByText(
          'Workspace data was replaced. Start a new timer action if needed.',
        ),
      ).toBeVisible();
    },
  );
}

test('exports one large record and cumulative history without the old size cap', async ({
  page,
}) => {
  await page.goto('/focus');
  await expect(button(page, 'Start')).toBeVisible();
  async function seed(sizes: number[]) {
    await page.evaluate(async (sizes) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('doop-workspace');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(['habits', 'schedules'], 'readwrite');
          tx.oncomplete = () => resolve();
          tx.onabort = () => reject(tx.error);
          for (const [index, size] of sizes.entries()) {
            const id = 'large-' + index;
            const at = '2026-03-08T10:00:00.000Z';
            tx.objectStore('habits').put({
              id,
              name: id,
              description: 'x'.repeat(size),
              createdAt: at,
              updatedAt: at,
              deletedAt: null,
              status: 'active',
              archivedAt: null,
              archivePeriods: [],
              deletedLocalDate: null,
              startDate: '2026-03-08',
            });
            tx.objectStore('schedules').put({
              id: id + '-schedule',
              habitId: id,
              weekdays: [1],
              effectiveFrom: '2026-03-08',
              effectiveTo: null,
              createdAt: at,
            });
          }
        });
      } finally {
        db.close();
      }
    }, sizes);
  }
  const mb = 1024 * 1024;
  const panel = await settings(page);
  for (const sizes of [[11 * mb], [4 * mb, 4 * mb, 4 * mb]]) {
    await seed(sizes);
    const response = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Export backup' }).click();
    const path = await (await response).path();
    if (!path) throw new Error('Missing large backup');
    const backup = JSON.parse(await readFile(path, 'utf8')) as {
      habits: { description: string }[];
    };
    expect(backup.habits.map((row) => row.description.length)).toEqual(sizes);
  }
});
