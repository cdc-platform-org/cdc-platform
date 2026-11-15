import { defineConfig } from '@playwright/test';

// Provider calls are mocked; these regressions need no running API or login.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'natural-narration.spec.ts',
  workers: 1,
  reporter: 'list',
});
