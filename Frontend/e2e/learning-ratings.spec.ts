import { test, expect } from '@playwright/test';
import { AUTH_STATE_PATH } from './global-setup';

// These fixtures are pre-enrolled by seedE2E.ts, so rating persistence is
// tested against the real API/database without touching a payment gateway.
const targets = [
  { path: '/courses/00000000-0000-4000-8000-0000000c0575', name: 'course' },
  { path: '/live-trainings/00000000-0000-4000-8000-000000007a10', name: 'live training' },
];

test.use({ storageState: AUTH_STATE_PATH });

for (const target of targets) {
  test(`${target.name} review persists and editing keeps one review per learner`, async ({ page }) => {
    await page.route(/\/api\/payments\/(?:stripe\/)?checkout\//, (route) => route.abort());
    await page.route(/https:\/\/(?:www\.youtube-nocookie\.com|player\.vimeo\.com)\//, (route) => route.abort());
    // Pre-accept the cookie consent banner (CookieConsentBanner.tsx) so its
    // fixed bottom-left card never renders — otherwise it can overlap and
    // intercept clicks on the Save review button once the page is scrolled.
    await page.addInitScript(() => {
      localStorage.setItem('cdc-cookie-consent', JSON.stringify({ essential: true, analytics: true, marketing: true, decidedAt: new Date().toISOString() }));
    });
    await page.goto(`/en${target.path}`);
    const reviews = page.getByRole('region', { name: 'Ratings and reviews' });
    await expect(reviews.getByRole('button', { name: 'Save review', exact: true })).toBeVisible();
    // Native radios support keyboard selection as well as pointer input.
    await reviews.getByRole('radio', { name: '4 / 5', exact: true }).focus();
    await page.keyboard.press('Space');
    await reviews.getByLabel('Comment (optional)').fill('QA review: clear explanations.');
    await reviews.getByRole('button', { name: 'Save review', exact: true }).click();
    await expect(reviews.getByRole('status')).toHaveText('Review saved.');
    await expect(reviews.getByRole('listitem').filter({ hasText: 'QA review: clear explanations.' })).toHaveCount(1);
    await page.reload();
    await expect(reviews.getByRole('radio', { name: '4 / 5', exact: true })).toBeChecked();
    await expect(reviews.getByLabel('Comment (optional)')).toHaveValue('QA review: clear explanations.');
    const initialCount = await reviews.getByRole('listitem').count();
    await reviews.getByRole('radio', { name: '4 / 5', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(reviews.getByRole('radio', { name: '5 / 5', exact: true })).toBeChecked();
    await reviews.getByLabel('Comment (optional)').fill('QA review: updated after completing the material.');
    await reviews.getByRole('button', { name: 'Save review', exact: true }).click();
    await expect(reviews.getByRole('status')).toHaveText('Review saved.');
    await expect(reviews.getByRole('listitem')).toHaveCount(initialCount);
    await expect(reviews.getByRole('listitem').filter({ hasText: 'QA review: updated after completing the material.' })).toHaveCount(1);
    await page.reload();
    await expect(reviews.getByRole('radio', { name: '5 / 5', exact: true })).toBeChecked();
    await expect(reviews.getByLabel('Comment (optional)')).toHaveValue('QA review: updated after completing the material.');
  });
}
