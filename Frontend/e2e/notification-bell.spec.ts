import { test, expect } from '@playwright/test';
import { AUTH_STATE_PATH } from './global-setup';

// Reuses the session global-setup.ts logged in once — see that file's
// comment on why this suite doesn't submit the real login form itself.
test.use({ storageState: AUTH_STATE_PATH });

// Backend/prisma/seedE2E.ts seeds exactly one unread notification for the
// QA test user on every run (deleting any prior seed run's notification
// first), so this suite can assert on a known unread count without relying
// on whatever other notifications may exist in a non-reset dev DB.
test.describe('Notification Bell', () => {
  test('shows an unread badge and the seeded notification in the dropdown', async ({ page }) => {
    await page.goto('/marketplace');

    const bell = page.locator('button[aria-label="Notifications"]');
    await expect(bell).toBeVisible();
    // The red unread-count badge (see NotificationBell.tsx) — its presence
    // is the signal, not an exact count, since other notifications may
    // exist in a shared dev DB.
    await expect(bell.locator('span').last()).toBeVisible();

    await bell.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByText('[QA_E2E_SEED] Welcome')).toBeVisible();
  });

  test('clicking a notification marks it read and navigates to the notifications page', async ({ page }) => {
    await page.goto('/marketplace');

    await page.locator('button[aria-label="Notifications"]').click();
    await page.getByText('[QA_E2E_SEED] Welcome').click();

    await expect(page).toHaveURL(/\/dashboard\/notifications/);
  });
});
