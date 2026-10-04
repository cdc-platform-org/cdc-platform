import { test, expect } from '@playwright/test';
import { AUTH_STATE_PATH } from './global-setup';

test.use({ storageState: AUTH_STATE_PATH });

// Regression guard for the Educator Hub raw-translation-key production bug:
// next-i18next's createConfig() auto-discovers which locale namespace files
// to load per request via fs.readdirSync(public/locales/<locale>/) at SSR
// time — a runtime directory scan Next's `output: 'standalone'` build
// can't trace statically, so most of public/locales/**/*.json silently went
// missing from .next/standalone/public/ in production. t() calls with no
// defaultValue argument then render the raw key instead of real copy. Fixed
// by next.config.mjs's experimental.outputFileTracingIncludes (forces every
// locale JSON into the standalone trace, independent of the Dockerfile's
// own public/ copy step) — this test exists so a regression in either one
// fails CI instead of only showing up after a real deploy.
//
// A representative sample, not every key in educatorHub.json — this is a
// canary for "the whole namespace failed to load," not an exhaustive
// translation audit.
const RAW_KEY_CANDIDATES = [
  'pageTitle',
  'pageSubtitle',
  'vipRequiredTitle',
  'vipRequiredDesc',
  'testSubjectPlaceholder',
  'testSourceUploadLabel',
  'testGenerateButton',
  'certificatesTitle',
];

function assertNoRawKeys(bodyText: string) {
  for (const key of RAW_KEY_CANDIDATES) {
    expect(bodyText, `raw i18n key "${key}" is visible in the rendered page`).not.toMatch(
      new RegExp(`\\b${key}\\b`)
    );
  }
}

test('Educator Hub (ka) renders real copy, not raw i18n keys, on direct load and after refresh', async ({ page }) => {
  await page.goto('/dashboard/tools/educator-hub');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 });
  assertNoRawKeys(await page.locator('body').innerText());

  // Simulates a hard refresh: a brand-new SSR request for this exact route,
  // not a client-side transition — the only way to catch the standalone
  // build's missing-locale-file failure mode, which a SPA navigation never
  // exercises (see the file-level comment above).
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 });
  assertNoRawKeys(await page.locator('body').innerText());
});

test('Educator Hub (en) renders real English copy, not raw i18n keys or Georgian fallback text, on direct load', async ({ page }) => {
  await page.goto('/en/dashboard/tools/educator-hub');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 });
  const text = await page.locator('body').innerText();
  assertNoRawKeys(text);
  // A hardcoded Georgian defaultValue (e.g. t('testSubjectLabel', 'საგანი'))
  // masks the exact same missing-namespace failure as a raw key would — it
  // just happens to look like real content because ka is the default
  // locale. Asserting the real English string is present (not just "no
  // Georgian/no raw key") is what actually distinguishes "translated" from
  // "silently fell back."
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('AI Educator VIP Hub');
});

test('Educator Hub (de) renders real German copy on direct load — spot-checks a third locale beyond ka/en', async ({ page }) => {
  await page.goto('/de/dashboard/tools/educator-hub');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 });
  assertNoRawKeys(await page.locator('body').innerText());
});

test('every Educator Hub tab (including Certificates) is free of raw i18n keys after a hard refresh', async ({ page }) => {
  await page.goto('/dashboard/tools/educator-hub');
  await page.reload({ waitUntil: 'networkidle' });
  const tabButtons = page.locator('.flex.flex-wrap.gap-2.mb-6.no-print button');
  const count = await tabButtons.count();
  expect(count).toBeGreaterThanOrEqual(8); // Tests, Rubric, Grading, SEN, Lesson Plan, Bureaucracy, Parent Reports, Certificates
  for (let i = 0; i < count; i++) {
    await tabButtons.nth(i).click();
    const text = await page.locator('body').innerText();
    assertNoRawKeys(text);
    expect(text, 'tab content must not expose a raw camelCase i18n key').not.toMatch(
      /\b[a-z][a-zA-Z]*(Label|Placeholder|Button|Heading)\b/
    );
  }
});
