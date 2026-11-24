import { defineConfig } from '@playwright/test';

const port = 4201;
const deployedURL = process.env['DOOP_TEST_URL'];
const baseURL = deployedURL || `http://127.0.0.1:${port}`;
const releaseBrowsers = process.env['DOOP_RELEASE_BROWSERS'] === '1';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env['CI']),
  workers: process.env['CI'] ? 1 : undefined,
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { browserName: 'chromium' } },
    {
      name: 'chromium-mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 320, height: 640 },
        isMobile: true,
        hasTouch: true,
      },
    },
    ...(releaseBrowsers
      ? [
          { name: 'firefox-desktop', use: { browserName: 'firefox' as const } },
          {
            name: 'webkit-mobile',
            use: {
              browserName: 'webkit' as const,
              viewport: { width: 390, height: 844 },
              deviceScaleFactor: 3,
              isMobile: true,
              hasTouch: true,
            },
          },
        ]
      : []),
  ],
  webServer: deployedURL
    ? undefined
    : {
        command: `npm run dev -- --configuration production --host 127.0.0.1 --port ${port}`,
        url: baseURL,
        timeout: 120_000,
      },
});
