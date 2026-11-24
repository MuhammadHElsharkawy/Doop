import { expect, test } from '@playwright/test';

test('navigates all destinations with keyboard and viewport-appropriate navigation', async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page).toHaveTitle('Overview · Doop');

  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to main content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  const main = page.getByRole('main');
  await expect(main).toBeFocused();
  await expect(
    main.getByRole('heading', { name: 'Today’s tasks' }),
  ).toBeVisible();

  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  const toggle = page.getByRole('button', { name: 'Collapse sidebar' });
  if (isMobile) {
    await expect(toggle).toBeHidden();
    const box = await navigation.boundingBox();
    expect(box && box.y + box.height).toBe(page.viewportSize()?.height);
  } else {
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.press('Enter');
    const expand = page.getByRole('button', { name: 'Expand sidebar' });
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expand.press('Enter');
  }

  for (const name of ['Tasks', 'Habits', 'Focus', 'Progress', 'Overview']) {
    const link = navigation.getByRole('link', { name, exact: true });
    await link.press('Enter');
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(main.getByRole('heading', { name, level: 1 })).toBeVisible();
    await expect(main).toBeFocused();
  }

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  if (!isMobile) {
    await page.setViewportSize({ width: 768, height: 900 });
    await expect(toggle).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('applies all six themes, independent appearance, and persistent RTL preferences', async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/tasks');
  const root = page.locator('html');
  const scheme = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  const background = () =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const accent = () =>
    page
      .getByRole('link', { name: 'Tasks', exact: true })
      .evaluate((link) => getComputedStyle(link).color);
  const darkBackground = await background();
  const settings = page.getByRole('button', { name: 'Settings' });
  await settings.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  const dialogBox = await dialog.boundingBox();
  if (isMobile) {
    expect(dialogBox && dialogBox.y + dialogBox.height).toBe(
      page.viewportSize()?.height,
    );
  }
  await page
    .locator('#primary-navigation a')
    .first()
    .evaluate((link) => link.focus());
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();

  const colors = new Set<string>();
  for (const name of ['Emerald', 'Slate', 'Indigo', 'Teal', 'Rose', 'Amber']) {
    await dialog.getByRole('radio', { name, exact: true }).check();
    await expect(root).toHaveAttribute('data-theme', name.toLowerCase());
    colors.add(
      await page
        .locator('nav a[aria-current="page"]')
        .evaluate((link) => getComputedStyle(link).color),
    );
  }
  expect(colors.size).toBe(6);

  await dialog.getByRole('radio', { name: 'Light', exact: true }).check();
  await expect.poll(scheme).toBe('light');
  await expect.poll(background).not.toBe(darkBackground);
  await expect(root).toHaveAttribute('data-theme', 'amber');
  await dialog.getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect.poll(scheme).toBe('dark');
  await expect.poll(background).toBe(darkBackground);
  await dialog.getByRole('radio', { name: 'System', exact: true }).check();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(background).not.toBe(darkBackground);
  await dialog.getByRole('radio', { name: 'Dark', exact: true }).check();

  await dialog.getByRole('radio', { name: 'العربية' }).check();
  const arabicDialog = page.getByRole('dialog', { name: 'الإعدادات' });
  await expect(arabicDialog).toBeVisible();
  await expect(root).toHaveAttribute('dir', 'rtl');
  await expect(root).toHaveAttribute('lang', 'ar');
  await page.keyboard.press('Escape');
  await expect(arabicDialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'الإعدادات' })).toBeFocused();

  await page.reload();
  await expect(root).toHaveAttribute('dir', 'rtl');
  await expect(root).toHaveAttribute('data-appearance', 'dark');
  await expect(root).toHaveAttribute('data-theme', 'amber');
  await expect(page.getByRole('heading', { name: 'المهام' })).toBeVisible();
  await expect(page).toHaveTitle('المهام · Doop');
  const nav = page.getByRole('navigation', { name: 'التنقل الرئيسي' });
  const first = await nav.getByRole('link').first().boundingBox();
  const last = await nav.getByRole('link').last().boundingBox();
  if (isMobile) expect(first && last && first.x > last.x).toBe(true);
  else
    expect(first?.x ?? 0).toBeGreaterThan(
      (page.viewportSize()?.width ?? 0) / 2,
    );
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  await page.getByRole('button', { name: 'الإعدادات' }).click();
  await arabicDialog.getByRole('radio', { name: 'English' }).check();
  await expect(root).toHaveAttribute('dir', 'ltr');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();
  expect(await accent()).toBeTruthy();
});

test('keeps settings usable when IndexedDB rejects preference writes', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (record, key) {
      if (this.name === 'metadata')
        throw new DOMException('Storage is unavailable', 'QuotaExceededError');
      return put.call(this, record, key);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Slate', exact: true }).check();
  await expect(dialog.getByRole('alert')).toContainText('Changes may be lost');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'slate');
  await page.keyboard.press('Escape');
  await expect(
    page
      .getByRole('main')
      .getByRole('alert')
      .filter({ hasText: 'Changes may be lost' }),
  ).toBeVisible();
});
