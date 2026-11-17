import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'production-audit.spec.ts', workers: 1,
  timeout: 45000, reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3117' },
});
