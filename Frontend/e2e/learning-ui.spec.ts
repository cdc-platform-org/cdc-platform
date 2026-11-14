import { test, expect } from '@playwright/test';
import courses from './fixtures/learning-courses.json';

// Public UI tests isolate pricing, navigation and layout from live catalog data.
test.use({ storageState: { cookies: [], origins: [] } });
const browserErrors: string[] = [];
test.afterEach(() => expect(browserErrors).toEqual([]));
test.beforeEach(async ({ page }) => {
  browserErrors.length = 0;
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.addInitScript(() => { try { localStorage.setItem('cdc-cookie-consent', JSON.stringify({ essential: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() })); } catch {} });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const course = courses.find(item => path.includes(item.id));
    const data = path.endsWith('/syllabus') ? [{ id: 'section', title: 'Foundations', lessons: [{ id: 'lesson', title: 'First lesson', durationSeconds: 120, isFreePreview: true, embedUrl: courses[0].introVideoUrl }] }] : path.endsWith('/ratings') ? { averageRating: 4.8, reviewCount: 5, reviews: [], canReview: false, myReview: null } : path.endsWith('/courses') ? courses : course ? course : path.includes('/site-content/') ? null : [];
    await route.fulfill({ json: { data } });
  });
});

test('catalog has four desktop columns and device bookmarks stay synchronized', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/en/courses');
  const grid = page.getByTestId('course-grid');
  await expect(grid.locator('[data-course-card]')).toHaveCount(8);
  expect(await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(4);
  const cards = page.locator('[data-course-card="learning-ui-0"]');
  await cards.last().getByRole('button', { name: 'Save Creative design foundations', exact: true }).click();
  for (const card of await cards.all()) await expect(card.getByRole('button', { name: 'Remove Creative design foundations from saved courses', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByTestId('course-grid').locator('[data-course-card="learning-ui-0"] button[aria-pressed]')).toHaveAttribute('aria-pressed', 'true');
});

test('category pills, sorting and advanced filters work together', async ({ page }) => {
  await page.goto('/en/courses');
  await page.getByRole('button', { name: 'Design', exact: true }).click();
  const grid = page.getByTestId('course-grid');
  await expect(grid.locator('[data-course-card]')).toHaveCount(4);
  await page.getByRole('combobox', { name: /sort by/i }).selectOption('price_desc');
  await expect(grid.locator('[data-course-card]').first()).toHaveAttribute('data-course-card', 'learning-ui-6');
  await page.getByRole('button', { name: /filter/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('desktop mega-menu supports keyboard, dismissal and a viewport search dialog', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/en/courses');
  const trigger = page.locator('button[aria-controls="navigation-learn"]');
  await trigger.focus(); await page.keyboard.press('ArrowDown');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#navigation-learn a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await page.locator('nav').first().getByRole('searchbox').click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox(); expect(box!.height).toBeGreaterThan(100);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
});

test('mobile catalog has no overflow and navigation remains usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/courses');
  await expect(page.getByTestId('course-grid')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Toggle menu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Toggle menu', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Toggle menu', exact: true }).click();
  await page.getByRole('button', { name: /filter/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('detail tabs, trailer and dated sale expiry preserve truthful pricing', async ({ page }) => {
  await page.route('**/api/courses/learning-ui-0', route => route.fulfill({ json: { data: { ...courses[0], discountEndDate: new Date(Date.now() + 5000).toISOString() } } }));
  await page.goto('/en/courses/learning-ui-0');
  await expect(page.getByRole('heading', { name: courses[0].title, exact: true })).toBeVisible();
  await expect(page.locator('aside s')).toHaveText('100.00 \u20be');
  await page.getByRole('tab', { name: 'Overview', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Curriculum', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('First lesson')).toBeVisible();
  await page.getByRole('tab', { name: 'Student projects', exact: true }).click();
  await expect(page.getByText('Student projects are not publicly available for this course yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Watch trailer', exact: true }).click();
  await expect(page.locator('#trailer iframe')).toHaveAttribute('src', /autoplay=1/);
  await expect(page.locator('aside s')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('aside').getByText('100.00 \u20be', { exact: true })).toBeVisible();
});

test('Georgian mobile detail and dark mode remain readable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => { try { localStorage.setItem('darkMode', 'true'); } catch {} });
  await page.goto('/courses/learning-ui-0');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.locator('aside').getByRole('button', { name: '\u10e7\u10d8\u10d3\u10d5\u10d0', exact: true })).toBeVisible();
  const aside = await page.locator('aside').boundingBox(), preview = await page.locator('#trailer').boundingBox();
  expect(aside!.y).toBeGreaterThanOrEqual(preview!.y + preview!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const color = await page.locator('.learning-surface').evaluate(element => getComputedStyle(element).backgroundColor);
  expect(color).toBe('rgb(11, 10, 28)');
});


test('homepage uses the shared featured rail and course cards', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/en');
  await expect(page.getByRole('heading', { name: 'Make room for your next big idea.', exact: true })).toBeVisible();
  await expect(page.locator('[data-course-card]').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('direct-file previews expose working play, mute and seek controls', async ({ page, baseURL }) => {
  await page.route('**/api/courses/learning-ui-0', route => route.fulfill({ json: { data: { ...courses[0], introVideoUrl: `${baseURL}/videos/hero.mp4` } } }));
  await page.goto('/en/courses/learning-ui-0');
  await page.getByRole('button', { name: 'Watch trailer', exact: true }).click();
  const preview = page.locator('#trailer');
  const video = preview.locator('video');
  await expect(video).toBeVisible();
  await expect(preview.getByRole('slider', { name: 'Video position', exact: true })).toBeEnabled();
  await preview.getByRole('button', { name: 'Mute', exact: true }).click();
  await expect(preview.getByRole('button', { name: 'Unmute', exact: true })).toBeVisible();
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).muted)).toBe(true);
  await video.evaluate(element => (element as HTMLVideoElement).pause());
  await preview.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(preview.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await preview.getByRole('button', { name: 'Pause', exact: true }).click();
  await preview.getByRole('slider', { name: 'Video position', exact: true }).fill('1');
  await expect.poll(() => video.evaluate(element => Math.floor((element as HTMLVideoElement).currentTime))).toBe(1);
});
