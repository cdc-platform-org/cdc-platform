import { test, expect } from '@playwright/test';
import courses from './fixtures/learning-courses.json';
import about from '../src/data/aboutHubSeed.json';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cdc-cookie-consent', JSON.stringify({ essential: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() })));
  await page.route('**/api/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/courses') ? courses : pathname.endsWith('/site-content/about') ? { page: 'about', content: about } : pathname.includes('/site-content/') ? null : [];
    return route.fulfill({ json: { data } });
  });
});

for (const locale of ['ka', 'en']) {
  for (const dark of [false, true]) {
    test(`${locale} ${dark ? 'dark' : 'light'} hero keeps actions visible and uses a balanced layout`, async ({ page }, info) => {
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(dark => localStorage.setItem('darkMode', String(dark)), dark);
      await page.goto(locale === 'en' ? '/en' : '/');
      const hero = page.locator('[data-home-hero]');
      await expect(page.locator('.learning-surface').first()).toHaveCSS('background-color', dark ? 'rgb(19, 21, 24)' : 'rgb(247, 246, 242)');
      await expect(hero.locator('[data-course-card]').first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const metrics = await hero.evaluate(element => {
        const heading = element.querySelector('h1')!;
        const primary = element.querySelector('a[href="#courses"]')!;
        const figure = element.querySelector('figure')!;
        return {
          headingHeight: heading.getBoundingClientRect().height,
          lineRatio: parseFloat(getComputedStyle(heading).lineHeight) / parseFloat(getComputedStyle(heading).fontSize),
          ctaBottom: primary.getBoundingClientRect().bottom,
          headingRight: heading.getBoundingClientRect().right,
          imageX: figure.getBoundingClientRect().x,
          betaHeight: document.querySelector('[data-beta-banner]')?.getBoundingClientRect().height ?? 0,
          primaryColor: getComputedStyle(primary).color,
          primaryBackground: getComputedStyle(primary).backgroundColor,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(metrics.headingHeight).toBeLessThan(185);
      expect(metrics.lineRatio).toBeGreaterThanOrEqual(1.2);
      expect(metrics.lineRatio).toBeLessThan(1.4);
      expect(metrics.ctaBottom).toBeLessThan(700);
      expect(metrics.betaHeight).toBeLessThanOrEqual(40);
      expect(metrics.overflow).toBe(false);
      if ((page.viewportSize()?.width ?? 0) >= 840) expect(metrics.imageX).toBeGreaterThan(metrics.headingRight);
      expect(metrics.primaryBackground).toBe(dark ? 'rgb(240, 241, 238)' : 'rgb(31, 33, 36)');
      expect(metrics.primaryColor).toBe(dark ? 'rgb(27, 30, 33)' : 'rgb(255, 255, 255)');
      await page.screenshot({ path: info.outputPath(`homepage-${locale}-${dark ? 'dark' : 'light'}.png`) });
      expect(errors).toEqual([]);
    });
  }
}

test('existing CMS overrides and course and gallery destinations are preserved', async ({ page }) => {
  await page.route('**/api/site-content/homepage', route => route.fulfill({ json: { data: { page: 'homepage', content: { heroTitleKa: 'სარედაქციო სათაური', heroTitleEn: 'A CMS headline', heroSubtitleKa: 'ცენტრის აღწერა', heroSubtitleEn: 'An editorial introduction' } } } }));
  await page.goto('/en');
  await expect(page.getByRole('heading', { name: 'A CMS headline', exact: true })).toBeVisible();
  await expect(page.getByText('An editorial introduction', { exact: true })).toBeVisible();
  const hero = page.locator('[data-home-hero]');
  await expect(hero.locator('a[href="#courses"]')).toBeVisible();
  await expect(hero.locator('a[href="/en/auth/register"]')).toBeVisible();
  await hero.locator('a[href="/en/about/gallery"]').click();
  await expect(page.locator('[data-about-hub="gallery"]')).toBeVisible();
});

test('theme switching persists on navigation and narrow phones keep the CTA inside the page', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/en');
  await page.getByRole('button', { name: 'Toggle dark mode', exact: true }).click();
  await expect(page.locator('.learning-surface').first()).toHaveCSS('background-color', 'rgb(19, 21, 24)');
  const primary = await page.locator('[data-home-hero] a[href="#courses"]').boundingBox();
  expect(primary!.x).toBeGreaterThanOrEqual(0);
  expect(primary!.x + primary!.width).toBeLessThanOrEqual(320);
  await page.locator('[data-home-hero] a[href="/en/about/gallery"]').click();
  await expect(page.locator('[data-about-hub]')).toHaveCSS('background-color', 'rgb(19, 21, 24)');
  expect(await page.evaluate(() => localStorage.getItem('darkMode'))).toBe('true');
});
