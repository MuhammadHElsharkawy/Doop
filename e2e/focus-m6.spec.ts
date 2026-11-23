import { expect, test, type Page } from '@playwright/test';
import type { WorkspaceRecords } from '../src/app/core/domain/workspace-records';

const button = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true });

async function persisted(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('doop-workspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = db.transaction([
        'activeSession',
        'sessions',
        'cycle',
      ]);
      function all<K extends 'activeSession' | 'sessions' | 'cycle'>(store: K) {
        return new Promise<WorkspaceRecords[K][]>((resolve, reject) => {
          const request = transaction.objectStore(store).getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }
      const [active, sessions, cycle] = await Promise.all([
        all('activeSession'),
        all('sessions'),
        all('cycle'),
      ]);
      return { active, sessions, cycle };
    } finally {
      db.close();
    }
  });
}

async function custom(page: Page, hours: string, minutes: string) {
  await button(page, 'Custom duration').click();
  const dialog = page.getByRole('dialog', { name: 'Custom duration' });
  await dialog.getByLabel('Hours').fill(hours);
  await dialog.getByLabel('Minutes').fill(minutes);
  return dialog;
}

async function breaks(page: Page, transition: 'manual' | 'automatic') {
  await button(page, 'Break settings').click();
  const dialog = page.getByRole('dialog', { name: 'Break settings' });
  await dialog.getByLabel('Short break minutes').fill('1');
  await dialog.getByLabel('Long break minutes').fill('2');
  await dialog.getByLabel('Focus sessions before a long break').fill('2');
  await dialog.getByLabel('Break transition').selectOption(transition);
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(dialog).toBeHidden();
}

test('validates break settings and keeps the draft until valid values are saved', async ({
  page,
}) => {
  await page.goto('/focus');
  await button(page, 'Break settings').click();
  const form = page.getByRole('dialog', { name: 'Break settings' });
  for (const [label, bad, message, good] of [
    ['Short break minutes', '61', '1 to 60', '60'],
    ['Long break minutes', '121', '1 to 120', '120'],
    ['Focus sessions before a long break', '13', '1 to 12', '12'],
  ]) {
    await form.getByLabel(label).fill(bad);
    await form.getByRole('button', { name: 'Apply' }).click();
    await expect(form.getByRole('alert')).toContainText(message);
    await expect(form.getByLabel(label)).toBeFocused();
    await form.getByLabel(label).fill(good);
  }
  await form.getByRole('button', { name: 'Apply' }).click();
  await expect(form).toBeHidden();
  await page.reload();
  await button(page, 'Break settings').click();
  await expect(form.getByLabel('Short break minutes')).toHaveValue('60');
  await expect(form.getByLabel('Long break minutes')).toHaveValue('120');
  await expect(
    form.getByLabel('Focus sessions before a long break'),
  ).toHaveValue('12');
});

test('failed Continue keeps the session paused and keyboard Retry resumes it', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    let failed = false;
    IDBObjectStore.prototype.put = function (value, key) {
      if (
        this.name === 'activeSession' &&
        value?.status === 'running' &&
        value.accumulatedActiveMs > 0 &&
        !failed
      ) {
        failed = true;
        throw new DOMException('Full', 'QuotaExceededError');
      }
      return put.call(this, value, key);
    };
  });
  await page.clock.install();
  await page.goto('/focus');
  await button(page, 'Start').click();
  await expect(button(page, 'Pause')).toBeVisible();
  await page.clock.fastForward(3000);
  await button(page, 'Stop').click();
  const dialog = page.getByRole('dialog', { name: 'Stop focus session?' });
  await dialog.getByRole('button', { name: 'Continue session' }).press('Enter');
  await expect(
    page.getByRole('alert').filter({ hasText: 'still paused' }),
  ).toBeVisible();
  expect((await persisted(page)).active[0].status).toBe('paused');
  await button(page, 'Retry timer action').press('Enter');
  await expect(button(page, 'Pause')).toBeFocused();
  expect((await persisted(page)).active[0].status).toBe('running');
});

