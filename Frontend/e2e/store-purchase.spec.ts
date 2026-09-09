import { test, expect } from '@playwright/test';
import { AUTH_STATE_PATH } from './global-setup';

// Fixed ID from Backend/prisma/seedE2E.ts — see that file's comment for why
// the store-purchase flow is scoped to the free ($0) claim path rather than
// real BOG/Stripe checkout (no gateway test credentials in CI).
const SEEDED_FREE_PRODUCT_ID = '00000000-0000-4000-8000-00000000f00d';

// Reuses the session global-setup.ts logged in once — see that file's
// comment on why this suite doesn't submit the real login form itself.
// Being logged in doesn't change the public marketplace-browsing test below.
test.use({ storageState: AUTH_STATE_PATH });

test.describe('Store Purchases', () => {
  test('browsing the marketplace shows the seeded free product', async ({ page }) => {
    await page.goto('/marketplace');
    await expect(page.getByText('QA E2E Free Product')).toBeVisible({ timeout: 10000 });
  });

  test('claiming a free product unlocks the download button', async ({ page }) => {
    await page.goto(`/store/${SEEDED_FREE_PRODUCT_ID}`);

    const claimButton = page.getByRole('button', { name: /get for free|უფასოდ მიღება/i });
    const downloadButton = page.getByRole('button', { name: /download|ჩამოტვირთვა/i });

    // pages/store/[id].tsx's getServerSideProps can't see the client's
    // Bearer token, so SSR always renders the anonymous "claim" button first
    // — a client-side re-fetch then flips `product.purchased` and swaps in
    // "download" once ownership is known. Idempotent reruns against a
    // non-reset DB hit this every time (the product is already owned), so
    // wait for that re-fetch to settle before branching — otherwise
    // `claimButton.isVisible()` can catch the pre-swap state and click a
    // button that's replaced a moment later.
    await page.waitForLoadState('networkidle');
    await expect(claimButton.or(downloadButton)).toBeVisible({ timeout: 10000 });
    if (await claimButton.isVisible()) {
      await claimButton.click();
    }
    await expect(downloadButton).toBeVisible({ timeout: 10000 });
  });

  test('a verified-purchase review can be submitted on an owned product', async ({ page }) => {
    await page.goto(`/store/${SEEDED_FREE_PRODUCT_ID}`);

    const writeReviewButton = page.getByRole('button', { name: /write a review|შეფასების დატოვება/i });
    const alreadyReviewed = page.getByText(/your review|თქვენი შეფასება/i);

    // Skip on a rerun that already left a review for this product/user pair
    // (ProductReview.@@unique([productId, userId]) — see Backend's schema).
    // Wait for ProductReviewsSection's async summary fetch to resolve into
    // one of the two states before branching — same isVisible()-race reason
    // as the claim test above.
    await expect(writeReviewButton.or(alreadyReviewed)).toBeVisible({ timeout: 10000 });
    test.skip(await alreadyReviewed.isVisible(), 'Already reviewed by this QA user in a prior run');

    await writeReviewButton.click();
    await page.getByRole('radio', { name: '5 stars', exact: true }).focus();
    await page.keyboard.press('Space');
    await page.locator('textarea').fill('Automated nightly QA review — verifying the verified-purchase review flow end to end.');
    await page.getByRole('button', { name: /submit review|შეფასების გაგზავნა/i }).click();

    await expect(page.getByText(/your review|თქვენი შეფასება/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/verified buyer|დადასტურებული მყიდველი/i).first()).toBeVisible();
  });
});
