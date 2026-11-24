import { expect, test } from '@playwright/test';

test.describe('New York calendar fixtures', () => {
  test.use({ timezoneId: 'America/New_York' });

  test('reports stored focus days, local task dates, and historical habit schedules across DST', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-03-09T04:30:00Z'));
    await page.goto('/progress');
    await expect(
      page.getByText('There is no recorded activity in this period.').first(),
    ).toBeVisible();
    const start = '2026-03-06T12:00:00.000Z';
    const completion = '2026-03-09T03:30:00.000Z';
    const record = {
      format: 'doop-backup',
      version: 2,
      exportedAt: completion,
      tasks: [
        {
          id: 'boundary',
          title: 'UTC year zero',
          createdAt: '0000-01-01T00:00:00.000Z',
          updatedAt: '0000-01-01T00:00:00.000Z',
          completedAt: '0000-01-01T00:00:00.000Z',
          deletedAt: null,
          priority: 'medium',
          dueDate: null,
          expectedSessions: null,
          status: 'completed',
        },
        {
          id: 'task',
          title: 'Finished before midnight',
          createdAt: start,
          updatedAt: completion,
          deletedAt: completion,
          priority: 'medium',
          dueDate: null,
          expectedSessions: null,
          status: 'completed',
          completedAt: completion,
        },
      ],
      habits: [
        {
          id: 'habit',
          name: 'Current name',
          createdAt: start,
          updatedAt: completion,
          deletedAt: completion,
          description: null,
          startDate: '2026-03-06',
          status: 'active',
          archivedAt: null,
          archivePeriods: [{ from: '2026-03-08', until: '2026-03-09' }],
          deletedLocalDate: '2026-03-09',
        },
      ],
      schedules: [
        {
          id: 'old',
          habitId: 'habit',
          weekdays: [5],
          effectiveFrom: '2026-03-06',
          effectiveTo: '2026-03-07',
          createdAt: start,
        },
        {
          id: 'new',
          habitId: 'habit',
          weekdays: [0, 6],
          effectiveFrom: '2026-03-07',
          effectiveTo: null,
          createdAt: start,
        },
      ],
      completions: [
        {
          id: 'done',
          habitId: 'habit',
          habitNameSnapshot: 'Historical name',
          scheduledDate: '2026-03-06',
          completedAt: start,
        },
      ],
      sessions: [
        {
          id: 's',
          type: 'stopwatch',
          status: 'completed',
          taskId: null,
          taskTitleSnapshot: null,
          plannedDurationSeconds: null,
          actualDurationSeconds: 60,
          startedAt: '2026-03-09T04:04:00.000Z',
          endedAt: '2026-03-09T04:05:00.000Z',
          completionLocalDate: '2026-03-08',
          completionTimezoneOffsetMinutes: 420,
        },
      ],
      settings: {
        workspace: null,
        preferences: { appearance: 'system', theme: 'emerald', language: 'en' },
      },
    };
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('JSON backup file').setInputFiles({
      name: 'history.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(record)),
    });
    await page
      .getByRole('dialog', { name: 'Replace local data?' })
      .getByRole('button', { name: 'Replace data' })
      .click();
    await expect(page.getByText('Backup restored.')).toBeVisible();
    await page.keyboard.press('Escape');

    const summary = page.getByRole('region', { name: 'Productivity overview' });
    await expect(summary.getByText('1 min', { exact: true })).toBeVisible();
    await expect(summary.getByText('50%', { exact: true })).toBeVisible();
    const table = page.getByRole('table', { name: 'Daily activity' });
    const march8 = table.getByRole('row').filter({ hasText: 'Mar 8, 2026' });
    await expect(march8).toContainText('1 min');
    await expect(march8.getByRole('cell').nth(1)).toHaveText('1');
    await expect(march8.getByRole('cell').nth(2)).toHaveText('0 of 0');
    await page.getByText('Recent task completions', { exact: true }).click();
    await expect(page.getByText('Finished before midnight')).toBeVisible();
    await expect(page.getByText('Historical name')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'By habit' }).getByText('Current name'),
    ).toBeVisible();

    const period = page.getByLabel('Period');
    await period.selectOption('today');
    await expect(summary.getByText('0 sec', { exact: true })).toBeVisible();
    await period.selectOption('monthRolling');
    await expect(summary.getByText('1 min', { exact: true })).toBeVisible();
    await period.selectOption('month');
    await expect(summary.getByText('1 min', { exact: true })).toBeVisible();
    await period.selectOption('custom');
    await page.getByLabel('Start date').fill('2026-03-08');
    await page.getByLabel('End date').fill('2026-03-07');
    await page.getByRole('button', { name: 'Apply dates' }).click();
    await expect(page.getByRole('alert')).toContainText(
      'Choose a start and end date',
    );
    await page.getByLabel('End date').fill('2026-03-08');
    await page.getByRole('button', { name: 'Apply dates' }).click();
    await expect(table.getByRole('row')).toHaveCount(2);
    await expect(march8).toContainText('1 min');
    expect(
      await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth <= root.clientWidth;
      }),
    ).toBe(true);
  });
});

test('updates task dates after a timezone change while today stays the same', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ baseURL });
  try {
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send('Emulation.setTimezoneOverride', {
      timezoneId: 'America/New_York',
    });
    await page.clock.setFixedTime(new Date('2026-11-23T12:00:00.000Z'));
    await page.goto('/progress');
    await expect(
      page.getByRole('region', { name: 'Productivity overview' }),
    ).toBeVisible();
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('doop-workspace');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('tasks', 'readwrite');
          tx.oncomplete = () => resolve();
          tx.onabort = () => reject(tx.error);
          const at = '2026-11-23T06:00:00.000Z';
          tx.objectStore('tasks').put({
            id: 'task',
            title: 'Time-zone test',
            createdAt: at,
            updatedAt: at,
            completedAt: at,
            deletedAt: null,
            dueDate: null,
            expectedSessions: null,
            status: 'completed',
            priority: 'medium',
          });
        });
      } finally {
        db.close();
      }
    });
    await page.reload();
    await page.getByLabel('Period').selectOption('today');
    const completed = page
      .getByRole('region', { name: 'Productivity overview' })
      .getByText('Completed tasks', { exact: true })
      .locator('..')
      .locator('dd');
    await expect(completed).toHaveText('1');
    await client.send('Emulation.setTimezoneOverride', { timezoneId: '' });
    await client.send('Emulation.setTimezoneOverride', {
      timezoneId: 'America/Los_Angeles',
    });
    await expect(completed).toHaveText('0');
    await expect(page.locator('time').first()).toHaveAttribute(
      'datetime',
      '2026-11-23',
    );
  } finally {
    await context.close();
  }
});
