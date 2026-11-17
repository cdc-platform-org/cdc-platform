# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: learning-ratings.spec.ts >> course review persists and editing keeps one review per learner
- Location: e2e/learning-ratings.spec.ts:14:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('region', { name: 'Ratings and reviews' }).getByRole('button', { name: 'Save review', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('region', { name: 'Ratings and reviews' }).getByRole('button', { name: 'Save review', exact: true })

```

```yaml
- status:
  - paragraph:
    - text: "The platform is in beta. Support:"
    - link "contact@cdc.org.ge":
      - /url: mailto:contact@cdc.org.ge
  - button "Dismiss"
- navigation:
  - link "CDC":
    - /url: /en
    - img "CDC"
    - text: CDC
  - button "Digital College"
  - button "Digital Market"
  - button "Employment"
  - link "Forum":
    - /url: /en/forum
  - button "About"
  - searchbox "Search courses, articles, products..."
  - button "Change language": en
  - button "Toggle dark mode"
  - button "Notifications": "1"
  - button "Q"
- link "← All Courses":
  - /url: /en/courses
- paragraph: Trailer coming soon
- text: QA Fixtures 🇬🇪 Georgian
- complementary:
  - text: New
  - heading "QA E2E Test Course" [level=1]
  - text: 0 reviews
  - paragraph
  - paragraph: 1 students
  - text: 100.00 ₾
  - link "Continue Learning →":
    - /url: /en/courses/00000000-0000-4000-8000-0000000c0575/learn
  - term: Duration
  - definition: 0 min
  - term: Lessons
  - definition: "1"
  - term: Language
  - definition: 🇬🇪 Georgian
  - term: Level
  - definition: Not specified
  - paragraph: AI tools in the Digital Market
  - paragraph: Find available tools and their access options in one place.
  - link "Explore AI tools":
    - /url: /en/marketplace?category=Digital%20AI%20Tools
- tablist "Course content":
  - tab "Overview" [selected]
  - tab "Curriculum"
  - tab "Student projects"
  - tab "Reviews"
- tabpanel "Overview":
  - heading "What you’ll learn" [level=2]
  - paragraph: Seeded fixture for the nightly Playwright suite — the test user is pre-enrolled so the enrollment/dashboard flow can be tested without going through real checkout.
  - text: 1 lessons 0 min
  - heading "Instructor" [level=2]
  - paragraph: Instructor details coming soon
  - heading "Frequently asked questions" [level=2]
  - group: How do I start learning?
  - group: Can I preview the course?
  - group: How can I pay?
- contentinfo:
  - link "CDC":
    - /url: /en
    - img "CDC"
    - text: CDC
  - paragraph: Teaching digital professions in Guria — supported by HEKS/EPER Georgia.
  - list:
    - listitem:
      - link "contact@cdc.org.ge":
        - /url: mailto:contact@cdc.org.ge
    - listitem:
      - link "+995 551 14 14 11":
        - /url: tel:+995551141411
  - heading "Digital College" [level=3]
  - list:
    - listitem:
      - link "All Courses":
        - /url: /en/courses
    - listitem:
      - link "🎁 Gift cards":
        - /url: /en/gift-cards
    - listitem:
      - link "Success Stories":
        - /url: /en/success-stories
    - listitem:
      - link "Trainers":
        - /url: /en/trainers
    - listitem:
      - link "Photo Gallery":
        - /url: /en/gallery
  - heading "Community" [level=3]
  - list:
    - listitem:
      - link "Jobs & Projects":
        - /url: /en/community
    - listitem:
      - link "Mentors":
        - /url: /en/mentors
    - listitem:
      - link "Digital Market":
        - /url: /en/marketplace
    - listitem:
      - link "AI Tools":
        - /url: /en/marketplace?category=Digital%20AI%20Tools
    - listitem:
      - link "Forum":
        - /url: /en/forum
    - listitem:
      - link "CDC Studio":
        - /url: /en/agency
    - listitem:
      - link "Case Studies":
        - /url: /en/cases
  - heading "Help" [level=3]
  - list:
    - listitem:
      - link "Video Tutorials":
        - /url: /en/tutorials
    - listitem:
      - link "About Us":
        - /url: /en/about
    - listitem:
      - link "Get in Touch":
        - /url: /en/contact
  - heading "Legal" [level=3]
  - list:
    - listitem:
      - link "Privacy Policy":
        - /url: /en/privacy
    - listitem:
      - link "Terms & Conditions":
        - /url: /en/terms
    - listitem:
      - link "Refund Policy":
        - /url: /en/refund-policy
  - heading "Follow Us" [level=3]
  - link "Facebook":
    - /url: https://www.facebook.com/cdc.digitalcareers
  - link "Instagram":
    - /url: https://www.instagram.com/digitalcareers1/
  - link "TikTok":
    - /url: https://www.tiktok.com/@digitalcareers.geo
  - link "LinkedIn":
    - /url: https://www.linkedin.com/in/cdc-%E1%83%AA%E1%83%98%E1%83%A4%E1%83%A0%E1%83%A3%E1%83%9A%E1%83%98-%E1%83%9E%E1%83%A0%E1%83%9D%E1%83%A4%E1%83%94%E1%83%A1%E1%83%98%E1%83%91%E1%83%98%E1%83%A1-%E1%83%AA%E1%83%94%E1%83%9C%E1%83%A2%E1%83%A0%E1%83%98-473404428/
  - text: We Accept VISA Mastercard BOG Pay
  - paragraph: ა(ა)იპ ციფრული პროფესიების ცენტრი / Digital Careers Center (CDC Georgia)
  - paragraph: "ს/კ / ID Code: 438737743"
  - paragraph: © 2026 Digital Careers Center (CDC Georgia). All rights reserved.
- navigation "Course sections":
  - link "Course":
    - /url: "#course"
  - link "Trailer":
    - /url: "#trailer"
  - link "Details":
    - /url: "#details"
  - link "Lessons":
    - /url: "#lessons"
  - link "Instructor":
    - /url: "#instructor"
  - link "Continue Learning →":
    - /url: /en/courses/00000000-0000-4000-8000-0000000c0575/learn
- button "Scroll to top":
  - img
- alert
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
> 25 |     await expect(reviews.getByRole('button', { name: 'Save review', exact: true })).toBeVisible();
     |                                                                                     ^ Error: expect(locator).toBeVisible() failed
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
  43 |     await expect(reviews.getByRole('listitem')).toHaveCount(initialCount);
  44 |     await expect(reviews.getByRole('listitem').filter({ hasText: 'QA review: updated after completing the material.' })).toHaveCount(1);
  45 |     await page.reload();
  46 |     await expect(reviews.getByRole('radio', { name: '5 / 5', exact: true })).toBeChecked();
  47 |     await expect(reviews.getByLabel('Comment (optional)')).toHaveValue('QA review: updated after completing the material.');
  48 |   });
  49 | }
  50 | 
```