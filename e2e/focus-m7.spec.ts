import { expect, test, type Page } from '@playwright/test';
import type { WorkspaceRecords } from '../src/app/core/domain/workspace-records';

const button = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true });
const nav = (page: Page, name: string) =>
  page.getByRole('navigation').getByRole('link', { name, exact: true });

async function createTask(page: Page) {
  await page.goto('/tasks');
  await button(page, 'Add task').click();
  const form = page.getByRole('dialog', { name: 'Add task' });
  await form.getByLabel('Task title').fill('Read project notes');
  await form.getByLabel('Expected focus sessions').fill('3');
  await form.getByRole('button', { name: 'Save task' }).click();
  await expect(form).toBeHidden();
}

async function readFocus(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('doop-workspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = db.transaction(['sessions', 'cycle', 'activeSession']);
      function all<K extends 'sessions' | 'cycle' | 'activeSession'>(store: K) {
        return new Promise<WorkspaceRecords[K][]>((resolve, reject) => {
          const request = tx.objectStore(store).getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }
      const [sessions, cycle, active] = await Promise.all([
        all('sessions'),
        all('cycle'),
        all('activeSession'),
      ]);
      return { sessions, cycle, active };
    } finally {
      db.close();
    }
  });
}

test.use({ timezoneId: 'Africa/Cairo' });

test('links both modes, preserves snapshots, and excludes partial and discarded sessions from metrics', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-22T22:30:00Z') });
  await createTask(page);
  await nav(page, 'Focus').click();
  await expect(page.getByText('0 of 6 sessions')).toBeVisible();
  const task = page.getByLabel('Task (optional)');
  await task.selectOption({ label: 'Read project notes' });
  await button(page, 'Stopwatch').click();
  await button(page, 'Start').click();
  await expect(button(page, 'Pause')).toBeVisible();
  await page.clock.fastForward(4000);
  await button(page, 'Stop').click();
  await button(page, 'Save session').click();
  await expect(page.getByText('1 of 6 sessions')).toBeVisible();
  const history = page.getByRole('region', { name: 'Focus history' });
  await expect(history.getByText('Read project notes')).toBeVisible();
  await expect(history.getByText('Completed', { exact: true })).toBeVisible();
  const goal = page.getByLabel('Daily goal (sessions)');
  await goal.fill('0');
  await button(page, 'Save goal').click();
  await expect(goal).toBeFocused();
  await expect(goal).toHaveAttribute('aria-invalid', 'true');
  await goal.fill('1');
  await button(page, 'Save goal').click();
  await expect(page.getByText('Daily goal reached')).toBeVisible();

  await nav(page, 'Tasks').click();
  await expect(page.getByText('1 of 3 focus sessions')).toBeVisible();
  await button(page, 'Edit · Read project notes').click();
  const edit = page.getByRole('dialog', { name: 'Edit task' });
  await edit.getByLabel('Task title').fill('Read final brief');
  await edit.getByRole('button', { name: 'Save task' }).click();
  await expect(edit).toBeHidden();

  await nav(page, 'Focus').click();
  await task.selectOption({ label: 'Read final brief' });
  await button(page, 'Start').click();
  await expect(button(page, 'Pause')).toBeVisible();
  await page.clock.fastForward(3000);
  await button(page, 'Stop').click();
  await button(page, 'Save as partial').click();
  await expect(history.getByText('Partial', { exact: true })).toBeVisible();
  await expect(history.getByRole('listitem').first()).toContainText(
    'Read final brief',
  );
  await expect(page.getByText('1 of 1 sessions')).toBeVisible();
  await button(page, 'Start').click();
  await expect(button(page, 'Pause')).toBeVisible();
  await button(page, 'Stop').click();
  await button(page, 'Discard').click();
  await expect(history.getByRole('listitem')).toHaveCount(2);
  expect(await readFocus(page)).toMatchObject({ cycle: [], active: [] });

  await nav(page, 'Tasks').click();
  await expect(page.getByText('1 of 3 focus sessions')).toBeVisible();
  await button(page, 'Delete · Read final brief').click();
  await page
    .getByRole('dialog', { name: 'Delete task' })
    .getByRole('button', { name: 'Delete task' })
    .click();
  await expect(page.getByText('Task deleted.')).toBeVisible();
  await nav(page, 'Focus').click();
  await page.reload();
  await expect(goal).toHaveValue('1');
  await expect(history.getByRole('listitem')).toHaveCount(2);
  await expect(history.getByText('Read project notes')).toBeVisible();
  await expect(history.getByText('Read final brief')).toBeVisible();
  await expect(task.locator('option')).toHaveCount(1);
  const filter = history.getByLabel('Filter by date');
  await filter.fill('2026-11-22');
  await expect(
    history.getByText('No saved sessions for this date.'),
  ).toBeVisible();
  await filter.fill('2026-11-23');
  await expect(history.getByRole('listitem')).toHaveCount(2);
  await history.getByRole('button', { name: 'All dates' }).press('Enter');
  await expect(filter).toHaveValue('');
});

