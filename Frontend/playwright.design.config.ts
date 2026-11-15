import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 60000, reporter: 'list',
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3113', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', testMatch: ['homepage-editorial.spec.ts', 'learning-ui.spec.ts', 'about-hub.spec.ts'], use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'tablet', testMatch: 'homepage-editorial.spec.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 875, height: 900 } } },
    { name: 'mobile', testMatch: ['homepage-editorial.spec.ts', 'about-hub.spec.ts'], use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