test('settings changed in another tab apply to the next break without changing the active break', async ({
  page,
  context,
}) => {
  await page.clock.install();
  await page.goto('/focus');
  const duration = await custom(page, '0', '5');
  await duration.getByRole('button', { name: 'Apply' }).click();
  await button(page, 'Start').click();
  await expect(button(page, 'Pause')).toBeVisible();
  const peer = await context.newPage();
  await peer.goto('/focus');
  await expect(button(peer, 'Pause')).toBeVisible();
  // The settings row can also be changed by another supported client while a timer is active.
  await peer.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const q = indexedDB.open('doop-workspace');
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        const get = store.get('settings');
        get.onsuccess = () =>
          store.put({ ...get.result, shortBreakDurationMinutes: 2 });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
  await page.clock.fastForward(295_000);
  await page.clock.runFor(6000);
  await expect(
    page.getByRole('heading', { name: 'Short break' }),
  ).toBeVisible();
  expect((await persisted(page)).active[0].plannedDurationMs).toBe(120_000);
  await peer.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const q = indexedDB.open('doop-workspace');
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        const get = store.get('settings');
        get.onsuccess = () =>
          store.put({ ...get.result, shortBreakDurationMinutes: 3 });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Short break' }),
  ).toBeVisible();
  expect((await persisted(page)).active[0].plannedDurationMs).toBe(120_000);
});

