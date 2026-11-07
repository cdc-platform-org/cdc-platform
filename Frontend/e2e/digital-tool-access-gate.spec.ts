import { test, expect } from '@playwright/test';
import { AUTH_STATE_PATH } from './global-setup';

test.use({ storageState: AUTH_STATE_PATH });

test('an unentitled learner sees an access-required state instead of the Media Studio tool', async ({ page }) => {
  // The seeded QA learner (seedE2E.ts) has no ProductPurchase and no
  // AccessGrant for 'media-studio' — DigitalToolAccessGate.tsx must show
  // the denied state rather than rendering the real tool UI, which would
  // otherwise 403 on its very first action against
  // mediaStudio.ts's requireMediaStudioAccess.
  await page.goto('/en/dashboard/tools/media-studio');
  await expect(page.getByRole('alert').filter({ hasText: /access/i })).toBeVisible({ timeout: 10000 });
  // The page keeps the tool's own header (h1 = tool name, via ToolShell)
  // so the locked state has site navigation; the access message is the h2.
  await expect(page.getByRole('heading', { level: 2 }).filter({ hasText: /access/i })).toBeVisible();
});