test('history deletion is retryable, synchronizes task progress, and leaves the timer cycle intact', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    const remove = IDBObjectStore.prototype.delete;
    let failed = false;
    IDBObjectStore.prototype.delete = function (key) {
      if (this.name === 'sessions' && !failed) {
        failed = true;
        throw new DOMException('Full', 'QuotaExceededError');
      }
      return remove.call(this, key);
    };
  });
  await page.clock.install();
  await createTask(page);
  await nav(page, 'Focus').click();
  await page
    .getByLabel('Task (optional)')
    .selectOption({ label: 'Read project notes' });
  await button(page, 'Start').click();
  await expect(button(page, 'Pause')).toBeVisible();
  await page.clock.fastForward(25 * 60_000 + 1000);
  await expect(page.getByText('1 of 6 sessions')).toBeVisible();
  await expect(page.getByText('25 min', { exact: true }).first()).toBeVisible();
  const previous = await readFocus(page);
  expect(previous.cycle[0]?.completedFocusSessions).toBe(1);
  expect(previous.sessions[0]).toMatchObject({
    status: 'completed',
    type: 'timer',
    actualDurationSeconds: 1500,
    plannedDurationSeconds: 1500,
  });
  const taskPage = await context.newPage();
  await taskPage.goto('/tasks');
  await expect(taskPage.getByText('1 of 3 focus sessions')).toBeVisible();

  const history = page.getByRole('region', { name: 'Focus history' });
  const trigger = history.getByRole('button', { name: /Delete session/ });
  const confirm = page.getByRole('dialog', {
    name: 'Delete this focus session?',
  });
  await trigger.press('Enter');
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  const remove = confirm.getByRole('button', { name: 'Delete session' });
  await remove.press('Enter');
  await expect(confirm.getByRole('alert')).toContainText('couldn’t be deleted');
  await expect(remove).toBeFocused();
  expect((await readFocus(page)).sessions).toEqual(previous.sessions);
  await remove.press('Enter');
  await expect(confirm).toBeHidden();
  await expect(history.getByLabel('Filter by date')).toBeFocused();
  await expect(history.getByText('No sessions saved yet.')).toBeVisible();
  await expect(page.getByText('0 of 6 sessions')).toBeVisible();
  await expect(page.getByText('0 sec', { exact: true })).toBeVisible();
  await expect(taskPage.getByText('0 of 3 focus sessions')).toBeVisible();
  expect(await readFocus(page)).toEqual({ ...previous, sessions: [] });
});

