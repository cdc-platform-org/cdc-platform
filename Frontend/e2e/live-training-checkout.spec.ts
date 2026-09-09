import { test, expect, Page } from '@playwright/test';
import { AUTH_STATE_PATH } from './global-setup';

const TRAINING_ID = '00000000-0000-4000-8000-000000007a10';
const TRAINING_PATH = `/live-trainings/${TRAINING_ID}`;
const paidCheckout = /\/api\/payments\/(?:stripe\/)?checkout\//;
const emptyRatings = { averageRating: null, reviewCount: 0, reviews: [], myReview: null, canReview: false };
const trainingFixture = {
  id: TRAINING_ID, title: 'QA E2E Live Training', titleEn: 'QA E2E Live Training',
  description: 'Training checkout and video fixture.', descriptionEn: null,
  category: 'QA Fixtures', scheduledAt: '2030-01-15T14:00:00Z',
  price: 10000, currentPrice: 10000, priceType: 'TOTAL', durationMonths: null,
  published: true, language: 'BOTH', isEnrolled: false, isFull: false,
  maxCapacity: 100, minCapacity: 1, registeredCount: 1, seatsRemaining: 99, minThresholdMet: true,
  saleActive: false, isOnSale: false, discountPercent: null, discountEndDate: null,
  discountBadgeText: null, discountedPrice: null, thumbnailUrl: null,
  videoUrl: 'https://youtu.be/dQw4w9WgXcQ', trainerVideoUrl: 'https://vimeo.com/76979871/abc123def0',
  startDate: null, endDate: null, meetingUrl: null, classroomUrl: null, recordingUrl: null,
};

async function mockTraining(page: Page, overrides = {}) {
  const training = { ...trainingFixture, ...overrides };
  await page.route(`**/api${TRAINING_PATH}`, (route) => route.fulfill({ json: { data: training } }));
  await page.route(`**/api${TRAINING_PATH}/ratings`, (route) => route.fulfill({ json: { data: emptyRatings } }));
  return training;
}

test.beforeEach(async ({ page }) => {
  // Payment safety net: no test in this file can create a real gateway order.
  // Individual tests override this route with a deterministic response.
  await page.route(paidCheckout, (route) => route.fulfill({ status: 503, json: { message: 'Payment blocked by E2E test.' } }));
  await page.route(/https:\/\/(?:www\.youtube-nocookie\.com|player\.vimeo\.com)\//, (route) => route.abort());
});

test.describe('Public live training registration', () => {
  test('callback form collects contact details without granting enrollment', async ({ page }) => {
    await mockTraining(page);
    let payload: Record<string, unknown> | undefined;
    await page.route(`**/api${TRAINING_PATH}/register`, async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { data: { id: 'test-lead' } } });
    });
    await page.goto(`/en${TRAINING_PATH}`);
    await page.getByLabel('First name', { exact: true }).fill('  Ada  ');
    await page.getByLabel('Last name', { exact: true }).fill('  Lovelace  ');
    await page.getByLabel('Phone number', { exact: true }).fill('+995 555 12 34 56');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page.getByText(/No payment has been taken/)).toBeVisible();
    expect(payload).toEqual({ firstName: 'Ada', lastName: 'Lovelace', phone: '+995 555 12 34 56', website: '', locale: 'en' });
    await expect(page.getByRole('link', { name: 'Go to My Live Trainings' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Register & Pay/ })).toBeVisible();
  });

  test('paid registration opens authentication and public videos use safe embeds', async ({ page }) => {
    await mockTraining(page);
    let checkoutCalls = 0;
    page.on('request', (request) => { if (paidCheckout.test(request.url())) checkoutCalls++; });
    await page.goto(`/en${TRAINING_PATH}`);
    await expect(page.locator('iframe[title="QA E2E Live Training"]')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    await expect(page.locator('iframe[title="Meet the trainer — QA E2E Live Training"]')).toHaveAttribute('src', 'https://player.vimeo.com/video/76979871?h=abc123def0');
    await page.getByRole('button', { name: /Register & Pay/ }).click();
    await expect(page.getByText('Sign in or create an account to register for this training.')).toBeVisible();
    expect(checkoutCalls).toBe(0);
    await expect(page.getByRole('link', { name: 'Go to My Live Trainings' })).toHaveCount(0);
  });
});

