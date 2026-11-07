# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: course-enrollment.spec.ts >> Course Enrollment >> enrolled student can open the course curriculum without a purchase prompt
- Location: e2e/course-enrollment.spec.ts:25:7

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByText(/checkout|ყიდვა|შეიძინე/i)
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByText(/checkout|ყიდვა|შეიძინე/i)
    14 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - status [ref=e4]:
      - generic [ref=e5]:
        - paragraph [ref=e6]:
          - text: "🚀 CDC პლატფორმა გაშვებულია სატესტო (Beta) რეჟიმში. რაიმე შეფერხების ან ხარვეზის აღმოჩენის შემთხვევაში, გთხოვთ მოგვწეროთ ელ-ფოსტაზე:"
          - link "contact@cdc.org.ge" [ref=e7] [cursor=pointer]:
            - /url: mailto:contact@cdc.org.ge
        - button "დახურვა" [ref=e8] [cursor=pointer]
    - generic [ref=e12]:
      - navigation [ref=e13]:
        - generic [ref=e14]:
          - link "CDC" [ref=e16] [cursor=pointer]:
            - /url: /
            - img "CDC" [ref=e17]
          - generic [ref=e20]:
            - button "ძებნა" [ref=e22] [cursor=pointer]
            - button "Change language" [ref=e28] [cursor=pointer]:
              - generic [ref=e37]: ka
            - button "Toggle dark mode" [ref=e38] [cursor=pointer]
            - button "Notifications" [ref=e42] [cursor=pointer]:
              - generic [ref=e46]: "1"
            - button "Q" [ref=e48] [cursor=pointer]
            - button "Toggle menu" [ref=e51] [cursor=pointer]
      - generic [ref=e53]:
        - generic [ref=e54]:
          - button "უკან დაბრუნება" [ref=e56] [cursor=pointer]
          - generic [ref=e59]:
            - generic [ref=e60]: Video is not available for this lesson yet.
            - generic:
              - generic:
                - generic: qa-e2e@cdc.test
                - generic: qa-e2e@cdc.test
                - generic: qa-e2e@cdc.test
                - generic: qa-e2e@cdc.test
                - generic: qa-e2e@cdc.test
                - generic: qa-e2e@cdc.test
          - heading "Lesson 1" [level=1] [ref=e61]
          - generic [ref=e62]:
            - button "მიმოხილვა" [ref=e63] [cursor=pointer]
            - button "კონსპექტი" [ref=e64] [cursor=pointer]
            - button "რესურსები" [ref=e65] [cursor=pointer]
            - button "დავალება" [ref=e66] [cursor=pointer]
            - button "დისკუსია" [ref=e67] [cursor=pointer]
          - paragraph [ref=e69]: Seeded fixture for the nightly Playwright suite — the test user is pre-enrolled so the enrollment/dashboard flow can be tested without going through real checkout.
        - complementary [ref=e70]:
          - generic [ref=e72]:
            - generic [ref=e73]: სილაბუსი
            - generic [ref=e74]: 0% დასრულებულია
          - generic [ref=e77]:
            - button "Section 1 ▾" [ref=e78] [cursor=pointer]:
              - generic [ref=e79]: Section 1
              - generic [ref=e80]: ▾
            - button "✓ Lesson 1 0:00" [ref=e82] [cursor=pointer]:
              - checkbox "✓" [ref=e83]
              - generic [ref=e84]: Lesson 1
              - generic [ref=e85]: 0:00
      - button "AI რეპეტიტორს ვთხოვ დახმარებას" [ref=e86] [cursor=pointer]
    - button "Scroll to top"
    - generic [ref=e91]:
      - paragraph [ref=e96]:
        - text: ჩვენ ვიყენებთ ქუქიებს საიტის გამართული მუშაობისა და თქვენი გამოცდილების გასაუმჯობესებლად.
        - link "დეტალურად" [ref=e97] [cursor=pointer]:
          - /url: /privacy
      - generic [ref=e98]:
        - button "მართვა" [ref=e99] [cursor=pointer]
        - button "დადასტურება" [ref=e100] [cursor=pointer]
  - alert [ref=e101]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { AUTH_STATE_PATH } from './global-setup';
  3  | 
  4  | // Fixed ID from Backend/prisma/seedE2E.ts — both files are the source of
  5  | // truth for this same fixture, kept in sync manually (see that file's
  6  | // comment for why it uses fixed IDs instead of a lookup).
  7  | const SEEDED_COURSE_ID = '00000000-0000-4000-8000-0000000c0575';
  8  | 
  9  | // Reuses the session global-setup.ts logged in once — see that file's
  10 | // comment on why this suite doesn't submit the real login form itself.
  11 | test.use({ storageState: AUTH_STATE_PATH });
  12 | 
  13 | // Backend/prisma/seedE2E.ts pre-enrolls the QA test user in "QA E2E Test
  14 | // Course" directly (bypassing BOG/Stripe checkout — no gateway test
  15 | // credentials exist in CI). This suite covers the enrolled-student
  16 | // experience (dashboard listing, curriculum access); the checkout step
  17 | // itself is out of scope here — see seedE2E.ts's own comment.
  18 | test.describe('Course Enrollment', () => {
  19 |   test('enrolled course appears on the student dashboard', async ({ page }) => {
  20 |     await page.goto('/dashboard?tab=courses');
  21 | 
  22 |     await expect(page.getByText('QA E2E Test Course')).toBeVisible({ timeout: 10000 });
  23 |   });
  24 | 
  25 |   test('enrolled student can open the course curriculum without a purchase prompt', async ({ page }) => {
  26 |     await page.goto(`/courses/${SEEDED_COURSE_ID}/learn`);
  27 | 
  28 |     // An enrolled student should never see the buy/checkout CTA that a
  29 |     // non-enrolled visitor gets on the same route (routes/courses.ts's
  30 |     // checkCourseAccess would 403 the curriculum API call for them instead).
> 31 |     await expect(page.getByText(/checkout|ყიდვა|შეიძინე/i)).toHaveCount(0);
     |                                                             ^ Error: expect(locator).toHaveCount(expected) failed
  32 |     await expect(page.getByText('Section 1')).toBeVisible({ timeout: 10000 });
  33 |   });
  34 | });
  35 | 
```