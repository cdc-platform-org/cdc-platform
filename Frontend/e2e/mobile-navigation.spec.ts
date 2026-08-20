import { test, expect } from '@playwright/test';
import { loginViaUI } from './fixtures/auth';
import { AUTH_STATE_PATH } from './global-setup';

// Runs under the "mobile" Playwright project (Pixel 7 emulation — see
// playwright.config.ts) — covers two real bugs fixed in this codebase:
// 1. SiteHeader.tsx used to hide the authenticated user's avatar/profile
//    menu behind the hamburger drawer on mobile (Bell was already visible;
//    the avatar wasn't) — this suite pins that regression.
// 2. Back/forward navigation restored from the browser's bfcache used to
//    show frozen auth/notification state — useAuth.ts and
//    NotificationBell.tsx now revalidate on a `pageshow` event with
//    `persisted: true`. Playwright's `page.goBack()` triggers a real
//    browser back navigation (bfcache-eligible for this app, since it sets
//    no unload handlers), so this exercises the actual browser mechanism,
//    not a simulation of it.
test.describe('Mobile Navigation — guest', () => {
  test('guest sees a login button directly in the header, not only inside the hamburger drawer', async ({ page }) => {
    await page.goto('/marketplace');

    await expect(page.getByRole('button', { name: /log in|შესვლა/i }).first()).toBeVisible();
  });
});

test.describe('Mobile Navigation — authenticated', () => {
  // Reuses the session global-setup.ts logged in once (see that file's
  // comment on the login-rate-limit budget) rather than submitting the
  // real login form again for each of these two.
  test.use({ storageState: AUTH_STATE_PATH });

  test('authenticated user sees the avatar and notification bell directly in the header', async ({ page }) => {
    await page.goto('/marketplace');

    // Both must render without opening the hamburger drawer first — this is
    // the exact regression this test guards against.
    await expect(page.locator('button[aria-label="Notifications"]')).toBeVisible();
    await expect(page.locator('nav button:has(> div.rounded-full)').first()).toBeVisible();
  });

  test('hamburger drawer opens and closes, and its own auth-state row still works', async ({ page }) => {
    await page.goto('/marketplace');

    const burger = page.locator('button[aria-label="Toggle menu"]');
    await burger.click();
    await expect(page.getByRole('link', { name: /dashboard|დაშბორდი/i }).first()).toBeVisible();

    await burger.click();
    await expect(page.getByText(/მენტორები|Mentors/i).first()).toBeHidden();
  });
});

test.describe('Mobile Navigation — back button', () => {
  // Deliberately submits the real login form (unlike the describe block
  // above) — the whole point of this test is the browser's back-navigation
  // behavior immediately after a real login transition, which a reused
  // storageState wouldn't exercise.
  test('browser back navigation after login still shows authenticated header state', async ({ page }) => {
    await loginViaUI(page); // ends on the real post-login landing page
    await page.goto('/tutorials');

    await page.goBack(); // bfcache-restores the post-login landing page

    // Regardless of which page bfcache restores, the header must reflect
    // the real (still logged-in) session — not whatever it looked like at
    // the moment the browser cached that page.
    await expect(page.locator('button[aria-label="Notifications"]')).toBeVisible({ timeout: 10000 });
  });
});
