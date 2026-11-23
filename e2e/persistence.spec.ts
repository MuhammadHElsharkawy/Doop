import { expect, test } from '@playwright/test';

test('opens the workspace database and creates the occurrence constraint', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByText('Opening local workspace storage…')).toBeHidden();

  const schema = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('doop-workspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const occurrence = db
        .transaction('completions')
        .objectStore('completions')
        .index('byOccurrence');
      return {
        version: db.version,
        stores: Array.from(db.objectStoreNames),
        unique: occurrence.unique,
      };
    } finally {
      db.close();
    }
  });

  expect(schema).toEqual({
    version: 3,
    stores: [
      'activeSession',
      'completions',
      'cycle',
      'habits',
      'schedules',
      'sessions',
      'settings',
      'tasks',
    ],
    unique: true,
  });
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('shows an Arabic storage failure and recovers using the keyboard', async ({
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
    const open = indexedDB.open.bind(indexedDB);
    let fail = true;
    indexedDB.open = (name, version) => {
      if (fail) {
        fail = false;
        throw new DOMException('Database unavailable', 'SecurityError');
      }
      return open(name, version);
    };
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('alert')).toContainText(
    'تعذّر على Doop فتح بيانات',
  );
  await page
    .getByRole('button', { name: 'إعادة محاولة فتح التخزين' })
    .press('Enter');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'نظرة عامة' })).toBeVisible();
  await expect(page.getByRole('main')).toBeFocused();
  await expect(
    page.getByRole('region', { name: 'هدف التركيز' }).getByRole('progressbar'),
  ).toBeVisible();
});

test('reports a blocked migration and completes when the old connection closes', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const old = indexedDB.open('doop-workspace', 1);
    old.onupgradeneeded = () => {
      for (const store of [
        'tasks',
        'habits',
        'schedules',
        'completions',
        'sessions',
        'activeSession',
        'cycle',
        'settings',
      ]) {
        old.result.createObjectStore(store, { keyPath: 'id' });
      }
    };
    old.onsuccess = () => {
      window.addEventListener('release-legacy-db', () => old.result.close(), {
        once: true,
      });
    };
  });
  await page.goto('/');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Close other Doop tabs');
  await page.evaluate(() =>
    window.dispatchEvent(new Event('release-legacy-db')),
  );
  await expect(alert).toHaveCount(0);
});

test('keeps the migration warning and source data when a legacy upgrade fails', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const old = indexedDB.open('doop-workspace', 2);
    old.onupgradeneeded = () => {
      for (const name of [
        'tasks',
        'habits',
        'schedules',
        'completions',
        'sessions',
        'activeSession',
        'cycle',
        'settings',
      ]) {
        const store = old.result.createObjectStore(name, { keyPath: 'id' });
        if (name === 'schedules')
          store.add({
            id: 'legacy-schedule',
            habitId: 'missing-habit',
            weekdays: [1],
            effectiveFrom: '2024-05-01',
            effectiveTo: null,
            createdAt: '2024-05-01T10:00:00.000Z',
          });
      }
    };
    old.onsuccess = () => old.result.close();
  });
  await page.goto('/');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Your previous data is still intact.');
  await page.getByRole('button', { name: 'Retry storage' }).press('Enter');
  await expect(alert).toContainText('Your previous data is still intact.');
  await expect(page.getByRole('main')).toBeFocused();
  const stored = await page.evaluate(
    () =>
      new Promise<{ version: number; count: number }>((resolve, reject) => {
        const old = indexedDB.open('doop-workspace', 2);
        old.onerror = () => reject(old.error);
        old.onsuccess = () => {
          const db = old.result;
          const count = db
            .transaction('schedules')
            .objectStore('schedules')
            .count();
          count.onsuccess = () => {
            resolve({ version: db.version, count: count.result });
            db.close();
          };
          count.onerror = () => {
            db.close();
            reject(count.error);
          };
        };
      }),
  );
  expect(stored).toEqual({ version: 2, count: 1 });
});
