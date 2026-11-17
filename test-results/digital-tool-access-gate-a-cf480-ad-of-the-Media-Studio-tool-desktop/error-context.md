# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: digital-tool-access-gate.spec.ts >> an unentitled learner sees an access-required state instead of the Media Studio tool
- Location: e2e/digital-tool-access-gate.spec.ts:6:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('alert').filter({ hasText: /access/i })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('alert').filter({ hasText: /access/i })

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
- main:
  - button "Back"
  - heading "AI Voice & Video Studio" [level=1]
  - paragraph: Turn text into natural-sounding speech, or pull a transcript and notes from any video — all in one place.
  - button "How to use"
  - tablist:
    - tab "Text → Speech" [selected]
    - tab "Video → Text"
  - paragraph: Text-to-speech is not configured yet (AZURE_SPEECH_KEY/AZURE_SPEECH_REGION).
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
- button "Scroll to top":
  - img
- paragraph:
  - text: We use cookies to keep the site running smoothly and improve your experience.
  - link "Learn more":
    - /url: /en/privacy
- button "Manage"
- button "Accept All"
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { AUTH_STATE_PATH } from './global-setup';
  3  | 
  4  | test.use({ storageState: AUTH_STATE_PATH });
  5  | 
  6  | test('an unentitled learner sees an access-required state instead of the Media Studio tool', async ({ page }) => {
  7  |   // The seeded QA learner (seedE2E.ts) has no ProductPurchase and no
  8  |   // AccessGrant for 'media-studio' — DigitalToolAccessGate.tsx must show
  9  |   // the denied state rather than rendering the real tool UI, which would
  10 |   // otherwise 403 on its very first action against
  11 |   // mediaStudio.ts's requireMediaStudioAccess.
  12 |   await page.goto('/en/dashboard/tools/media-studio');
> 13 |   await expect(page.getByRole('alert').filter({ hasText: /access/i })).toBeVisible({ timeout: 10000 });
     |                                                                        ^ Error: expect(locator).toBeVisible() failed
  14 |   // The page keeps the tool's own header (h1 = tool name, via ToolShell)
  15 |   // so the locked state has site navigation; the access message is the h2.
  16 |   await expect(page.getByRole('heading', { level: 2 }).filter({ hasText: /access/i })).toBeVisible();
  17 | });
  18 | 
```