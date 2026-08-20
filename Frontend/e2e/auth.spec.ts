import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_EMAIL, TEST_PASSWORD } from './fixtures/auth';

test.describe('User Authentication', () => {
  test('registers a new self-serve Student account and lands authenticated', async ({ page }) => {
    // Self-serve Student/Client signups are auto-approved (see backend's
    // routes/auth.ts) — a fresh registration should reach /courses already
    // logged in, no admin-approval interstitial.
    const uniqueEmail = `qa-e2e-register-${Date.now()}@cdc.test`;

    await page.goto('/auth/register');
    await page.getByText('Learning & Career', { exact: false }).or(page.locator('button', { hasText: /სწავლა|Learning/ })).first().click();
    await page.locator('button', { hasText: /სტუდენტი|Student/ }).first().click();

    await page.locator('#name').fill('QA Registration Test');
    await page.locator('#email').fill(uniqueEmail);
    await page.locator('#password').fill('RegisterTest123!');
    await page.locator('form input[type="checkbox"]').check();
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/courses/, { timeout: 15000 });
    // Authenticated header state — the guest-only login pill must be gone.
    await expect(page.locator('button[aria-label="Notifications"]')).toBeVisible();
  });

  test('logs in with valid seeded credentials', async ({ page }) => {
    await loginViaUI(page);
    await expect(page.locator('button[aria-label="Notifications"]')).toBeVisible();
  });

  test('rejects invalid credentials with an error and stays on the login page', async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('#email').fill(TEST_EMAIL);
    await page.locator('#password').fill('definitely-the-wrong-password');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(/ვერ მოხერხდა|failed|invalid/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('logs out and returns to a guest header state', async ({ page }) => {
    await loginViaUI(page);
    await page.goto('/dashboard');

    // Desktop UserMenu dropdown → Log Out (see src/components/layout/UserMenu.tsx).
    await page.locator('nav button:has(> div.rounded-full)').first().click();
    await page.getByRole('menuitem', { name: /log out|გამოსვლა/i }).or(page.locator('button', { hasText: /log out|გამოსვლა/i })).first().click();

    await expect(page).toHaveURL('/');
    await expect(page.locator('button[aria-label="Notifications"]')).toHaveCount(0);
  });
});