test('ambient playback requires a gesture, keeps one source, and is independent of the timer and route', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const start = AudioBufferSourceNode.prototype.start;
    const stop = AudioBufferSourceNode.prototype.stop;
    let sources = 0;
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.dataset['audioSources'] = '0';
    });
    AudioBufferSourceNode.prototype.start = function (when, offset, duration) {
      start.call(this, when, offset, duration);
      document.documentElement.dataset['audioSources'] = String(++sources);
    };
    AudioBufferSourceNode.prototype.stop = function (when) {
      stop.call(this, when);
      document.documentElement.dataset['audioSources'] = String(--sources);
    };
  });
  await page.goto('/focus');
  const panel = page.getByRole('region', { name: 'Ambient sound' });
  const root = page.locator('html');
  const sound = panel.getByLabel('Sound', { exact: true });
  const volume = panel.getByRole('slider');
  await sound.selectOption('rain');
  await expect(root).toHaveAttribute('data-audio-sources', '0');
  await button(page, 'Play sound').press('Enter');
  await expect(panel.getByRole('status')).toHaveText('Sound playing');
  await expect(root).toHaveAttribute('data-audio-sources', '1');
  await button(page, 'Start').click();
  await button(page, 'Pause').click();
  await expect(root).toHaveAttribute('data-audio-sources', '1');
  await nav(page, 'Tasks').click();
  await expect(root).toHaveAttribute('data-audio-sources', '1');
  await nav(page, 'Focus').click();
  await expect(panel.getByRole('status')).toHaveText('Sound playing');
  await button(page, 'Pause sound').press('Enter');
  await expect(panel.getByRole('status')).toHaveText('Sound paused');
  await expect(root).toHaveAttribute('data-audio-sources', '0');
  await button(page, 'Play sound').press('Enter');
  await expect(root).toHaveAttribute('data-audio-sources', '1');
  for (const choice of ['ocean-waves', 'coffee-shop', 'forest']) {
    await sound.selectOption(choice);
    await expect(root).toHaveAttribute('data-audio-sources', '0');
    await button(page, 'Play sound').press('Enter');
    await expect(root).toHaveAttribute('data-audio-sources', '1');
  }
  await volume.press('Home');
  await expect(volume).toHaveValue('0');
  await expect(volume).toBeFocused();
  await button(page, 'Stop sound').press('Enter');
  await expect(root).toHaveAttribute('data-audio-sources', '0');
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('doop-workspace');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          return await new Promise<number>((resolve, reject) => {
            const request = db
              .transaction('settings')
              .objectStore('settings')
              .get('settings');
            request.onsuccess = () => resolve(request.result?.ambientVolume);
            request.onerror = () => reject(request.error);
          });
        } finally {
          db.close();
        }
      }),
    )
    .toBe(0);
  await page.reload();
  await expect(sound).toHaveValue('forest');
  await expect(volume).toHaveValue('0');
  await expect(panel.getByRole('status')).toHaveText('Sound stopped');
  await expect(root).toHaveAttribute('data-audio-sources', '0');
});

test('sound preferences and playback can be retried independently', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    let failedWrite = false;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'settings' && value.ambientSound && !failedWrite) {
        failedWrite = true;
        throw new DOMException('Full', 'QuotaExceededError');
      }
      return put.call(this, value, key);
    };
    const resume = AudioContext.prototype.resume;
    let blocked = true;
    AudioContext.prototype.resume = function () {
      if (!blocked) return resume.call(this);
      blocked = false;
      return Promise.reject(
        new DOMException('Audio blocked', 'NotAllowedError'),
      );
    };
  });
  await page.goto('/focus');
  const panel = page.getByRole('region', { name: 'Ambient sound' });
  const sound = panel.getByLabel('Sound', { exact: true });
  await sound.selectOption('rain');
  await expect(
    panel.getByText('Sound preferences couldn’t be saved.'),
  ).toBeVisible();
  await button(page, 'Retry saving sound preferences').press('Enter');
  await expect(button(page, 'Retry saving sound preferences')).toBeHidden();
  await button(page, 'Play sound').press('Enter');
  await expect(panel.getByRole('alert')).toContainText('Sound couldn’t start.');
  await button(page, 'Play sound').press('Enter');
  await expect(panel.getByRole('status')).toHaveText('Sound playing');
  await page.reload();
  await expect(sound).toHaveValue('rain');
  await expect(panel.getByRole('status')).toHaveText('Sound stopped');
});

test('new controls fit narrow and tablet layouts with Arabic and dark appearance', async ({
  page,
}) => {
  await page.goto('/focus');
  await button(page, 'Settings').press('Enter');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Dark', exact: true }).check();
  await dialog.getByRole('radio', { name: 'العربية' }).check();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 820 });
    await expect(page.getByLabel('المهمة (اختيارية)')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'أصوات الخلفية' }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'سجلّ التركيز' }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth <= root.clientWidth;
      }),
    ).toBe(true);
  }
});
