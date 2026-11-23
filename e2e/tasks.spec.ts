import { expect, test } from '@playwright/test';

test('creates from Overview, completes and undoes, and manages the same task from Tasks', async ({
  page,
}) => {
  await page.goto('/');
  const add = page.getByRole('button', { name: 'Add task' });
  await add.press('Enter');
  const create = page.getByRole('dialog', { name: 'Add task' });
  const title = create.getByLabel('Task title');
  await expect(title).toBeFocused();
  await expect(create.getByLabel('Priority')).toHaveValue('medium');
  await title.fill('   ');
  await create.getByRole('button', { name: 'Save task' }).click();
  await expect(title).toHaveAttribute('aria-invalid', 'true');
  await expect(title).toBeFocused();
  await title.fill('Read project notes');
  await create.getByLabel('Due date').fill('2000-01-02');
  await create.getByLabel('Expected focus sessions').fill('3');
  await create.getByRole('button', { name: 'Save task' }).click();
  await expect(create).toBeHidden();
  await expect(add).toBeFocused();
  await expect(page).toHaveURL(/\/overview$/);
  const preview = page.getByRole('region', { name: 'Today’s tasks' });
  await expect(
    preview.getByRole('heading', { name: 'Read project notes' }),
  ).toBeVisible();
  await expect(
    preview.getByRole('button', { name: /^(Edit|Delete)/ }),
  ).toHaveCount(0);

  await preview.getByRole('button', { name: /Mark complete/ }).click();
  await expect(
    preview.getByRole('heading', { name: 'Read project notes' }),
  ).toBeHidden();
  const undo = preview.getByRole('button', { name: 'Undo' });
  await expect(undo).toBeFocused();
  await undo.press('Enter');
  await expect(
    preview.getByRole('heading', { name: 'Read project notes' }),
  ).toBeVisible();
  const summary = page.getByRole('region', { name: 'Daily Summary' });
  await expect(
    summary.getByText('0 of 0', { exact: true }).first(),
  ).toBeVisible();

  await page.getByRole('link', { name: 'View all tasks' }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByText('0 of 3 focus sessions')).toBeVisible();
  const editTrigger = page.getByRole('button', {
    name: 'Edit · Read project notes',
  });
  await editTrigger.click();
  const edit = page.getByRole('dialog', { name: 'Edit task' });
  await expect(edit.getByLabel('Due date')).toHaveValue('2000-01-02');
  await edit.getByLabel('Priority').selectOption('high');
  await edit.getByLabel('Task title').fill('Read project brief');
  await edit.getByRole('button', { name: 'Save task' }).click();
  await expect(edit).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Edit · Read project brief' }),
  ).toBeFocused();

  await page.getByLabel('Filter').selectOption('overdue');
  await page.getByLabel('Sort by').selectOption('priority');
  await page.reload();
  await expect(page.getByLabel('Filter')).toHaveValue('overdue');
  await expect(page.getByLabel('Sort by')).toHaveValue('priority');
  await expect(page.locator('time')).toHaveAttribute('datetime', '2000-01-02');
  await page
    .getByRole('button', { name: 'Mark complete · Read project brief' })
    .click();
  await expect(page.getByText('No tasks match this filter.')).toBeVisible();
  await page.getByLabel('Filter').selectOption('completed');
  await page
    .getByRole('button', { name: 'Reopen · Read project brief' })
    .click();
  await page.getByLabel('Filter').selectOption('all');

  const remove = page.getByRole('button', {
    name: 'Delete · Read project brief',
  });
  await remove.click();
  const confirmation = page.getByRole('dialog', { name: 'Delete task' });
  await expect(
    confirmation.getByRole('button', { name: 'Cancel' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirmation).toBeHidden();
  await expect(remove).toBeFocused();
  await remove.click();
  await confirmation.getByRole('button', { name: 'Delete task' }).click();
  await expect(page.getByText('Task deleted.')).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('Add a task to start planning your work.'),
  ).toBeVisible();

  const tombstone = await page.evaluate(
    () =>
      new Promise<boolean>((resolve, reject) => {
        const request = indexedDB.open('doop-workspace');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const result = db.transaction('tasks').objectStore('tasks').getAll();
          result.onsuccess = () => {
            resolve(
              result.result.length === 1 && result.result[0].deletedAt !== null,
            );
            db.close();
          };
          result.onerror = () => {
            db.close();
            reject(result.error);
          };
        };
      }),
  );
  expect(tombstone).toBe(true);
});

test('keeps a draft after a failed write and saves it on retry', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const add = IDBObjectStore.prototype.add;
    let failed = false;
    IDBObjectStore.prototype.add = function (value, key) {
      if (this.name === 'tasks' && !failed) {
        failed = true;
        throw new DOMException('Storage full', 'QuotaExceededError');
      }
      return add.call(this, value, key);
    };
  });
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Add task' }).click();
  const form = page.getByRole('dialog', { name: 'Add task' });
  await form.getByLabel('Task title').fill('Keep the draft');
  await form.getByRole('button', { name: 'Save task' }).click();
  await expect(form.getByRole('alert')).toContainText(
    'Your changes are still here',
  );
  await expect(form.getByLabel('Task title')).toHaveValue('Keep the draft');
  await form.getByRole('button', { name: 'Save task' }).click();
  await expect(form).toBeHidden();
  await expect(
    page.getByRole('heading', { name: 'Keep the draft' }),
  ).toBeVisible();
});

test('uses the Arabic RTL form and displays the same saved calendar day', async ({
  page,
  isMobile,
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
  });
  await page.goto('/overview');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', { name: 'إضافة مهمة' }).click();
  const dialog = page.getByRole('dialog', { name: 'إضافة مهمة' });
  await expect(dialog.getByLabel('عنوان المهمة')).toBeFocused();
  if (isMobile) {
    const box = await dialog.boundingBox();
    expect(box && Math.round(box.y + box.height)).toBe(
      page.viewportSize()?.height,
    );
  }
  await dialog.getByLabel('عنوان المهمة').fill('مراجعة الدرس');
  await dialog.getByLabel('تاريخ الاستحقاق').fill('2000-01-02');
  await dialog.getByLabel('جلسات التركيز المتوقعة').fill('٢');
  await dialog.getByRole('button', { name: 'حفظ المهمة' }).click();
  await expect(page.getByText('مراجعة الدرس', { exact: true })).toBeVisible();
  const today = page.getByRole('region', { name: 'مهام اليوم' });
  await expect(today.locator('time')).toHaveAttribute('datetime', '2000-01-02');
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