test.describe('Authenticated live training checkout', () => {
  test.use({ storageState: AUTH_STATE_PATH });

  for (const locale of ['ka', 'en']) {
    test(`${locale} uses the expected gateway and never reports enrollment on failure`, async ({ page }) => {
      await mockTraining(page);
      let checkoutPath = '';
      let checkoutPayload: Record<string, unknown> | undefined;
      await page.route(paidCheckout, async (route) => {
        checkoutPath = new URL(route.request().url()).pathname;
        checkoutPayload = route.request().postDataJSON();
        await route.fulfill({ status: 503, json: { message: 'Test gateway unavailable. Please retry.' } });
      });
      await page.goto(`${locale === 'en' ? '/en' : ''}${TRAINING_PATH}`);
      // This field appears only after authentication hydration finishes.
      await expect(page.getByRole('textbox', { name: /Promo code|პრომო კოდი/ })).toBeVisible();
      const checkoutButton = page.getByRole('button', { name: /Register & Pay|რეგისტრაცია და გადახდა/ });
      await checkoutButton.click();
      await expect(page.getByRole('alert').filter({ hasText: 'Test gateway unavailable. Please retry.' })).toBeVisible();
      expect(checkoutPath).toBe(`/api/payments/${locale === 'en' ? 'stripe/' : ''}checkout/live-training/${TRAINING_ID}`);
      expect(checkoutPayload).toEqual(locale === 'en' ? { currency: 'usd' } : { lang: 'ka' });
      await expect(checkoutButton).toBeEnabled();
      await expect(page.getByRole('link', { name: /Go to My Live Trainings|ჩემი ლაივ ტრენინგები/, exact: true })).toHaveCount(0);
    });
  }

  test('promo removal restores price and free checkout requires server-confirmed enrollment', async ({ page }) => {
    const training = await mockTraining(page);
    await page.route('**/api/promos/validate', async (route) => {
      expect(route.request().postDataJSON()).toEqual({ code: 'QA100', targetType: 'LIVE_TRAINING', targetId: TRAINING_ID });
      await route.fulfill({ json: { data: { code: 'QA100', discountPercent: 100, discountAmount: null, originalAmount: 10000, discountedAmount: 0 } } });
    });
    let confirmEnrollment = false;
    await page.route(paidCheckout, async (route) => {
      expect(route.request().postDataJSON()).toEqual({ promoCode: 'QA100', currency: 'usd' });
      if (confirmEnrollment) {
        training.isEnrolled = true;
        await page.route(`**/api${TRAINING_PATH}/ratings`, (ratingRoute) => ratingRoute.fulfill({ json: { data: { ...emptyRatings, canReview: true } } }));
      }
      await route.fulfill({ json: { paymentId: 'test-free-checkout', redirectUrl: null, enrolled: true } });
    });
    await page.goto(`/en${TRAINING_PATH}`);
    const applyPromo = async () => {
      await page.getByRole('textbox', { name: 'Promo code', exact: true }).fill('qa100');
      await page.getByRole('button', { name: 'Apply', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Register & Pay (0.00 ₾)', exact: true })).toBeVisible();
    };
    await applyPromo();
    await page.getByRole('button', { name: 'Remove promo code' }).click();
    await expect(page.getByRole('button', { name: 'Register & Pay (100.00 ₾)', exact: true })).toBeVisible();
    await applyPromo();
    const refreshed = page.waitForResponse((response) => response.url().endsWith(`/api${TRAINING_PATH}`));
    await page.getByRole('button', { name: 'Register & Pay (0.00 ₾)', exact: true }).click();
    await refreshed;
    await expect(page.getByRole('link', { name: 'Go to My Live Trainings' })).toHaveCount(0);
    confirmEnrollment = true;
    await page.getByRole('button', { name: 'Register & Pay (0.00 ₾)', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Go to My Live Trainings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save review', exact: true })).toBeVisible();
  });

  test('checkout redirects to the provided gateway without creating a local enrollment', async ({ page }) => {
    await mockTraining(page);
    await page.route(paidCheckout, (route) => route.fulfill({ json: { paymentId: 'test-payment', redirectUrl: 'https://checkout.invalid/e2e-only' } }));
    await page.route('https://checkout.invalid/e2e-only', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Mock secure checkout</h1>' }));
    await page.goto(`/en${TRAINING_PATH}`);
    await expect(page.getByRole('textbox', { name: 'Promo code', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Register & Pay/ }).click();
    await expect(page).toHaveURL('https://checkout.invalid/e2e-only');
    await expect(page.getByRole('heading', { name: 'Mock secure checkout' })).toBeVisible();
  });

  test('admin can preview and remove both saved video URLs', async ({ page }) => {
    await page.addInitScript(() => {
      const user = JSON.parse(localStorage.getItem('cdc_user') || '{}');
      localStorage.setItem('cdc_user', JSON.stringify({ ...user, adminRole: 'SUPER_ADMIN' }));
    });
    await page.route('**/api/auth/me', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ json: { ...body, user: { ...body.user, adminRole: 'SUPER_ADMIN' } } });
    });
    await page.route('**/api/admin/live-trainings', (route) => route.fulfill({ json: { data: [trainingFixture] } }));
    let savedPayload: Record<string, unknown> | undefined;
    await page.route(`**/api/admin${TRAINING_PATH}`, async (route) => {
      savedPayload = route.request().postDataJSON();
      await route.fulfill({ json: { data: { ...trainingFixture, ...savedPayload } } });
    });
    await page.goto('/admin/live-trainings');
    await page.getByRole('button', { name: 'რედაქტირება', exact: true }).click();
    await expect(page.locator('iframe[title="Training trailer preview"]')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    await expect(page.locator('iframe[title="Trainer video preview"]')).toHaveAttribute('src', 'https://player.vimeo.com/video/76979871?h=abc123def0');
    await page.locator('#training-video-url').fill('');
    await page.locator('#training-trainer-video-url').fill('');
    await page.getByRole('button', { name: 'განახლება', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'ახალი ტრენინგი', exact: true })).toBeVisible();
    expect(savedPayload).toMatchObject({ videoUrl: '', trainerVideoUrl: '' });
    await page.getByRole('button', { name: 'რედაქტირება', exact: true }).click();
    await expect(page.locator('#training-video-url')).toHaveValue('');
    await expect(page.locator('#training-trainer-video-url')).toHaveValue('');
  });
});
