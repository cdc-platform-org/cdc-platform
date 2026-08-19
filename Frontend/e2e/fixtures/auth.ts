import { Page, expect } from '@playwright/test';

// Must match Backend/prisma/seedE2E.ts's defaults exactly — both read the
// same QA_TEST_EMAIL/QA_TEST_PASSWORD env vars, so a CI run that overrides
// them for the seed step and forgets to override them here (or vice versa)
// fails loudly (login rejected) rather than silently testing stale creds.
export const TEST_EMAIL = process.env.QA_TEST_EMAIL || 'qa-e2e@cdc.test';
export const TEST_PASSWORD = process.env.QA_TEST_PASSWORD || 'QaE2ePass123!';

// Real login through the actual form — deliberately not a localStorage/API
// shortcut, since "can a user actually authenticate through the UI" is
// exactly what the User Authentication flow is meant to cover.
export async function loginViaUI(page: Page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await page.goto('/auth/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  // Login redirects away from /auth/login on success (see pages/auth/login.tsx) —
  // waiting for that instead of a fixed timeout keeps this robust to actual
  // request latency without hardcoding the destination route.
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 15000 });

  // TermsConsentModal (mounted unconditionally in _app.tsx) blocks every
  // click on the page behind it until accepted, and — unlike a real
  // returning user — a fresh Playwright browser context has no
  // `cdc_terms_accepted` entry in localStorage, so it appears on every
  // single login here. Dismiss it once per login so tests that need to
  // click header UI (bell, avatar, hamburger) aren't blocked by an overlay
  // that has nothing to do with what they're testing.
  const agreeButton = page.getByRole('button', { name: /I Agree & Continue|ვეთანხმები და ვაგრძელებ/i });
  if (await agreeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await agreeButton.click();
    await expect(agreeButton).toBeHidden({ timeout: 10000 });
  }
}
