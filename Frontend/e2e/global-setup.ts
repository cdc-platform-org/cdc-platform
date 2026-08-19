import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import { TEST_EMAIL, TEST_PASSWORD } from './fixtures/auth';

// Logs in ONCE through the real form and saves the resulting session
// (localStorage token — see useAuth.ts's TOKEN_KEY/USER_KEY — Playwright's
// storageState captures localStorage per-origin since 1.31) for every other
// spec file to reuse via `test.use({ storageState: AUTH_STATE_PATH })`.
// This is not just a speed optimization: Backend's POST /api/auth/login is
// rate-limited to 10 attempts per 15 minutes per IP (see routes/auth.ts's
// loginRateLimit) — a full suite that logs in fresh for every test (this
// one included ~13 logins in an earlier version) blows through that budget
// partway through the run, and every test after that fails with "stuck on
// /auth/login" instead of whatever it was actually meant to check. Only
// e2e/auth.spec.ts still submits the real login form repeatedly, because
// exercising that form for real is the entire point of that file.
export const AUTH_STATE_PATH = path.join(__dirname, '.auth', 'user.json');

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL as string;
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });

  await page.goto('/auth/login');
  await page.locator('#email').fill(TEST_EMAIL);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'), { timeout: 15000 });

  const agreeButton = page.getByRole('button', { name: /I Agree & Continue|ვეთანხმები და ვაგრძელებ/i });
  if (await agreeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await agreeButton.click();
    await agreeButton.waitFor({ state: 'hidden', timeout: 10000 });
  }

  await page.context().storageState({ path: AUTH_STATE_PATH });
  await browser.close();
}
