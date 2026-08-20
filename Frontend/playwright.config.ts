import { defineConfig, devices } from '@playwright/test';

// Points at whatever the CI job (or a local dev run) already has serving —
// .github/workflows/qa-nightly.yml starts Backend+Frontend itself and sets
// this; nothing in this config starts a server, since the suite needs both
// the Express API and the Next app up together with a seeded DB in between
// (see Backend/prisma/seedE2E.ts), which Playwright's own single-process
// `webServer` option isn't a good fit for.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  // Logs in once through the real form and saves the session for every
  // other spec to reuse (see global-setup.ts) — keeps the whole suite's
  // real login-form submissions well under Backend's 10-per-15-min rate limit.
  globalSetup: require.resolve('./e2e/global-setup'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Nightly run only needs one worker's worth of throughput and parallel
  // workers would otherwise race on the same seeded fixture rows (the one
  // QA test user, the one seeded course enrollment, etc.) — see
  // Backend/prisma/seedE2E.ts's fixed IDs.
  workers: 1,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'playwright-report/results.json' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /mobile-navigation\.spec\.ts/,
    },
    {
      // Covers the mobile-header/hamburger-drawer bug class specifically
      // (bell/avatar visibility, back-button/bfcache state) — see
      // e2e/mobile-navigation.spec.ts. Real device emulation (viewport +
      // touch + UA), not just a resized desktop browser.
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /mobile-navigation\.spec\.ts/,
    },
  ],
});
