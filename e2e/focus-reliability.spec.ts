import { expect, test, type Page } from '@playwright/test';
import type { WorkspaceRecords } from '../src/app/core/domain/workspace-records';

async function readStore<K extends keyof WorkspaceRecords>(
  page: Page,
  name: K,
): Promise<WorkspaceRecords[K][]> {
  return page.evaluate(async (store) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('doop-workspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<WorkspaceRecords[K][]>((resolve, reject) => {
        const request = db.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }, name);
}

async function running(page: Page) {
  await page.goto('/focus');
  await control(page, 'Start').click();
  await expect(control(page, 'Pause')).toBeVisible();
}

function control(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true });
}

test('forward and backward wall jumps leave the live countdown monotonic and survive refresh after re-anchor', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-23T12:00:00Z') });
  await running(page);
  const [initial] = await readStore(page, 'activeSession');
  const timer = page.getByRole('timer');
  await page.clock.fastForward(60_000);
  await page.clock.setSystemTime(new Date('2026-11-23T13:00:00Z'));
  await page.clock.fastForward(500);
  await expect
    .poll(
      async () => (await readStore(page, 'activeSession'))[0]?.timing?.revision,
    )
    .not.toBe(initial.timing?.revision);
  await expect(timer).toHaveText(/^\s*2[34]:/);
  const [forward] = await readStore(page, 'activeSession');
  await page.clock.setSystemTime(new Date('2026-11-23T11:00:00Z'));
  await page.clock.fastForward(1_000);
  await expect
    .poll(
      async () => (await readStore(page, 'activeSession'))[0]?.timing?.revision,
    )
    .not.toBe(forward.timing?.revision);
  expect((await readStore(page, 'activeSession'))[0]?.resumedAt).toBe(
    initial.resumedAt,
  );
  expect(await readStore(page, 'sessions')).toEqual([]);
  await page.reload();
  await expect(timer).toHaveText(/^\s*2[34]:/);
  await control(page, 'Pause').click();
  await expect(control(page, 'Resume')).toBeVisible();
  const paused = (await timer.innerText()).trim();
  await page.clock.setSystemTime(new Date('2026-11-23T09:00:00Z'));
  await page.clock.fastForward(3000);
  await expect(timer).toHaveText(paused);
  await control(page, 'Resume').click();
  await page.clock.fastForward(5000);
  await expect(timer).not.toHaveText(paused);
});

test('a new tab checks live peer evidence before recovering an apparently expired timer', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    const browserWindow: Window = window;
    const schedule = browserWindow.setInterval.bind(browserWindow);
    browserWindow.setInterval = (
      handler: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) => (delay === 250 ? 0 : schedule(handler, delay, ...args));
  });
  await running(page);
  const [active] = await readStore(page, 'activeSession');
  const jumpClock = () => {
    const wall = Date.now.bind(Date);
    Date.now = () => wall() + 3_600_000;
  };
  await page.evaluate(jumpClock);
  const peer = await context.newPage();
  await peer.addInitScript(jumpClock);
  await peer.goto('/focus');
  await expect
    .poll(
      async () => (await readStore(peer, 'activeSession'))[0]?.timing?.revision,
    )
    .not.toBe(active.timing?.revision);
  await expect(peer.getByRole('timer')).toHaveText(/^\s*2[45]:/);
  expect(await readStore(peer, 'sessions')).toEqual([]);
});

test('two open tabs update each other after committed start, pause and resume', async ({
  page,
  context,
}) => {
  const peer = await context.newPage();
  await peer.goto('/focus');
  await expect(control(peer, 'Start')).toBeVisible();
  await running(page);
  await expect(control(peer, 'Pause')).toBeVisible();
  await control(peer, 'Pause').click();
  await expect(control(page, 'Resume')).toBeVisible();
  await control(page, 'Resume').click();
  await expect(control(peer, 'Pause')).toBeVisible();
});

test('a missed notification cannot apply stale pause or resume and visible polling reconciles', async ({
  page,
  context,
}) => {
  await running(page);
  const peer = await context.newPage();
  await peer.addInitScript(() => {
    Object.defineProperty(window, 'BroadcastChannel', { value: undefined });
    const browserWindow: Window = window;
    const schedule = browserWindow.setInterval.bind(browserWindow);
    browserWindow.setInterval = (
      handler: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) => {
      if (delay === 250 && typeof handler === 'function') {
        window.addEventListener('test-tick', () => handler());
        return 0;
      }
      return schedule(handler, delay, ...args);
    };
  });
  await peer.goto('/focus');
  await expect(control(peer, 'Pause')).toBeVisible();
  await control(page, 'Pause').click();
  await expect(control(page, 'Resume')).toBeVisible();
  await control(page, 'Resume').click();
  await expect(control(page, 'Pause')).toBeVisible();
  const [newRun] = await readStore(page, 'activeSession');
  await control(peer, 'Pause').dispatchEvent('click');
  await expect(
    peer.getByText('The timer changed in another tab.', { exact: false }),
  ).toBeVisible();
  expect((await readStore(page, 'activeSession'))[0]).toEqual(newRun);
  await control(page, 'Pause').click();
  await expect(control(page, 'Resume')).toBeVisible();
  await peer.evaluate(() => {
    const clock = performance.now.bind(performance);
    const wall = Date.now.bind(Date);
    performance.now = () => clock() + 3000;
    Date.now = () => wall() + 3000;
    window.dispatchEvent(new Event('test-tick'));
  });
  await expect(control(peer, 'Resume')).toBeVisible();
  await control(page, 'Resume').click();
  await expect(control(page, 'Pause')).toBeVisible();
  await control(peer, 'Resume').dispatchEvent('click');
  await expect(control(peer, 'Pause')).toBeVisible();
  await expect(
    peer.getByText('The timer changed in another tab.', { exact: false }),
  ).toBeVisible();
});

