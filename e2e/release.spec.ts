import { expect, test } from '@playwright/test';

test('reloads the intended destination after a lazy page fails to load', async ({
  page,
  context,
}) => {
  await page.goto('/overview');
  await expect(
    page.getByRole('heading', { name: 'Overview', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'العربية' }).check();
  await page.keyboard.press('Escape');

  // Force a real module request failure after the shell and its first route load.
  await context.setOffline(true);
  await page.getByRole('link', { name: 'التقدم', exact: true }).press('Enter');
  const alert = page
    .getByRole('alert')
    .filter({ hasText: 'تعذّر تحميل هذه الصفحة' });
  await expect(alert).toBeVisible();
  await expect(alert.locator('..')).toBeFocused();
  await expect(
    page.getByRole('heading', { name: 'نظرة عامة', exact: true }),
  ).toBeVisible();

  await context.setOffline(false);
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'إعادة تحميل الصفحة' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/progress$/);
  await expect(
    page.getByRole('heading', { name: 'التقدم', exact: true }),
  ).toBeVisible();
  await expect(alert).toHaveCount(0);
});

test('shows actionable guidance when Angular bootstrap fails', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const query = document.querySelector.bind(document);
    document.querySelector = (selector: string) =>
      selector === 'app-root' ? null : query(selector);
  });
  await page.goto('/tasks');
  const fallback = page.getByRole('main');
  await expect(fallback).toBeFocused();
  await expect(fallback.getByRole('alert')).toContainText(
    'Doop couldn’t start',
  );
  await expect(
    fallback.getByRole('link', { name: /Reload page/ }),
  ).toBeVisible();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('offers bilingual startup guidance without an empty document', async ({
    page,
  }) => {
    await page.goto('/focus');
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Doop' })).toBeVisible();
    await expect(main.getByText(/Enable JavaScript/)).toBeVisible();
    await expect(main.locator('[lang=ar]')).toBeVisible();
  });
});

test('shows localized privacy and restore guidance with keyboard focus return', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tasks');
  const settings = page.getByRole('button', { name: 'Settings' });
  await settings.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(
    dialog.getByText(/does not send workspace data to a server/),
  ).toBeVisible();
  await expect(
    dialog.getByText(/Browser restore accepts JSON files up to 64 MiB/),
  ).toBeVisible();
  await dialog.getByRole('radio', { name: 'العربية' }).check();
  const arabic = page.getByRole('dialog', { name: 'الإعدادات' });
  await expect(arabic.getByText(/لا يرسل بياناتها إلى خادم/)).toBeVisible();
  await expect(arabic.getByText(/٦٤ ميبيبايت/)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'الإعدادات' })).toBeFocused();
});

test('production routes directly load and fit desktop, tablet and narrow RTL viewports', async ({
  page,
  isMobile,
  baseURL,
}) => {
  const unexpectedRequests: string[] = [];
  const origin = new URL(baseURL ?? 'http://127.0.0.1:4201').origin;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== origin) {
      unexpectedRequests.push(url.origin);
    }
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/overview$/);
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('radio', { name: 'Dark', exact: true }).check();
  await settings.getByRole('radio', { name: 'العربية' }).check();
  await page.keyboard.press('Escape');

  const destinations = {
    overview: 'نظرة عامة',
    tasks: 'المهام',
    habits: 'العادات',
    focus: 'التركيز',
    progress: 'التقدم',
  };
  const widths = isMobile ? [320, 390] : [768, 1280];
  for (const [route, title] of Object.entries(destinations)) {
    const response = await page.goto('/' + route);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(title + ' · Doop');
    await expect(
      page.getByRole('heading', { name: title, exact: true, level: 1 }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          ),
        )
        .toBeLessThanOrEqual(0);
    }
  }
  expect(unexpectedRequests).toEqual([]);
});

test('keeps text, focus and control borders distinguishable in every theme', async ({
  page,
}) => {
  await page.goto('/tasks');
  await expect(
    page.getByRole('heading', { name: 'Tasks', exact: true }),
  ).toBeVisible();
  const measurements = await page.evaluate(() => {
    const root = document.documentElement;
    const originalTheme = root.dataset['theme'];
    const originalAppearance = root.dataset['appearance'];
    const probe = document.createElement('span');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Cannot measure colors');
    document.body.append(probe);

    const luminance = (token: string) => {
      probe.style.color = `var(--${token})`;
      context.fillStyle = getComputedStyle(probe).color;
      context.fillRect(0, 0, 1, 1);
      const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
      const weights = [0.2126, 0.7152, 0.0722];
      return channels.reduce((total, byte, i) => {
        const channel = byte / 255;
        const linear =
          channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
        return total + (weights[i] ?? 0) * linear;
      }, 0);
    };

    const results = [];
    const pairs: [string, string, number][] = [
      ['text', 'canvas', 4.5],
      ['text', 'surface', 4.5],
      ['muted', 'canvas', 4.5],
      ['muted', 'surface', 4.5],
      ['danger', 'surface', 4.5],
      ['accent', 'accent-wash', 4.5],
      ['accent', 'canvas', 3],
      ['control-border', 'surface', 3],
      ['control-border', 'canvas', 3],
    ];
    for (const appearance of ['light', 'dark']) {
      root.setAttribute('data-appearance', appearance);
      for (const theme of [
        'emerald',
        'slate',
        'indigo',
        'teal',
        'rose',
        'amber',
      ]) {
        root.setAttribute('data-theme', theme);
        for (const [foreground, background, minimum] of pairs) {
          const a = luminance(foreground);
          const b = luminance(background);
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          results.push({
            label: `${theme} ${appearance} ${foreground}/${background}`,
            minimum,
            ratio,
          });
        }
      }
    }
    root.setAttribute('data-theme', originalTheme ?? 'emerald');
    root.setAttribute('data-appearance', originalAppearance ?? 'system');
    probe.remove();
    return results;
  });
  for (const { label, ratio, minimum } of measurements) {
    expect.soft(ratio, label).toBeGreaterThanOrEqual(minimum);
  }

  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await expect(skip).toHaveCSS('outline-style', 'solid');
});
