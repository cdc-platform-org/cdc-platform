import { test, expect } from '@playwright/test';
import { AUTH_STATE_PATH } from './global-setup';

// Fixed tokens from Backend/prisma/seedE2E.ts — see that file's own comment
// on why these are deterministic instead of created ad hoc per test run.
const FREE_INVITE_TOKEN = 'qa-e2e-free-invite-token';
const PAID_INVITE_TOKEN = 'qa-e2e-paid-invite-token';

test.describe('Live Training QR/link invite redemption — signed-in learner', () => {
  test.use({ storageState: AUTH_STATE_PATH });

  test('a signed-in learner redeems a free-training invite and lands enrolled', async ({ page }) => {
    await page.goto(`/en/live-trainings/invite/${FREE_INVITE_TOKEN}`);
    await expect(page.getByRole('status').filter({ hasText: /enrolled/i })).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/live-trainings\/[0-9a-f-]+$/, { timeout: 10000 });
  });
});

test.describe('Live Training QR/link invite redemption — fresh guest', () => {
  // Deliberately NO shared storageState here: a brand-new, never-enrolled
  // account is required for this test — the seeded QA learner above is
  // already enrolled in the paid training (seedE2E.ts), which would hit the
  // redemption service's idempotent "already enrolled" success path instead
  // of exercising the actual payment guard this test exists to prove.
  test('a paid training invite is rejected — payment can never be bypassed by a QR/link', async ({ page }) => {
    await page.goto('/en/auth/register');
    const uniqueEmail = `qa-e2e-invite-${Date.now()}@cdc.test`;
    await page.locator('#name').fill('QA Invite Test');
    await page.locator('#email').fill(uniqueEmail);
    await page.locator('#password').fill('RegisterTest123!');
    await page.locator('#phone').fill('+995555000222');
    await page.locator('form input[type="checkbox"]').check();
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/courses/, { timeout: 15000 });

    await page.goto(`/en/live-trainings/invite/${PAID_INVITE_TOKEN}`);
    await expect(page.getByRole('alert').filter({ hasText: /payment/i })).toBeVisible({ timeout: 10000 });
    // Never redirected to the training as if enrolled.
    await expect(page).not.toHaveURL(/\/live-trainings\/[0-9a-f-]+$/, { timeout: 2000 });
  });
});
