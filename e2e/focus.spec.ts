import { expect, test } from '@playwright/test';
import { setTimeout as wait } from 'node:timers/promises';

test('catches up after Chromium freezes the page lifecycle', async ({
  page,
}) => {
  await page.goto('/focus');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  const readSeconds = async () => {
    const [minutes, seconds] = (
      await page.getByRole('timer').innerText()
    ).split(':');
    return Number(minutes) * 60 + Number(seconds);
  };
  const before = await readSeconds();
  const client = await page.context().newCDPSession(page);
  await client.send('Page.setWebLifecycleState', { state: 'frozen' });
  try {
    await wait(2500);
  } finally {
    await client.send('Page.setWebLifecycleState', { state: 'active' });
    await client.detach();
  }
  await expect.poll(readSeconds).toBeLessThanOrEqual(before - 2);
});

test('recovers running and paused timers across navigation and refresh', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/focus');
  const timer = page.getByRole('timer');
  await expect(timer).toHaveText('25:00');
  await page.getByRole('button', { name: 'Start', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.clock.fastForward(60_000);
  await page.getByRole('link', { name: 'Overview' }).click();
  await page.getByRole('link', { name: 'Focus' }).click();
  await page.reload();
  await expect(timer).toHaveText(/^\s*2[34]:/);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  const paused = (await timer.innerText()).trim();
  await page.clock.fastForward(120_000);
  await page.reload();
  await expect(timer).toHaveText(paused);
  await page.getByRole('button', { name: 'Resume' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.clock.fastForward(5000);
  await expect(timer).not.toHaveText(paused);
});

test('finishes after skipped callbacks and recovers at the persisted deadline exactly once', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/focus');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.clock.fastForward(26 * 60_000);
  await expect(
    page.getByRole('button', { name: 'Start another session' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start another session' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.clock.fastForward(30 * 60_000);
  await expect(page.getByText('Focus session complete')).toBeVisible();
  await page.goto('/overview');
  await page.getByRole('link', { name: 'Focus' }).click();
  await expect(page.getByRole('timer')).toHaveText('00:00');
  await expect(page.getByText('Focus session complete')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Focus session complete')).toBeVisible();
  const count = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('doop-workspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<number>((resolve, reject) => {
        const request = db
          .transaction('sessions')
          .objectStore('sessions')
          .count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  });
  expect(count).toBe(2);
});

test('shows a localized Arabic timer and retains the idle state after a failed start', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'doop.preferences',
      JSON.stringify({
        appearance: 'system',
        theme: 'emerald',
        language: 'ar',
      }),
    );
    const put = IDBObjectStore.prototype.put;
    let failed = false;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'activeSession' && !failed) {
        failed = true;
        throw new DOMException('Full', 'QuotaExceededError');
      }
      return put.call(this, value, key);
    };
  });
  await page.goto('/focus');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('timer')).toHaveText(
    new Intl.NumberFormat('ar', { minimumIntegerDigits: 2 }).format(25) +
      ':' +
      new Intl.NumberFormat('ar', { minimumIntegerDigits: 2 }).format(0),
  );
  await page.getByRole('button', { name: 'ابدأ', exact: true }).click();
  await expect(page.getByText('جاهز للتركيز')).toBeVisible();
  await page
    .getByRole('button', { name: 'إعادة محاولة إجراء المؤقت' })
    .press('Enter');
  await expect(page.getByRole('button', { name: 'إيقاف مؤقت' })).toBeVisible();
});
