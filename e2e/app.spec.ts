import { expect, test } from '@playwright/test';

test('loads the baseline with compiled styles and no horizontal overflow', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto('/');
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle('Doop');

  const main = page.getByRole('main');
  await expect(
    main.getByRole('heading', { name: 'Doop', level: 1 }),
  ).toBeVisible();
  await expect(
    main.getByText('This build verifies the Doop web app setup.'),
  ).toBeVisible();
  await expect(main).toHaveCSS('padding-left', '24px');
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(pageErrors).toEqual([]);
});