test('reopening after midnight and a zone change uses the persisted zone and deadline once', async ({
  page,
  context,
}) => {
  const original = await context.newCDPSession(page);
  await original.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  await page.clock.setFixedTime(new Date('2026-11-23T23:50:00Z'));
  await running(page);
  await page.close();
  const reopened = await context.newPage();
  const destination = await context.newCDPSession(reopened);
  await destination.send('Emulation.setTimezoneOverride', {
    timezoneId: 'America/Los_Angeles',
  });
  await reopened.clock.setFixedTime(new Date('2026-11-24T01:00:00Z'));
  await reopened.goto('/focus');
  await expect(control(reopened, 'Start another session')).toBeVisible();
  await reopened.reload();
  await expect(control(reopened, 'Start another session')).toBeVisible();
  expect(await readStore(reopened, 'sessions')).toMatchObject([
    {
      endedAt: '2026-11-24T00:15:00.000Z',
      completionLocalDate: '2026-11-24',
      completionTimezoneOffsetMinutes: 0,
      status: 'completed',
      plannedDurationSeconds: 1500,
      actualDurationSeconds: 1500,
    },
  ]);
  expect(await readStore(reopened, 'activeSession')).toEqual([]);
  expect(await readStore(reopened, 'cycle')).toEqual([
    { id: 'cycle', completedFocusSessions: 1, pendingBreak: 'short' },
  ]);
});

test('retrying a failed pause cannot overwrite a newer running revision', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'activeSession' && value?.status === 'paused')
        throw new DOMException('Full', 'QuotaExceededError');
      return put.call(this, value, key);
    };
  });
  await running(page);
  await control(page, 'Pause').click();
  const retry = control(page, 'Retry timer action');
  await expect(retry).toBeVisible();
  const peer = await context.newPage();
  await peer.goto('/focus');
  await control(peer, 'Pause').click();
  await control(peer, 'Resume').click();
  await expect(control(peer, 'Pause')).toBeVisible();
  const [latest] = await readStore(peer, 'activeSession');
  await retry.press('Enter');
  await expect(
    page.getByText('The timer changed in another tab.', { exact: false }),
  ).toBeVisible();
  await expect(control(page, 'Pause')).toBeFocused();
  expect((await readStore(page, 'activeSession'))[0]).toEqual(latest);
});

test('failed completion rolls back all stores and keyboard retry preserves then restores focus', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    let failures = 2;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'cycle' && failures-- > 0)
        throw new DOMException('Full', 'QuotaExceededError');
      return put.call(this, value, key);
    };
  });
  await page.clock.install();
  await running(page);
  const active = await readStore(page, 'activeSession');
  await page.clock.fastForward(26 * 60_000);
  const retry = control(page, 'Retry timer action');
  await expect(retry).toBeVisible();
  expect(await readStore(page, 'activeSession')).toEqual(active);
  expect(await readStore(page, 'sessions')).toEqual([]);
  expect(await readStore(page, 'cycle')).toEqual([]);
  await retry.press('Enter');
  await expect(retry).toHaveAttribute('aria-disabled', 'false');
  await expect(retry).toBeFocused();
  await retry.press('Enter');
  await expect(control(page, 'Start another session')).toBeFocused();
  expect(await readStore(page, 'activeSession')).toEqual([]);
  expect(await readStore(page, 'sessions')).toMatchObject([
    {
      endedAt: new Date(
        Date.parse(active[0].startedAt) + 1500000,
      ).toISOString(),
      status: 'completed',
      actualDurationSeconds: 1500,
      plannedDurationSeconds: 1500,
    },
  ]);
  expect(await readStore(page, 'cycle')).toEqual([
    { id: 'cycle', completedFocusSessions: 1, pendingBreak: 'short' },
  ]);
});

test('invalid persisted anchors show a distinct error and the original record is preserved', async ({
  page,
}) => {
  await page.goto('/focus');
  await expect(control(page, 'Start')).toBeVisible();
  const invalid = await page.evaluate(async () => {
    const row = {
      id: 'active',
      sessionId: 'invalid',
      type: 'timer',
      status: 'running',
      startedAt: '2026-01-01T12:00:00.000Z',
      resumedAt: '2026-01-01T11:00:00.000Z',
      accumulatedActiveMs: 0,
      plannedDurationMs: 1500000,
      taskId: null,
      taskTitleSnapshot: null,
    };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('doop-workspace');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('activeSession', 'readwrite');
        tx.objectStore('activeSession').put(row);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
    return row;
  });
  await page.reload();
  await expect(
    page.getByRole('alert').filter({ hasText: 'inconsistent timing data' }),
  ).toBeVisible();
  await expect(control(page, 'Retry timer action')).toHaveCount(0);
  expect(await readStore(page, 'activeSession')).toEqual([invalid]);
  expect(await readStore(page, 'sessions')).toEqual([]);
});
