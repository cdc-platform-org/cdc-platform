# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: learning-ratings.spec.ts >> live training review persists and editing keeps one review per learner
- Location: e2e/learning-ratings.spec.ts:14:7

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByRole('region', { name: 'Ratings and reviews' }).getByRole('listitem')
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByRole('region', { name: 'Ratings and reviews' }).getByRole('listitem')
    14 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [active] [ref=f3e1]:
  - generic [ref=f3e3]:
    - status [ref=f3e4]:
      - generic [ref=f3e5]:
        - paragraph [ref=f3e6]:
          - text: 🚀 CDC Platform is currently in Beta mode. If you encounter any issues or technical hiccups, please contact us at
          - link "contact@cdc.org.ge" [ref=f3e7] [cursor=pointer]:
            - /url: mailto:contact@cdc.org.ge
        - button "Dismiss" [ref=f3e8] [cursor=pointer]
    - generic [ref=f3e12]:
      - navigation [ref=f3e13]:
        - generic [ref=f3e14]:
          - link "CDC" [ref=f3e16] [cursor=pointer]:
            - /url: /en
            - img "CDC" [ref=f3e17]
          - generic [ref=f3e20]:
            - button "Search" [ref=f3e22] [cursor=pointer]
            - button "Change language" [ref=f3e28] [cursor=pointer]:
              - generic [ref=f3e36]: en
            - button "Toggle dark mode" [ref=f3e37] [cursor=pointer]
            - button "Notifications" [ref=f3e41] [cursor=pointer]:
              - generic [ref=f3e45]: "1"
            - button "Q" [ref=f3e47] [cursor=pointer]
            - button "Toggle menu" [ref=f3e50] [cursor=pointer]
      - generic [ref=f3e52]:
        - button "Back" [ref=f3e54] [cursor=pointer]
        - generic [ref=f3e57]:
          - generic [ref=f3e58]: QA Fixtures
          - generic [ref=f3e59]: 🇬🇪🇬🇧 Georgian / English
        - heading "QA E2E Live Training" [level=1] [ref=f3e60]
        - generic [ref=f3e61]:
          - 'img "Rating: 5.0 / 5" [ref=f3e62]':
            - generic [ref=f3e63]: ★
            - generic [ref=f3e64]: ★
            - generic [ref=f3e65]: ★
            - generic [ref=f3e66]: ★
            - generic [ref=f3e67]: ★
          - generic [ref=f3e68]: 5.0 / 5
          - generic [ref=f3e69]: 1 review
        - generic [ref=f3e70]:
          - generic [ref=f3e71]:
            - generic [ref=f3e72]: Share
            - link "Facebook" [ref=f3e73] [cursor=pointer]:
              - /url: https://www.facebook.com/sharer/sharer.php?u=http%3A%2F%2Flocalhost%3A3000%2Fen%2Flive-trainings%2F00000000-0000-4000-8000-000000007a10
            - link "LinkedIn" [ref=f3e76] [cursor=pointer]:
              - /url: https://www.linkedin.com/sharing/share-offsite/?url=http%3A%2F%2Flocalhost%3A3000%2Fen%2Flive-trainings%2F00000000-0000-4000-8000-000000007a10
            - link "X (Twitter)" [ref=f3e79] [cursor=pointer]:
              - /url: https://twitter.com/intent/tweet?url=http%3A%2F%2Flocalhost%3A3000%2Fen%2Flive-trainings%2F00000000-0000-4000-8000-000000007a10&text=QA%20E2E%20Live%20Training
            - link "Telegram" [ref=f3e82] [cursor=pointer]:
              - /url: https://t.me/share/url?url=http%3A%2F%2Flocalhost%3A3000%2Fen%2Flive-trainings%2F00000000-0000-4000-8000-000000007a10&text=QA%20E2E%20Live%20Training
            - link "WhatsApp" [ref=f3e85] [cursor=pointer]:
              - /url: https://api.whatsapp.com/send?text=QA%20E2E%20Live%20Training%20http%3A%2F%2Flocalhost%3A3000%2Fen%2Flive-trainings%2F00000000-0000-4000-8000-000000007a10
            - button "Copy Link" [ref=f3e88] [cursor=pointer]
          - link "Gift this" [ref=f3e92] [cursor=pointer]:
            - /url: /en/gift-cards?amount=100&item=QA+E2E+Live+Training&url=%2Flive-trainings%2F00000000-0000-4000-8000-000000007a10
        - iframe [ref=f3e99]:
          
        - paragraph [ref=f3e100]: Seeded training for rating and media tests. Payment endpoints are intercepted by Playwright.
        - generic [ref=f3e101]:
          - generic [ref=f3e102]: 1/15/2030, 2:00:00 PM
          - generic [ref=f3e105]: 100.00 ₾
        - generic [ref=f3e106]:
          - heading "Meet the trainer" [level=2] [ref=f3e107]
          - iframe [ref=f3e109]:
            
        - generic [ref=f3e110]:
          - generic [ref=f3e111]:
            - generic [ref=f3e112]: 99 seats left of 100
            - generic [ref=f3e118]: 1 / 100 registered
          - generic [ref=f3e121]: Minimum group reached — this session is confirmed to run
        - generic [ref=f3e125]:
          - paragraph [ref=f3e129]: You're enrolled! Find the join link and recording on your dashboard closer to the session.
          - link "Go to My Live Trainings" [ref=f3e130] [cursor=pointer]:
            - /url: /en/dashboard/live-trainings
        - region [ref=f3e132]:
          - heading "Ratings and reviews" [level=2] [ref=f3e133]
          - generic [ref=f3e134]:
            - 'img "Rating: 5.0 / 5" [ref=f3e135]':
              - generic [ref=f3e136]: ★
              - generic [ref=f3e137]: ★
              - generic [ref=f3e138]: ★
              - generic [ref=f3e139]: ★
              - generic [ref=f3e140]: ★
            - generic [ref=f3e141]: 5.0 / 5
            - generic [ref=f3e142]: 1 review
          - generic [ref=f3e143]:
            - paragraph [ref=f3e144]: Edit your review
            - group "Rating" [ref=f3e145]:
              - radiogroup "Rating" [ref=f3e147]:
                - generic [ref=f3e148] [cursor=pointer]:
                  - radio "1 / 5" [ref=f3e149]
                  - text: ★
                - generic [ref=f3e150] [cursor=pointer]:
                  - radio "2 / 5" [ref=f3e151]
                  - text: ★
                - generic [ref=f3e152] [cursor=pointer]:
                  - radio "3 / 5" [ref=f3e153]
                  - text: ★
                - generic [ref=f3e154] [cursor=pointer]:
                  - radio "4 / 5" [ref=f3e155]
                  - text: ★
                - generic [ref=f3e156] [cursor=pointer]:
                  - radio "5 / 5" [checked] [ref=f3e157]
                  - text: ★
              - generic [ref=f3e158]:
                - generic [ref=f3e159]: Comment (optional)
                - textbox "Comment (optional)" [ref=f3e160]: "QA review: updated after completing the material."
              - button "Save review" [ref=f3e161] [cursor=pointer]
            - status [ref=f3e162]: Review saved.
          - list [ref=f3e163]:
            - listitem [ref=f3e164]:
              - generic [ref=f3e165]:
                - generic [ref=f3e166]: QA E2E Tester
                - 'img "Rating: 5.0 / 5" [ref=f3e167]':
                  - generic [ref=f3e168]: ★
                  - generic [ref=f3e169]: ★
                  - generic [ref=f3e170]: ★
                  - generic [ref=f3e171]: ★
                  - generic [ref=f3e172]: ★
              - paragraph [ref=f3e173]: "QA review: updated after completing the material."
    - button "Scroll to top" [ref=f3e174] [cursor=pointer]
  - alert [ref=f3e177]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { AUTH_STATE_PATH } from './global-setup';
  3  | 
  4  | // These fixtures are pre-enrolled by seedE2E.ts, so rating persistence is
  5  | // tested against the real API/database without touching a payment gateway.
  6  | const targets = [
  7  |   { path: '/courses/00000000-0000-4000-8000-0000000c0575', name: 'course' },
  8  |   { path: '/live-trainings/00000000-0000-4000-8000-000000007a10', name: 'live training' },
  9  | ];
  10 | 
  11 | test.use({ storageState: AUTH_STATE_PATH });
  12 | 
  13 | for (const target of targets) {
  14 |   test(`${target.name} review persists and editing keeps one review per learner`, async ({ page }) => {
  15 |     await page.route(/\/api\/payments\/(?:stripe\/)?checkout\//, (route) => route.abort());
  16 |     await page.route(/https:\/\/(?:www\.youtube-nocookie\.com|player\.vimeo\.com)\//, (route) => route.abort());
  17 |     // Pre-accept the cookie consent banner (CookieConsentBanner.tsx) so its
  18 |     // fixed bottom-left card never renders — otherwise it can overlap and
  19 |     // intercept clicks on the Save review button once the page is scrolled.
  20 |     await page.addInitScript(() => {
  21 |       localStorage.setItem('cdc-cookie-consent', JSON.stringify({ essential: true, analytics: true, marketing: true, decidedAt: new Date().toISOString() }));
  22 |     });
  23 |     await page.goto(`/en${target.path}`);
  24 |     const reviews = page.getByRole('region', { name: 'Ratings and reviews' });
  25 |     await expect(reviews.getByRole('button', { name: 'Save review', exact: true })).toBeVisible();
  26 |     // Native radios support keyboard selection as well as pointer input.
  27 |     await reviews.getByRole('radio', { name: '4 / 5', exact: true }).focus();
  28 |     await page.keyboard.press('Space');
  29 |     await reviews.getByLabel('Comment (optional)').fill('QA review: clear explanations.');
  30 |     await reviews.getByRole('button', { name: 'Save review', exact: true }).click();
  31 |     await expect(reviews.getByRole('status')).toHaveText('Review saved.');
  32 |     await expect(reviews.getByRole('listitem').filter({ hasText: 'QA review: clear explanations.' })).toHaveCount(1);
  33 |     await page.reload();
  34 |     await expect(reviews.getByRole('radio', { name: '4 / 5', exact: true })).toBeChecked();
  35 |     await expect(reviews.getByLabel('Comment (optional)')).toHaveValue('QA review: clear explanations.');
  36 |     const initialCount = await reviews.getByRole('listitem').count();
  37 |     await reviews.getByRole('radio', { name: '4 / 5', exact: true }).focus();
  38 |     await page.keyboard.press('ArrowRight');
  39 |     await expect(reviews.getByRole('radio', { name: '5 / 5', exact: true })).toBeChecked();
  40 |     await reviews.getByLabel('Comment (optional)').fill('QA review: updated after completing the material.');
  41 |     await reviews.getByRole('button', { name: 'Save review', exact: true }).click();
  42 |     await expect(reviews.getByRole('status')).toHaveText('Review saved.');
> 43 |     await expect(reviews.getByRole('listitem')).toHaveCount(initialCount);
     |                                                 ^ Error: expect(locator).toHaveCount(expected) failed
  44 |     await expect(reviews.getByRole('listitem').filter({ hasText: 'QA review: updated after completing the material.' })).toHaveCount(1);
  45 |     await page.reload();
  46 |     await expect(reviews.getByRole('radio', { name: '5 / 5', exact: true })).toBeChecked();
  47 |     await expect(reviews.getByLabel('Comment (optional)')).toHaveValue('QA review: updated after completing the material.');
  48 |   });
  49 | }
  50 | 
```