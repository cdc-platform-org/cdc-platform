# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> User Authentication >> logs out and returns to a guest header state
- Location: e2e/auth.spec.ts:45:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected: "http://localhost:3000/"
Received: "http://localhost:3000/auth/login?redirect=%2Fdashboard"
Timeout:  5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    13 × locator resolved to <html lang="ka">…</html>
       - unexpected value "http://localhost:3000/auth/login?redirect=%2Fdashboard"

```

```yaml
- status:
  - paragraph:
    - text: "🚀 CDC პლატფორმა გაშვებულია სატესტო (Beta) რეჟიმში. რაიმე შეფერხების ან ხარვეზის აღმოჩენის შემთხვევაში, გთხოვთ მოგვწეროთ ელ-ფოსტაზე:"
    - link "contact@cdc.org.ge":
      - /url: mailto:contact@cdc.org.ge
  - button "დახურვა"
- link "CDC Home":
  - /url: /
  - img "CDC"
- button "Toggle dark mode"
- button "Change language": ka
- heading "მოგესალმებით" [level=1]
- paragraph: შედით თქვენს CDC პლატფორმის ანგარიშზე
- text: ელ. ფოსტა
- textbox "ელ. ფოსტა":
  - /placeholder: you@example.com
- text: პაროლი
- link "დაგავიწყდათ პაროლი?":
  - /url: /auth/forgot-password
- textbox "პაროლი":
  - /placeholder: ••••••••
- button "Show password"
- checkbox "დამიმახსოვრე" [checked]
- text: დამიმახსოვრე
- button "შესვლა"
- text: ან გააგრძელეთ Google-ით
- link "GitHub-ით შესვლა":
  - /url: http://localhost:4000/api/auth/github
- link "Facebook-ით შესვლა":
  - /url: http://localhost:4000/api/auth/facebook
- paragraph:
  - text: არ გაქვთ ანგარიში?
  - link "რეგისტრაცია":
    - /url: /auth/register
- button "Scroll to top":
  - img
- paragraph:
  - text: ჩვენ ვიყენებთ ქუქიებს საიტის გამართული მუშაობისა და თქვენი გამოცდილების გასაუმჯობესებლად.
  - link "დეტალურად":
    - /url: /privacy
- button "მართვა"
- button "დადასტურება"
- alert: მოგესალმებით
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { loginViaUI, TEST_EMAIL, TEST_PASSWORD } from './fixtures/auth';
  3  | 
  4  | test.describe('User Authentication', () => {
  5  |   test('registers a new self-serve Student account and lands authenticated', async ({ page }) => {
  6  |     // Self-serve Student/Client signups are auto-approved (see backend's
  7  |     // routes/auth.ts) — a fresh registration should reach /courses already
  8  |     // logged in, no admin-approval interstitial.
  9  |     const uniqueEmail = `qa-e2e-register-${Date.now()}@cdc.test`;
  10 | 
  11 |     // register.tsx's 2-step role/account-type wizard was removed — every
  12 |     // visitor now lands directly on one unified Name/Email/Password/Phone
  13 |     // form (role defaults to Student server-side, see authSchemas.ts), so
  14 |     // there's no longer a "Learning & Career" / "Student" step to click
  15 |     // through before the form fields even exist in the DOM.
  16 |     await page.goto('/auth/register');
  17 | 
  18 |     await page.locator('#name').fill('QA Registration Test');
  19 |     await page.locator('#email').fill(uniqueEmail);
  20 |     await page.locator('#password').fill('RegisterTest123!');
  21 |     await page.locator('#phone').fill('+995555000111');
  22 |     await page.locator('form input[type="checkbox"]').check();
  23 |     await page.locator('button[type="submit"]').click();
  24 | 
  25 |     await expect(page).toHaveURL(/\/courses/, { timeout: 15000 });
  26 |     // Authenticated header state — the guest-only login pill must be gone.
  27 |     await expect(page.locator('button[aria-label="Notifications"]')).toBeVisible();
  28 |   });
  29 | 
  30 |   test('logs in with valid seeded credentials', async ({ page }) => {
  31 |     await loginViaUI(page);
  32 |     await expect(page.locator('button[aria-label="Notifications"]')).toBeVisible();
  33 |   });
  34 | 
  35 |   test('rejects invalid credentials with an error and stays on the login page', async ({ page }) => {
  36 |     await page.goto('/auth/login');
  37 |     await page.locator('#email').fill(TEST_EMAIL);
  38 |     await page.locator('#password').fill('definitely-the-wrong-password');
  39 |     await page.locator('button[type="submit"]').click();
  40 | 
  41 |     await expect(page.getByText(/ვერ მოხერხდა|failed|invalid/i)).toBeVisible({ timeout: 10000 });
  42 |     await expect(page).toHaveURL(/\/auth\/login/);
  43 |   });
  44 | 
  45 |   test('logs out and returns to a guest header state', async ({ page }) => {
  46 |     await loginViaUI(page);
  47 |     await page.goto('/dashboard');
  48 | 
  49 |     // Desktop UserMenu dropdown → Log Out (see src/components/layout/UserMenu.tsx).
  50 |     await page.locator('nav button:has(> div.rounded-full)').first().click();
  51 |     await page.getByRole('menuitem', { name: /log out|გამოსვლა/i }).or(page.locator('button', { hasText: /log out|გამოსვლა/i })).first().click();
  52 | 
> 53 |     await expect(page).toHaveURL('/');
     |                        ^ Error: expect(page).toHaveURL(expected) failed
  54 |     await expect(page.locator('button[aria-label="Notifications"]')).toHaveCount(0);
  55 |   });
  56 | });
  57 | 
```