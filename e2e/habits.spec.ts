import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Africa/Cairo' });

test('refreshes scheduled habits in an open Overview at local midnight', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-03-07T21:59:00Z') });
  await page.goto('/overview');
  await page.getByRole('button', { name: 'Add habit' }).click();
  const form = page.getByRole('dialog', { name: 'Add habit' });
  await expect(form.getByLabel('Start date')).toHaveValue('2026-03-07');
  await form.getByLabel('Habit name').fill('Sunday reading');
  await form.getByRole('radio', { name: 'Selected weekdays' }).check();
  await form.getByRole('checkbox', { name: 'Sunday' }).check();
  await form.getByRole('button', { name: 'Save habit' }).click();
  await expect(form).toBeHidden();
  const today = page.getByRole('region', { name: 'Today’s Habits' });
  await expect(today.getByText('Sunday reading')).toHaveCount(0);
  const date = page.locator('main header time');
  await expect(date).toHaveAttribute('datetime', '2026-03-07');
  await page.clock.fastForward(65_000);
  await expect(date).toHaveAttribute('datetime', '2026-03-08');
  await expect(
    today.getByRole('button', { name: 'Complete · Sunday reading' }),
  ).toBeVisible();
});

test('shares creation and completion across routes and keeps snapshots after edit, archive and deletion', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-03-08T10:00:00Z'));
  await page.goto('/overview');
  const today = page.getByRole('region', { name: 'Today’s Habits' });
  await expect(
    today.getByText('No habits are scheduled today.', { exact: false }),
  ).toBeVisible();
  const add = page.getByRole('button', { name: 'Add habit' });
  await add.press('Enter');
  const form = page.getByRole('dialog', { name: 'Add habit' });
  const name = form.getByLabel('Habit name');
  await expect(name).toBeFocused();
  await expect(form.getByLabel('Start date')).toHaveValue('2026-03-08');
  await name.fill('  ');
  await form.getByRole('button', { name: 'Save habit' }).click();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await name.fill('Read a chapter');
  await form.getByRole('radio', { name: 'Selected weekdays' }).check();
  await form.getByRole('button', { name: 'Save habit' }).click();
  const sunday = form.getByRole('checkbox', { name: 'Sunday' });
  await expect(sunday).toHaveAttribute('aria-invalid', 'true');
  await expect(sunday).toBeFocused();
  await sunday.press('Space');
  await form.getByRole('button', { name: 'Save habit' }).click();
  await expect(form).toBeHidden();
  await expect(add).toBeFocused();
  await expect(page).toHaveURL(/overview$/);

  const complete = today.getByRole('button', {
    name: 'Complete · Read a chapter',
  });
  await complete.press('Enter');
  const summary = page.getByRole('region', { name: 'Daily Summary' });
  await expect(summary.getByText('1 of 1', { exact: true })).toBeVisible();
  const undo = today.getByRole('button', {
    name: 'Undo completion · Read a chapter',
  });
  await expect(undo).toBeFocused();
  await expect(today.getByText('1 of 1 completed')).toBeVisible();
  await undo.press('Enter');
  await expect(complete).toBeFocused();
  await expect(summary.getByText('0 of 1', { exact: true })).toBeVisible();
  await complete.click();
  await expect(undo).toBeVisible();
  await today.getByRole('link', { name: 'View habits' }).click();
  const library = page.getByRole('tab', { name: 'All habits' });
  const daily = page.getByRole('tab', { name: 'Today', exact: true });
  await expect(daily).toHaveAttribute('aria-selected', 'true');
  await daily.press('ArrowRight');
  await expect(library).toBeFocused();
  const detail = page.locator('summary').filter({ hasText: 'Read a chapter' });
  await detail.press('Enter');
  await expect(page.locator('details[open] time').first()).toHaveAttribute(
    'datetime',
    '2026-03-08',
  );
  await detail.press('Enter');
  await page.getByRole('button', { name: 'Add habit' }).click();
  await expect(form).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(library).toHaveAttribute('aria-selected', 'true');
  const history = page.getByRole('region', { name: 'Completion history' });
  const showHistory = page
    .locator('summary')
    .filter({ hasText: 'Completion history' });
  await showHistory.click();
  await expect(history.locator('time')).toHaveAttribute(
    'datetime',
    '2026-03-08',
  );
  const actions = (name: string) =>
    page.getByRole('button', { name: 'Actions · ' + name });
  await actions('Read a chapter').press('ArrowDown');
  const edit = page.getByRole('menuitem', {
    name: 'Edit habit · Read a chapter',
  });
  await expect(edit).toBeFocused();
  await edit.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: /Archive/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(actions('Read a chapter')).toBeFocused();
  await actions('Read a chapter').click();
  await edit.click();
  const editor = page.getByRole('dialog', { name: 'Edit habit' });
  await editor.getByLabel('Habit name').fill('Study a chapter');
  await editor.getByRole('checkbox', { name: 'Sunday' }).uncheck();
  await editor.getByRole('checkbox', { name: 'Monday' }).check();
  await editor.getByRole('button', { name: 'Save habit' }).click();
  await expect(actions('Study a chapter')).toBeFocused();
  await expect(history.getByText('Read a chapter')).toHaveCount(1);
  await daily.click();
  await expect(today.getByText('Nothing scheduled today.')).toBeVisible();
  await page.reload();
  await expect(today.getByText('Nothing scheduled today.')).toBeVisible();
  await library.click();
  await actions('Study a chapter').click();
  await page.getByRole('menuitem', { name: /Edit habit/ }).click();
  await editor.getByRole('checkbox', { name: 'Sunday' }).check();
  await editor.getByRole('button', { name: 'Save habit' }).click();
  await daily.click();
  await expect(
    today.getByRole('button', { name: /Undo completion/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await library.click();
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
  await actions('Study a chapter').click();
  await page.getByRole('menuitem', { name: /Archive/ }).click();
  await expect(actions('Study a chapter')).toBeHidden();
  await page.getByRole('button', { name: /^Archived/ }).click();
  await actions('Study a chapter').click();
  await page.getByRole('menuitem', { name: /Restore/ }).click();
  await expect(actions('Study a chapter')).toBeHidden();
  await page.getByRole('button', { name: /^Active/ }).click();
  await actions('Study a chapter').click();
  await page.getByRole('menuitem', { name: /Delete/ }).click();
  const confirmation = page.getByRole('dialog', { name: 'Delete habit?' });
  await expect(
    confirmation.getByRole('button', { name: 'Cancel' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(actions('Study a chapter')).toBeFocused();
  await actions('Study a chapter').click();
  await page.getByRole('menuitem', { name: /Delete/ }).click();
  await confirmation
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await page.reload();
  await library.click();
  await showHistory.click();
  await expect(history.getByText('Read a chapter')).toBeVisible();
});

test('shows an incomplete habit immediately when an edit adds today and hides it when another edit removes today', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-03-08T10:00:00Z'));
  await page.goto('/habits');
  await page.getByRole('button', { name: 'Add habit' }).click();
  const form = page.getByRole('dialog', { name: 'Add habit' });
  await form.getByLabel('Habit name').fill('Take a walk');
  await form.getByRole('radio', { name: 'Selected weekdays' }).check();
  await form.getByRole('checkbox', { name: 'Monday' }).check();
  await form.getByRole('button', { name: 'Save habit' }).click();
  await expect(form).toBeHidden();
  const today = page.getByRole('region', { name: 'Today’s Habits' });
  await expect(today.getByText('Take a walk')).toHaveCount(0);
  const editButton = page.getByRole('menuitem', {
    name: 'Edit habit · Take a walk',
  });
  const editor = page.getByRole('dialog', { name: 'Edit habit' });
  await page.getByRole('tab', { name: 'All habits' }).click();
  await page.getByRole('button', { name: 'Actions · Take a walk' }).click();
  await editButton.click();
  await editor.getByRole('checkbox', { name: 'Sunday' }).check();
  await editor.getByRole('button', { name: 'Save habit' }).click();
  await page.getByRole('tab', { name: 'Today', exact: true }).click();
  await expect(today.getByText('0 of 1 completed')).toBeVisible();
  await page.getByRole('link', { name: 'Overview' }).click();
  const overviewSummary = page.getByRole('region', { name: 'Daily Summary' });
  await expect(
    overviewSummary.getByText('0 of 1', { exact: true }),
  ).toBeVisible();
  await expect(
    today.getByRole('button', { name: 'Complete · Take a walk' }),
  ).toBeVisible();
  await today.getByRole('link', { name: 'View habits' }).click();
  await page.getByRole('tab', { name: 'All habits' }).click();
  await page.getByRole('button', { name: 'Actions · Take a walk' }).click();
  await editButton.click();
  await editor.getByRole('checkbox', { name: 'Sunday' }).uncheck();
  await editor.getByRole('button', { name: 'Save habit' }).click();
  await expect(today.getByText('Take a walk')).toHaveCount(0);
  await page
    .locator('summary')
    .filter({ hasText: 'Completion history' })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Completion history' })
      .getByText('Completed habits will appear here.'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Overview' }).click();
  await expect(
    overviewSummary.getByText('0 of 0', { exact: true }),
  ).toHaveCount(2);
});

test('keeps the form after a quota failure while inserting the first schedule', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const add = IDBObjectStore.prototype.add;
    let failed = false;
    IDBObjectStore.prototype.add = function (record, key) {
      if (this.name === 'schedules' && !failed) {
        failed = true;
        throw new DOMException('Storage full', 'QuotaExceededError');
      }
      return add.call(this, record, key);
    };
  });
  await page.goto('/habits');
  await page.getByRole('button', { name: 'Add habit' }).click();
  const form = page.getByRole('dialog', { name: 'Add habit' });
  await form.getByLabel('Habit name').fill('Write a journal');
  await form.getByLabel('Description').fill('Keep the draft');
  await form.getByRole('button', { name: 'Save habit' }).click();
  await expect(form.getByRole('alert')).toContainText(
    'Your entries are still here',
  );
  await expect(form.getByLabel('Description')).toHaveValue('Keep the draft');
  await form.getByRole('button', { name: 'Save habit' }).click();
  await expect(form).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Complete · Write a journal' }),
  ).toHaveCount(1);
  await expect(page.getByText(/storage is full/i)).toHaveCount(0);
});

test('uses the Arabic RTL weekday controls and keeps every scheduled habit reachable', async ({
  page,
  isMobile,
}) => {
  if (!isMobile) await page.setViewportSize({ width: 800, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem(
      'doop.preferences',
      JSON.stringify({ appearance: 'dark', theme: 'emerald', language: 'ar' }),
    );
  });
  await page.clock.setFixedTime(new Date('2026-03-08T10:00:00Z'));
  await page.goto('/overview');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('region', { name: 'ملخّص اليوم' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'هدف التركيز' }).getByRole('progressbar'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'ابدأ التركيز' })).toBeVisible();
  const form = page.getByRole('dialog', { name: 'إضافة عادة' });
  for (let index = 1; index <= 7; index++) {
    await page.getByRole('button', { name: 'إضافة عادة' }).click();
    if (index === 1) {
      await expect(form.getByLabel('اسم العادة')).toBeFocused();
      if (isMobile) {
        const box = await form.boundingBox();
        expect(box && Math.round(box.y + box.height)).toBe(
          page.viewportSize()?.height,
        );
      }
      await form.getByRole('radio', { name: 'أيام محددة' }).check();
      await expect(form.getByRole('checkbox').first()).toHaveAccessibleName(
        'السبت',
      );
      await form.getByRole('checkbox', { name: 'الأحد' }).check();
    }
    await form.getByLabel('اسم العادة').fill('عادة ' + index);
    await form.getByRole('button', { name: 'حفظ العادة' }).click();
    await expect(form).toBeHidden();
  }
  const today = page.getByRole('region', { name: 'عادات اليوم' });
  const list = today.getByRole('list');
  await expect(list.getByRole('listitem')).toHaveCount(7);
  expect(
    await list.evaluate((node) => node.scrollHeight > node.clientHeight),
  ).toBe(true);
  await list.getByRole('button', { name: 'إكمال · عادة 7' }).click();
  await expect(
    list.getByRole('button', { name: 'التراجع عن الإكمال · عادة 7' }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
