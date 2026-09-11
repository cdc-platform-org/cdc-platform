import { test, expect } from '@playwright/test';

// Fixed slugs from Backend/prisma/seedE2E.ts — see that file's own comment
// on why these three specific cases (real cover, a DIFFERENT real cover, no
// cover at all) are what's seeded.
const WITH_COVER_SLUG = 'qa-e2e-post-with-cover';
const WITH_OTHER_COVER_SLUG = 'qa-e2e-post-with-other-cover';
const NO_COVER_SLUG = 'qa-e2e-post-no-cover';

// Pulls a <meta ...> tag's content out of raw HTML by its property/name
// attribute — deliberately not a DOM query (see the describe block's own
// comment on why these tests fetch raw HTML instead of a rendered page).
function metaContent(html: string, attr: 'property' | 'name', key: string): string | null {
  const tag = html.match(new RegExp(`<meta[^>]*${attr}=["']${key}["'][^>]*>`, 'i'))?.[0];
  return tag?.match(/content=["']([^"']*)["']/)?.[1] ?? null;
}

test.describe('Blog navigation', () => {
  test('main nav "Blog" links go directly to /blog, never a homepage anchor', async ({ page }) => {
    // Raw HTML, not a click-through: proves the actual href in the
    // server-rendered markup, independent of how a browser resolves it.
    const html = await (await page.request.get('/')).text();
    expect(html).not.toMatch(/href="\/?#blog"/);
    // The wide-viewport nav link and the blog-preview section's own "All
    // Articles" link are both always in the initial HTML — see
    // pages/index.tsx. The collapsed-menu (<1420px) duplicate is only
    // mounted once opened (isMobileMenuOpen), so it's intentionally not
    // part of this count; the dedicated tests below open it directly.
    expect((html.match(/href="\/blog"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  test('the wide-viewport nav "Blog" link (>=1420px) lands on /blog', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en');
    await page.getByRole('link', { name: /^Blog$/i }).first().click();
    await expect(page).toHaveURL(/\/blog$/);
  });

  test('the collapsed-menu "Blog" link (<1420px) lands on /blog', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/en');
    await page.getByRole('button', { name: 'Toggle menu' }).click();
    await page.getByRole('link', { name: /^Blog$/i }).click();
    await expect(page).toHaveURL(/\/blog$/);
  });
});

// These fetch raw HTML via page.request (no browser JS execution at all) —
// the same thing a Facebook/LinkedIn/Twitter crawler sees. A test that only
// checked the rendered DOM after hydration could pass even if the
// server-rendered HTML itself were missing every og:/twitter: tag, which is
// exactly the bug this suite exists to catch (see pages/blog/[slug].tsx's
// getServerSideProps).
test.describe('Blog article social-share metadata (server-rendered)', () => {
  test('each article gets its own real, absolute, distinct og:image; no cover falls back to the platform default', async ({ page }) => {
    const [htmlA, htmlB, htmlC] = await Promise.all(
      [WITH_COVER_SLUG, WITH_OTHER_COVER_SLUG, NO_COVER_SLUG].map((slug) => page.request.get(`/blog/${slug}`).then((r) => r.text()))
    );

    const imageA = metaContent(htmlA, 'property', 'og:image');
    const imageB = metaContent(htmlB, 'property', 'og:image');
    const imageC = metaContent(htmlC, 'property', 'og:image');

    expect(imageA).toMatch(/^https?:\/\//);
    expect(imageA).toContain('heks-eper.jpg');
    expect(imageB).toMatch(/^https?:\/\//);
    expect(imageB).toContain('cdc-logo.png');
    expect(imageA).not.toBe(imageB); // two different articles must never share one og:image.

    // No cover at all -> the real branded default banner (og-default.jpg),
    // never the old stretched-logo fallback, and never mistaken for either
    // real article cover above.
    expect(imageC).toMatch(/^https?:\/\//);
    expect(imageC).toContain('og-default.jpg');
    expect(imageC).not.toBe(imageA);
    expect(imageC).not.toBe(imageB);
    // The default banner's real, known pixel size — never guessed for a
    // per-article cover (see SEOHead.tsx's own comment on why).
    expect(metaContent(htmlC, 'property', 'og:image:width')).toBe('1200');
    expect(metaContent(htmlC, 'property', 'og:image:height')).toBe('630');
    expect(metaContent(htmlA, 'property', 'og:image:width')).toBeNull();

    for (const html of [htmlA, htmlB, htmlC]) {
      expect(metaContent(html, 'name', 'twitter:card')).toBe('summary_large_image');
      expect(metaContent(html, 'property', 'og:type')).toBe('article');
      const ogUrl = metaContent(html, 'property', 'og:url');
      expect(ogUrl).toMatch(/^https:\/\//); // absolute production-style origin, not a relative path.
      const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
      expect(canonical).toBe(ogUrl);
    }
  });

  test('Georgian title/description render correctly in the default-locale metadata', async ({ page }) => {
    const html = await (await page.request.get(`/blog/${WITH_COVER_SLUG}`)).text();
    expect(metaContent(html, 'property', 'og:title')).toContain('ყდით');
    expect(metaContent(html, 'name', 'description')).toContain('სატესტო');
  });

  test('the English locale renders the English title/description instead', async ({ page }) => {
    const html = await (await page.request.get(`/en/blog/${WITH_COVER_SLUG}`)).text();
    expect(metaContent(html, 'property', 'og:title')).toContain('With Cover');
    expect(metaContent(html, 'name', 'description')).toContain('seeded article description');
  });

  test('social share buttons target the article\'s own URL, not the homepage', async ({ page }) => {
    await page.goto(`/en/blog/${WITH_COVER_SLUG}`);
    const facebookShare = page.locator(`a[href*="facebook.com/sharer"]`);
    await expect(facebookShare).toHaveAttribute('href', new RegExp(`blog%2F${WITH_COVER_SLUG}`));
  });
});
