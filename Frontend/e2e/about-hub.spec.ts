import { test, expect } from '@playwright/test';
import seed from '../src/data/aboutHubSeed.json';
import courses from './fixtures/learning-courses.json';
import { ABOUT_COPY, ABOUT_PATHS } from '../src/data/aboutHubCopy';
import type { AboutSection } from '../src/types/aboutHub';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cdc-cookie-consent', JSON.stringify({ essential: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }));
  });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: { data: path.endsWith('/site-content/about') ? { page: 'about', content: seed, updatedAt: '2026-11-15T10:00:00Z' } : [] } });
  });
});

for (const lang of ['ka', 'en'] as const) {
  for (const [section, path] of Object.entries(ABOUT_PATHS) as Array<[AboutSection, string]>) {
    test(`${lang} ${path} supports both themes without horizontal overflow`, async ({ page }, testInfo) => {
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(`${lang === 'en' ? '/en' : ''}${path}`);
      expect(response?.status()).toBe(200);
      const main = page.locator('#about-main');
      const title = section === 'overview' ? seed.overview.title[lang].replace(/\n/g, ' ') : ABOUT_COPY[lang].titles[section];
      await expect(main.getByRole('heading', { level: 1 })).toHaveText(title, { useInnerText: false });
      await expect(main.getByText(ABOUT_COPY[lang].demoNotice, { exact: true })).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: ABOUT_COPY[lang].loading })).toHaveCount(0);
      for (const dark of [false, true]) {
        await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
        const surface = page.locator('[data-about-hub]');
        await expect(surface).toHaveCSS('background-color', dark ? 'rgb(11, 10, 28)' : 'rgb(250, 250, 250)');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const broken = await main.locator('img').evaluateAll(images => images.filter(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth === 0).length);
        expect(broken).toBe(0);
        await page.screenshot({ path: testInfo.outputPath(`${section}-${lang}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      }
      expect(errors).toEqual([]);
    });
  }
}

test('gallery categories and the localized keyboard lightbox work together', async ({ page }) => {
  await page.goto('/about/gallery');
  await page.getByRole('button', { name: 'ვორქშოფები', exact: true }).click();
  await expect(page.locator('[data-about-card]')).toHaveCount(1);
  await page.getByRole('button', { name: /^ფოტოს გადახედვა:/ }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'დახურვა', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'გადიდება', exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'დახურვა', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^ფოტოს გადახედვა:/ })).toBeFocused();
});

test('empty CMS collections and failed refresh have useful localized states', async ({ page }) => {
  await page.route('**/api/site-content/about', route => route.fulfill({ json: { data: { page: 'about', content: { ...seed, projects: [] } } } }));
  await page.goto('/en/about/projects');
  await expect(page.getByRole('heading', { name: ABOUT_COPY.en.empty, exact: true })).toBeVisible();
  await page.route('**/api/site-content/about', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
  await page.reload();
  await expect(page.getByText(ABOUT_COPY.en.error, { exact: true })).toBeVisible();
  await expect(page.locator('[data-about-card]')).toHaveCount(3);
});

test('about navigation exposes the five destinations on desktop and mobile', async ({ page }, testInfo) => {
  await page.goto('/en/about');
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Toggle menu', exact: true }).click();
  const header = page.locator('nav').first();
  const trigger = header.getByRole('button', { name: 'About', exact: true });
  if (await trigger.isVisible()) await trigger.click();
  for (const path of Object.values(ABOUT_PATHS)) {
    await expect(header.locator(`a[href="/en${path}"]`).first()).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('project categories and chronological sorting use the published timeline', async ({ page }) => {
  await page.goto('/en/about/projects');
  await page.getByRole('combobox').selectOption('oldest');
  await expect(page.locator('[data-about-card]').first().getByRole('heading')).toHaveText('Digital skills for the regions');
  await page.getByRole('button', { name: 'Grants', exact: true }).click();
  await expect(page.locator('[data-about-card]')).toHaveCount(1);
  await expect(page.locator('[data-about-card]').getByText('Institutional supporter', { exact: false })).toBeVisible();
});

test('CMS edits, image uploads and removals persist and appear on the public page', async ({ page }) => {
  const user = { id: 'about-editor', name: 'CDC Editor', email: 'editor@cdc.test', role: 'Client', status: 'APPROVED', adminRole: 'MANAGER', termsAcceptedAt: '2026-01-01T00:00:00Z' };
  await page.addInitScript(user => {
    localStorage.setItem('cdc_access_token', 'fixture-token'); localStorage.setItem('cdc_user', JSON.stringify(user)); localStorage.setItem('cdc_admin_lang', 'en');
  }, user);
  let content = structuredClone(seed);
  let uploads = 0;
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user } }));
  await page.route('**/api/admin/cms/about', async route => {
    if (route.request().method() === 'PUT') content = route.request().postDataJSON().content;
    await route.fulfill({ json: { data: { page: 'about', content } } });
  });
  await page.route('**/api/site-content/about', route => route.fulfill({ json: { data: { page: 'about', content } } }));
  await page.route('**/api/blog/upload-image', async route => {
    expect(route.request().headers()['content-type']).toContain('multipart/form-data'); uploads += 1;
    await route.fulfill({ json: { url: '/images/about/community.jpg' } });
  });
  await page.goto('/en/admin/cms/about');
  await page.getByRole('button', { name: 'Gallery', exact: true }).click();
  const first = page.locator('[data-about-editor-entry]').first();
  await first.locator('fieldset').first().getByLabel('English · EN').fill('Reviewed UX/UI workshop');
  await first.getByLabel('Upload image', { exact: true }).setInputFiles('public/images/about/community.jpg');
  await expect(first.getByLabel('Photo or logo URL', { exact: true })).toHaveValue('/images/about/community.jpg');
  await page.getByRole('button', { name: 'Save and publish', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Changes published' })).toBeVisible();
  expect(uploads).toBe(1);
  await page.goto('/en/about/gallery');
  await expect(page.getByRole('heading', { name: 'Reviewed UX/UI workshop', exact: true })).toBeVisible();
  await page.goto('/en/admin/cms/about');
  await page.getByRole('button', { name: 'Gallery', exact: true }).click();
  await expect(page.locator('[data-about-editor-entry]')).toHaveCount(6);
  await page.locator('[data-about-editor-entry]').first().getByRole('button', { name: 'Remove', exact: true }).click();
  await page.getByRole('button', { name: 'Save and publish', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Changes published' })).toBeVisible();
  await page.goto('/en/about/gallery');
  await expect(page.locator('[data-about-card]')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: 'Reviewed UX/UI workshop', exact: true })).toHaveCount(0);
});

test('the integrated homepage preserves the photo slideshow and featured course rail', async ({ page }) => {
  await page.route('**/api/courses**', route => route.fulfill({ json: { data: courses } }));
  await page.goto('/en');
  await expect(page.getByRole('img', { name: 'CDC — students and trainings', exact: true })).toBeVisible();
  await expect(page.locator('picture img[src="/images/hero/cdc-hero-01.webp"]')).toBeVisible();
  await expect(page.locator('[data-course-card]').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
