import { expect, test, type Page } from '@playwright/test';
import { toIsoInstant } from '../src/app/core/clock/local-date';

test.use({ timezoneId: 'Africa/Cairo' });

const summary = (page: Page) =>
  page.getByRole('region', { name: 'Daily Summary' });
const goal = (page: Page) => page.getByRole('region', { name: 'Focus Goal' });
const metric = (page: Page, name: string) =>
  summary(page)
    .locator('div')
    .filter({
      has: page.getByText(name, { exact: true }),
    })
    .locator('dd');

async function write(
  page: Page,
  stores: Record<string, object[]>,
  removals: Record<string, string[]> = {},
) {
  await page.evaluate(
    async ({ stores, removals }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('doop-workspace');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(
            [...new Set([...Object.keys(stores), ...Object.keys(removals)])],
            'readwrite',
          );
          tx.oncomplete = () => resolve();
          tx.onabort = () => reject(tx.error);
          for (const [name, rows] of Object.entries(stores))
            for (const row of rows) tx.objectStore(name).put(row);
          for (const [name, keys] of Object.entries(removals))
            for (const key of keys) tx.objectStore(name).delete(key);
        });
      } finally {
        db.close();
      }
    },
    { stores, removals },
  );
}

function session(
  id: string,
  endedAt: string,
  date: string,
  type: 'timer' | 'stopwatch',
  seconds: number,
  status = 'completed',
) {
  return {
    id,
    type,
    status,
    endedAt,
    completionLocalDate: date,
    completionTimezoneOffsetMinutes: -120,
    startedAt: toIsoInstant(new Date(Date.parse(endedAt) - seconds * 1000)),
    taskId: null,
    taskTitleSnapshot: null,
    actualDurationSeconds: seconds,
    plannedDurationSeconds: type === 'timer' ? 1500 : null,
  };
}

test('counts eligible focus records by their stored day and updates after peer edits and deletion', async ({
  page,
  context,
}) => {
  const morning = new Date('2026-03-08T10:00:00Z');
  await page.clock.setFixedTime(morning);
  await page.goto('/overview');
  await expect(page.getByText('Good afternoon')).toBeVisible();
  await expect(goal(page).getByText('0 of 6 sessions')).toBeVisible();
  const timer = session(
    'timer',
    '2026-03-07T22:05:00.000Z',
    '2026-03-08',
    'timer',
    1500,
  );
  await write(page, {
    sessions: [
      timer,
      session(
        'watch',
        '2026-03-08T08:00:00.000Z',
        '2026-03-08',
        'stopwatch',
        90,
      ),
      session(
        'partial',
        '2026-03-08T09:00:00.000Z',
        '2026-03-08',
        'timer',
        105,
        'partial',
      ),
      session(
        'prior',
        '2026-03-07T21:59:00.000Z',
        '2026-03-07',
        'stopwatch',
        60,
      ),
    ],
    cycle: [{ id: 'cycle', completedFocusSessions: 1, pendingBreak: null }],
  });
  await page.reload();
  await expect(metric(page, 'Focus Time')).toHaveText('26 min 30 sec');
  await expect(goal(page).getByText('2 of 6 sessions')).toBeVisible();
  await expect(goal(page).getByText('Sessions remaining: 4')).toBeVisible();

  const link = page.getByRole('link', { name: 'Start Focus' });
  await link.press('Enter');
  await expect(page).toHaveURL(/\/focus$/);
  await expect(page.getByText('Ready to focus')).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText('25:00');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Overview' })
    .click();

  const peer = await context.newPage();
  await peer.clock.setFixedTime(morning);
  await peer.goto('/focus');
  await peer.getByLabel('Daily goal (sessions)').fill('1');
  await peer.getByRole('button', { name: 'Save goal' }).click();
  await expect(goal(page).getByText('2 of 1 sessions')).toBeVisible();
  await expect(goal(page).getByText('Daily goal reached')).toBeVisible();
  await expect(goal(page).getByRole('progressbar')).toHaveAttribute(
    'value',
    '1',
  );

  const history = peer.getByRole('region', { name: 'Focus history' });
  const row = history
    .getByRole('listitem')
    .filter({
      has: peer.getByText('Pomodoro Timer', { exact: true }),
    })
    .filter({ has: peer.getByText('Completed', { exact: true }) });
  await row.getByRole('button', { name: /Delete session/ }).click();
  await peer
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete session' })
    .click();
  await expect(metric(page, 'Focus Time')).toHaveText('1 min 30 sec');
  await expect(goal(page).getByText('1 of 1 sessions')).toBeVisible();
  expect(
    await peer.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('doop-workspace');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        return await new Promise<{ completedFocusSessions: number }>(
          (resolve, reject) => {
            const request = db
              .transaction('cycle')
              .objectStore('cycle')
              .get('cycle');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          },
        );
      } finally {
        db.close();
      }
    }),
  ).toMatchObject({ completedFocusSessions: 1 });
});