test('validates durations, persists selections, extends repeatedly and saves an early stop as partial', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/focus');
  const timer = page.getByRole('timer');
  await button(page, '45 min').click();
  await expect(timer).toHaveText('45:00');
  await button(page, '60 min').click();
  await expect(timer).toHaveText('01:00:00');
  let dialog = await custom(page, '8', '5');
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(dialog.getByRole('alert')).toContainText('5 minutes to 8 hours');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(timer).toHaveText('01:00:00');
  dialog = await custom(page, '8', '0');
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(timer).toHaveText('08:00:00');
  dialog = await custom(page, '0', '5');
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await page.reload();
  await expect(timer).toHaveText('05:00');
  await button(page, 'Start').press('Enter');
  await button(page, 'Add 5 minutes').click();
  await expect
    .poll(async () => (await persisted(page)).active[0]?.plannedDurationMs)
    .toBe(600_000);
  await button(page, 'Add 5 minutes').click();
  await expect
    .poll(async () => (await persisted(page)).active[0]?.plannedDurationMs)
    .toBe(900_000);
  await page.clock.fastForward(45_000);
  await button(page, 'Stop').click();
  const stop = page.getByRole('dialog', { name: 'Stop focus session?' });
  await expect(
    stop.getByRole('button', { name: 'Continue session' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(button(page, 'Pause')).toBeVisible();
  await button(page, 'Stop').click();
  await stop.getByRole('button', { name: 'Save as partial' }).click();
  await expect(stop).toBeHidden();
  const data = await persisted(page);
  expect(data.sessions).toMatchObject([
    { type: 'timer', status: 'partial', plannedDurationSeconds: 900 },
  ]);
  expect(data.sessions[0].actualDurationSeconds).toBeGreaterThanOrEqual(45);
  expect(data.sessions[0].actualDurationSeconds).toBeLessThan(900);
  expect(data.active).toEqual([]);
  expect(data.cycle).toEqual([]);
  await button(page, 'Start').click();
  await button(page, 'Stop').click();
  await stop.getByRole('button', { name: 'Discard' }).click();
  await expect(stop).toBeHidden();
  expect((await persisted(page)).sessions).toHaveLength(1);
});

test('persists manual and automatic break choices and skips a long break without altering history', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/focus');
  const customDialog = await custom(page, '0', '5');
  await customDialog.getByRole('button', { name: 'Apply' }).click();
  await breaks(page, 'manual');
  await button(page, 'Start').click();
  await expect(button(page, 'Pause')).toBeVisible();
  await page.clock.fastForward(301_000);
  await expect(button(page, 'Start break')).toBeVisible();
  await page.reload();
  await expect(button(page, 'Start break')).toBeVisible();
  expect((await persisted(page)).cycle).toMatchObject([
    { completedFocusSessions: 1, pendingBreak: 'short' },
  ]);
  await button(page, 'Skip break').click();
  await expect(button(page, 'Start')).toBeVisible();
  expect((await persisted(page)).cycle).toMatchObject([
    { completedFocusSessions: 1, pendingBreak: null },
  ]);
  await breaks(page, 'automatic');
  await button(page, 'Start').click();
  await expect(button(page, 'Pause')).toBeVisible();
  await page.clock.fastForward(295_000);
  await page.clock.runFor(6000);
  await expect(page.getByRole('heading', { name: 'Long break' })).toBeVisible();
  expect((await persisted(page)).active).toMatchObject([
    { type: 'long-break', plannedDurationMs: 120_000 },
  ]);
  await button(page, 'Pause').click();
  await expect(button(page, 'Resume')).toBeVisible();
  await page.reload();
  await expect(button(page, 'Resume')).toBeVisible();
  await button(page, 'Resume').click();
  await expect(button(page, 'Pause')).toBeVisible();
  await button(page, 'Skip break').click();
  await expect(button(page, 'Start')).toBeVisible();
  const saved = await persisted(page);
  expect(saved.cycle).toMatchObject([
    { completedFocusSessions: 0, pendingBreak: null },
  ]);
  expect(saved.sessions).toMatchObject([
    { type: 'timer', status: 'completed', actualDurationSeconds: 300 },
    { type: 'timer', status: 'completed', actualDurationSeconds: 300 },
  ]);
});

test('recovers a running Stopwatch after closing its tab and saves elapsed time without advancing the cycle', async ({
  page,
  context,
}) => {
  await page.clock.install({ time: new Date('2026-11-23T23:59:50Z') });
  await page.goto('/focus');
  await button(page, 'Stopwatch').click();
  await button(page, 'Start').click();
  await expect(button(page, 'Pause')).toBeVisible();
  const active = (await persisted(page)).active[0];
  const reopenedAt = new Date(Date.parse(active.startedAt) + 20_000);
  await page.close();
  const reopened = await context.newPage();
  await reopened.clock.setFixedTime(reopenedAt);
  await reopened.goto('/focus');
  await expect(
    reopened.getByRole('heading', { name: 'Stopwatch' }),
  ).toBeVisible();
  await expect(reopened.getByRole('timer')).toHaveText(/^\s*00:2/);
  await button(reopened, 'Stop').click();
  const stop = reopened.getByRole('dialog', { name: 'Stop stopwatch?' });
  await stop.getByRole('button', { name: 'Save session' }).click();
  await expect(stop).toBeHidden();
  const data = await persisted(reopened);
  expect(data.active).toEqual([]);
  expect(data.cycle).toEqual([]);
  expect(data.sessions).toMatchObject([
    { type: 'stopwatch', plannedDurationSeconds: null, status: 'completed' },
  ]);
  expect(data.sessions[0].actualDurationSeconds).toBeGreaterThanOrEqual(20);
});

test('a subsecond Stopwatch can be discarded but cannot be saved', async ({
  page,
}) => {
  await page.goto('/focus');
  await button(page, 'Stopwatch').click();
  await page.evaluate(() => {
    const moment = performance.now();
    performance.now = () => moment;
  });
  await button(page, 'Start').press('Enter');
  await expect(button(page, 'Pause')).toBeVisible();
  await button(page, 'Stop').press('Enter');
  const stop = page.getByRole('dialog', { name: 'Stop stopwatch?' });
  await expect(
    stop.getByRole('button', { name: 'Save session' }),
  ).toBeDisabled();
  await stop.getByRole('button', { name: 'Discard' }).press('Enter');
  await expect(stop).toBeHidden();
  expect((await persisted(page)).sessions).toEqual([]);
});
