import { test, expect } from '@playwright/test';
import { AUTH_STATE_PATH } from './global-setup';

// Fixed ID from Backend/prisma/seedE2E.ts — both files are the source of
// truth for this same fixture, kept in sync manually (see that file's
// comment for why it uses fixed IDs instead of a lookup).
const SEEDED_COURSE_ID = '00000000-0000-4000-8000-0000000c0575';

// Reuses the session global-setup.ts logged in once — see that file's
// comment on why this suite doesn't submit the real login form itself.
test.use({ storageState: AUTH_STATE_PATH });

// Backend/prisma/seedE2E.ts pre-enrolls the QA test user in "QA E2E Test
// Course" directly (bypassing BOG/Stripe checkout — no gateway test
// credentials exist in CI). This suite covers the enrolled-student
// experience (dashboard listing, curriculum access); the checkout step
// itself is out of scope here — see seedE2E.ts's own comment.
test.describe('Course Enrollment', () => {
  test('enrolled course appears on the student dashboard', async ({ page }) => {
    await page.goto('/dashboard?tab=courses');

    await expect(page.getByText('QA E2E Test Course')).toBeVisible({ timeout: 10000 });
  });

  test('enrolled student can open the course curriculum without a purchase prompt', async ({ page }) => {
    await page.goto(`/courses/${SEEDED_COURSE_ID}/learn`);

    // An enrolled student should never see the buy/checkout CTA that a
    // non-enrolled visitor gets on the same route (routes/courses.ts's
    // checkCourseAccess would 403 the curriculum API call for them instead).
    await expect(page.getByText(/checkout|ყიდვა|შეიძინე/i)).toHaveCount(0);
    await expect(page.getByText('Section 1')).toBeVisible({ timeout: 10000 });
  });
});