test('updates due-today task and focus totals at local midnight while preserving stored dates', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-03-07T21:59:00Z') });
  await page.goto('/overview');
  await expect(goal(page).getByText('0 of 6 sessions')).toBeVisible();
  const createdAt = '2026-03-06T09:00:00.000Z';
  const base = {
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    expectedSessions: null,
    completedAt: null,
    status: 'pending',
    priority: 'medium',
  };
  await write(page, {
    tasks: [
      {
        ...base,
        id: 'old-due',
        title: 'Previous day',
        dueDate: '2026-03-07',
        status: 'completed',
        completedAt: createdAt,
      },
      { ...base, id: 'new-due', title: 'Read notes', dueDate: '2026-03-08' },
      { ...base, id: 'undated', title: 'Undated', dueDate: null },
      {
        ...base,
        id: 'deleted',
        title: 'Removed',
        dueDate: '2026-03-08',
        deletedAt: createdAt,
      },
    ],
    sessions: [
      session(
        'prior',
        '2026-03-07T21:50:00.000Z',
        '2026-03-07',
        'stopwatch',
        60,
      ),
    ],
  });
  await page.reload();
  await expect(metric(page, 'Tasks Completed')).toHaveText('1 of 1');
  await expect(metric(page, 'Focus Time')).toHaveText('1 min');
  await page.clock.fastForward(65_000);
  await expect(page.locator('main header time')).toHaveAttribute(
    'datetime',
    '2026-03-08',
  );
  await expect(metric(page, 'Tasks Completed')).toHaveText('0 of 1');
  await expect(metric(page, 'Focus Time')).toHaveText('0 sec');
  const mark = page.getByRole('button', { name: 'Mark complete · Read notes' });
  await mark.press('Enter');
  await expect(metric(page, 'Tasks Completed')).toHaveText('1 of 1');
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  await expect(undo).toBeFocused();
  await undo.press('Enter');
  await expect(metric(page, 'Tasks Completed')).toHaveText('0 of 1');
  await expect(page.locator('#today-tasks')).toBeFocused();
});

test('recovers invalid focus history by keyboard and keeps planning usable', async ({
  page,
}) => {
  await page.goto('/overview');
  await expect(goal(page).getByText('0 of 6 sessions')).toBeVisible();
  await write(page, { sessions: [{ id: 'invalid' }] });
  await page.reload();
  await expect(metric(page, 'Focus Time')).toHaveText('—Unavailable');
  await expect(goal(page).getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add task' })).toBeEnabled();
  const retry = goal(page).getByRole('button', { name: 'Retry focus goal' });
  await retry.press('Enter');
  await expect(goal(page).getByRole('alert')).toBeVisible();
  await expect(retry).toBeFocused();
  await write(page, {}, { sessions: ['invalid'] });
  await retry.press('Enter');
  await expect(metric(page, 'Focus Time')).toHaveText('0 sec');
  await expect(goal(page).getByRole('heading')).toBeFocused();
});
