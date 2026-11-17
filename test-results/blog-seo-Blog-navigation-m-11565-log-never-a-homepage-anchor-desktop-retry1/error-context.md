# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: blog-seo.spec.ts >> Blog navigation >> main nav "Blog" links go directly to /blog, never a homepage anchor
- Location: e2e/blog-seo.spec.ts:19:7

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 2
Received:    1
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | // Fixed slugs from Backend/prisma/seedE2E.ts — see that file's own comment
  4   | // on why these three specific cases (real cover, a DIFFERENT real cover, no
  5   | // cover at all) are what's seeded.
  6   | const WITH_COVER_SLUG = 'qa-e2e-post-with-cover';
  7   | const WITH_OTHER_COVER_SLUG = 'qa-e2e-post-with-other-cover';
  8   | const NO_COVER_SLUG = 'qa-e2e-post-no-cover';
  9   | 
  10  | // Pulls a <meta ...> tag's content out of raw HTML by its property/name
  11  | // attribute — deliberately not a DOM query (see the describe block's own
  12  | // comment on why these tests fetch raw HTML instead of a rendered page).
  13  | function metaContent(html: string, attr: 'property' | 'name', key: string): string | null {
  14  |   const tag = html.match(new RegExp(`<meta[^>]*${attr}=["']${key}["'][^>]*>`, 'i'))?.[0];
  15  |   return tag?.match(/content=["']([^"']*)["']/)?.[1] ?? null;
  16  | }
  17  | 
  18  | test.describe('Blog navigation', () => {
  19  |   test('main nav "Blog" links go directly to /blog, never a homepage anchor', async ({ page }) => {
  20  |     // Raw HTML, not a click-through: proves the actual href in the
  21  |     // server-rendered markup, independent of how a browser resolves it.
  22  |     const html = await (await page.request.get('/')).text();
  23  |     expect(html).not.toMatch(/href="\/?#blog"/);
  24  |     // The wide-viewport nav link and the blog-preview section's own "All
  25  |     // Articles" link are both always in the initial HTML — see
  26  |     // pages/index.tsx. The collapsed-menu (<1420px) duplicate is only
  27  |     // mounted once opened (isMobileMenuOpen), so it's intentionally not
  28  |     // part of this count; the dedicated tests below open it directly.
> 29  |     expect((html.match(/href="\/blog"/g) ?? []).length).toBeGreaterThanOrEqual(2);
      |                                                         ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  30  |   });
  31  | 
  32  |   test('the wide-viewport nav "Blog" link (>=1420px) lands on /blog', async ({ page }) => {
  33  |     await page.setViewportSize({ width: 1440, height: 900 });
  34  |     await page.goto('/en');
  35  |     await page.getByRole('link', { name: /^Blog$/i }).first().click();
  36  |     await expect(page).toHaveURL(/\/blog$/);
  37  |   });
  38  | 
  39  |   test('the collapsed-menu "Blog" link (<1420px) lands on /blog', async ({ page }) => {
  40  |     await page.setViewportSize({ width: 1280, height: 900 });
  41  |     await page.goto('/en');
  42  |     await page.getByRole('button', { name: 'Toggle menu' }).click();
  43  |     await page.getByRole('link', { name: /^Blog$/i }).click();
  44  |     await expect(page).toHaveURL(/\/blog$/);
  45  |   });
  46  | });
  47  | 
  48  | // These fetch raw HTML via page.request (no browser JS execution at all) —
  49  | // the same thing a Facebook/LinkedIn/Twitter crawler sees. A test that only
  50  | // checked the rendered DOM after hydration could pass even if the
  51  | // server-rendered HTML itself were missing every og:/twitter: tag, which is
  52  | // exactly the bug this suite exists to catch (see pages/blog/[slug].tsx's
  53  | // getServerSideProps).
  54  | test.describe('Blog article social-share metadata (server-rendered)', () => {
  55  |   test('each article gets its own real, absolute, distinct og:image; no cover falls back to the platform default', async ({ page }) => {
  56  |     const [htmlA, htmlB, htmlC] = await Promise.all(
  57  |       [WITH_COVER_SLUG, WITH_OTHER_COVER_SLUG, NO_COVER_SLUG].map((slug) => page.request.get(`/blog/${slug}`).then((r) => r.text()))
  58  |     );
  59  | 
  60  |     const imageA = metaContent(htmlA, 'property', 'og:image');
  61  |     const imageB = metaContent(htmlB, 'property', 'og:image');
  62  |     const imageC = metaContent(htmlC, 'property', 'og:image');
  63  | 
  64  |     expect(imageA).toMatch(/^https?:\/\//);
  65  |     expect(imageA).toContain('heks-eper.jpg');
  66  |     expect(imageB).toMatch(/^https?:\/\//);
  67  |     expect(imageB).toContain('cdc-logo.png');
  68  |     expect(imageA).not.toBe(imageB); // two different articles must never share one og:image.
  69  | 
  70  |     // No cover at all -> the real branded default banner (og-default.jpg),
  71  |     // never the old stretched-logo fallback, and never mistaken for either
  72  |     // real article cover above.
  73  |     expect(imageC).toMatch(/^https?:\/\//);
  74  |     expect(imageC).toContain('og-default.jpg');
  75  |     expect(imageC).not.toBe(imageA);
  76  |     expect(imageC).not.toBe(imageB);
  77  |     // The default banner's real, known pixel size — never guessed for a
  78  |     // per-article cover (see SEOHead.tsx's own comment on why).
  79  |     expect(metaContent(htmlC, 'property', 'og:image:width')).toBe('1200');
  80  |     expect(metaContent(htmlC, 'property', 'og:image:height')).toBe('630');
  81  |     expect(metaContent(htmlA, 'property', 'og:image:width')).toBeNull();
  82  | 
  83  |     for (const html of [htmlA, htmlB, htmlC]) {
  84  |       expect(metaContent(html, 'name', 'twitter:card')).toBe('summary_large_image');
  85  |       expect(metaContent(html, 'property', 'og:type')).toBe('article');
  86  |       const ogUrl = metaContent(html, 'property', 'og:url');
  87  |       expect(ogUrl).toMatch(/^https:\/\//); // absolute production-style origin, not a relative path.
  88  |       const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  89  |       expect(canonical).toBe(ogUrl);
  90  |     }
  91  |   });
  92  | 
  93  |   test('Georgian title/description render correctly in the default-locale metadata', async ({ page }) => {
  94  |     const html = await (await page.request.get(`/blog/${WITH_COVER_SLUG}`)).text();
  95  |     expect(metaContent(html, 'property', 'og:title')).toContain('ყდით');
  96  |     expect(metaContent(html, 'name', 'description')).toContain('სატესტო');
  97  |   });
  98  | 
  99  |   test('the English locale renders the English title/description instead', async ({ page }) => {
  100 |     const html = await (await page.request.get(`/en/blog/${WITH_COVER_SLUG}`)).text();
  101 |     expect(metaContent(html, 'property', 'og:title')).toContain('With Cover');
  102 |     expect(metaContent(html, 'name', 'description')).toContain('seeded article description');
  103 |   });
  104 | 
  105 |   test('social share buttons target the article\'s own URL, not the homepage', async ({ page }) => {
  106 |     await page.goto(`/en/blog/${WITH_COVER_SLUG}`);
  107 |     const facebookShare = page.locator(`a[href*="facebook.com/sharer"]`);
  108 |     await expect(facebookShare).toHaveAttribute('href', new RegExp(`blog%2F${WITH_COVER_SLUG}`));
  109 |   });
  110 | });
  111 | 
```