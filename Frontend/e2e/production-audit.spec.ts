import { test, expect, Page } from '@playwright/test';

const user = { id: 'audit-student', name: 'Audit Student', email: 'audit@example.com', role: 'Student', adminRole: null, status: 'APPROVED', isVerifiedGraduate: false, freelancerSkills: [] };
const passport = {
  passportCode: 'CDC-PASS-123456789ABC4DEF8123123456789ABC',
  student: { name: 'Audit Student', role: 'Student', isVerifiedGraduate: true, memberSince: '2026-01-01' },
  stats: { coursesEvaluated: 0, liveTrainingsAttended: 0, certificatesIssued: 0, averageReadiness: 0 },
  skills: [], courseHistory: [], liveTrainingHistory: [], certificates: [],
};

async function mockApi(page: Page, access: boolean, signedIn = true) {
  if (signedIn) await page.addInitScript((u) => {
    localStorage.setItem('cdc_access_token', 'browser-audit-fixture');
    localStorage.setItem('cdc_user', JSON.stringify(u));
  }, user);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = { data: [] };
    if (path.endsWith('/auth/me')) data = { user };
    if (path.endsWith('/workspace-access')) data = { hasDesignStudioAccess: access, hasCodeStudioAccess: access };
    if (path.endsWith('/digital-tools/catalog')) data = { data: ['design-studio', 'code-studio'].map((key) => ({ key, priceMinor: 2900, periodDays: 30 })) };
    if (/digital-tools\/.*\/access/.test(path)) data = { data: { allowed: access, collegeAccess: false, subscriptionEndsAt: null, priceMinor: 2900, periodDays: 30 } };
    if (path.includes('/passport/')) data = passport;
    if (path.includes('site-content')) data = { data: { content: {} } };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
}

for (const studio of ['design', 'code']) {
  test(`${studio} direct URL denies an unsubscribed user without a login loop`, async ({ page }) => {
    await mockApi(page, false);
    await page.goto(`/en/dashboard/tools/${studio}-studio`);
    await expect(page.getByText('GATED WORKSPACE', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Subscribe', exact: true })).toBeVisible();
    expect(page.url()).toContain(`/dashboard/tools/${studio}-studio`);
  });
  test(`${studio} direct URL opens for an entitled user`, async ({ page }) => {
    await mockApi(page, true);
    const response = page.waitForResponse((r) => r.url().endsWith('/api/workspace-access'));
    await page.goto(`/en/dashboard/tools/${studio}-studio`);
    expect((await response).status()).toBe(200);
    await expect(page.getByText('Verifying workspace access...')).toHaveCount(0);
    await expect(page.getByText('GATED WORKSPACE', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: studio === 'design' ? 'Ai Illustrator' : 'SQL Database Lab', exact: true })).toBeVisible();
  });
}

test('anonymous direct workspace URL redirects once with a return URL', async ({ page }) => {
  await mockApi(page, false, false);
  await page.goto('/en/dashboard/tools/code-studio');
  await expect(page).toHaveURL(/auth\/login\?redirect=/);
});

test('dashboard passport loads after auth and opens its public link', async ({ page }) => {
  await mockApi(page, false);
  await page.goto('/en/dashboard/passport');
  await expect(page.getByRole('heading', { name: 'Audit Student', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Public Card' })).toHaveAttribute('href', `/en/passport/${passport.passportCode}`);
});

test('passport public verification works without authentication', async ({ page }) => {
  await mockApi(page, false, false);
  await page.goto(`/en/passport/${passport.passportCode}`);
  await expect(page.getByRole('heading', { name: 'Audit Student', exact: true })).toBeVisible();
  expect(page.url()).toContain('/passport/CDC-PASS-');
});
