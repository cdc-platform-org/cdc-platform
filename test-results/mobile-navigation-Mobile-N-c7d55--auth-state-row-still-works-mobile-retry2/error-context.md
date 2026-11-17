# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mobile-navigation.spec.ts >> Mobile Navigation — authenticated >> hamburger drawer opens and closes, and its own auth-state row still works
- Location: e2e/mobile-navigation.spec.ts:40:7

# Error details

```
Error: expect(locator).toBeHidden() failed

Locator:  getByText(/მენტორები|Mentors/i).first()
Expected: hidden
Received: visible
Timeout:  5000ms

Call log:
  - Expect "toBeHidden" with timeout 5000ms
  - waiting for getByText(/მენტორები|Mentors/i).first()
    14 × locator resolved to <a href="/mentors" class="inline-block py-1.5 sm:py-0 text-cdc-muted hover:text-cdc-primary-ink transition-colors duration-150 no-underline">მენტორები</a>
       - unexpected value "visible"

```

```yaml
- link "მენტორები":
  - /url: /mentors
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { loginViaUI } from './fixtures/auth';
  3  | import { AUTH_STATE_PATH } from './global-setup';
  4  | 
  5  | // Runs under the "mobile" Playwright project (Pixel 7 emulation — see
  6  | // playwright.config.ts) — covers two real bugs fixed in this codebase:
  7  | // 1. SiteHeader.tsx used to hide the authenticated user's avatar/profile
  8  | //    menu behind the hamburger drawer on mobile (Bell was already visible;
  9  | //    the avatar wasn't) — this suite pins that regression.
  10 | // 2. Back/forward navigation restored from the browser's bfcache used to
  11 | //    show frozen auth/notification state — useAuth.ts and
  12 | //    NotificationBell.tsx now revalidate on a `pageshow` event with
  13 | //    `persisted: true`. Playwright's `page.goBack()` triggers a real
  14 | //    browser back navigation (bfcache-eligible for this app, since it sets
  15 | //    no unload handlers), so this exercises the actual browser mechanism,
  16 | //    not a simulation of it.
  17 | test.describe('Mobile Navigation — guest', () => {
  18 |   test('guest sees a login button directly in the header, not only inside the hamburger drawer', async ({ page }) => {
  19 |     await page.goto('/marketplace');
  20 | 
  21 |     await expect(page.getByRole('button', { name: /log in|შესვლა/i }).first()).toBeVisible();
  22 |   });
  23 | });
  24 | 
  25 | test.describe('Mobile Navigation — authenticated', () => {
  26 |   // Reuses the session global-setup.ts logged in once (see that file's
  27 |   // comment on the login-rate-limit budget) rather than submitting the
  28 |   // real login form again for each of these two.
  29 |   test.use({ storageState: AUTH_STATE_PATH });
  30 | 
  31 |   test('authenticated user sees the avatar and notification bell directly in the header', async ({ page }) => {
  32 |     await page.goto('/marketplace');
  33 | 
  34 |     // Both must render without opening the hamburger drawer first — this is
  35 |     // the exact regression this test guards against.
  36 |     await expect(page.locator('button[aria-label="Notifications"]')).toBeVisible();
  37 |     await expect(page.locator('nav button:has(> div.rounded-full)').first()).toBeVisible();
  38 |   });
  39 | 
  40 |   test('hamburger drawer opens and closes, and its own auth-state row still works', async ({ page }) => {
  41 |     await page.goto('/marketplace');
  42 | 
  43 |     const burger = page.locator('button[aria-label="Toggle menu"]');
  44 |     await burger.click();
  45 |     await expect(page.getByRole('link', { name: /dashboard|დაშბორდი/i }).first()).toBeVisible();
  46 | 
  47 |     await burger.click();
> 48 |     await expect(page.getByText(/მენტორები|Mentors/i).first()).toBeHidden();
     |                                                                ^ Error: expect(locator).toBeHidden() failed
  49 |   });
  50 | });
  51 | 
  52 | test.describe('Mobile Navigation — back button', () => {
  53 |   // Deliberately submits the real login form (unlike the describe block
  54 |   // above) — the whole point of this test is the browser's back-navigation
  55 |   // behavior immediately after a real login transition, which a reused
  56 |   // storageState wouldn't exercise.
  57 |   test('browser back navigation after login still shows authenticated header state', async ({ page }) => {
  58 |     await loginViaUI(page); // ends on the real post-login landing page
  59 |     await page.goto('/tutorials');
  60 | 
  61 |     await page.goBack(); // bfcache-restores the post-login landing page
  62 | 
  63 |     // Regardless of which page bfcache restores, the header must reflect
  64 |     // the real (still logged-in) session — not whatever it looked like at
  65 |     // the moment the browser cached that page.
  66 |     await expect(page.locator('button[aria-label="Notifications"]')).toBeVisible({ timeout: 10000 });
  67 |   });
  68 | });
  69 | 
```