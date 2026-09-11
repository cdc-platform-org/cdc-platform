import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  DEFAULT_LOCALE,
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_WIDTH,
  DEFAULT_TITLE,
  OG_LOCALE_MAP,
  SITE_LOCALES,
  SITE_NAME,
  absoluteAsset,
  localizedUrl,
} from '@/src/utils/seo';

export type OgType = 'website' | 'article' | 'product';

export interface SEOHeadProps {
  /** Page-specific title, WITHOUT the site suffix — this component appends
   *  " | CDC Platform" itself. Falls back to DEFAULT_TITLE (which already
   *  reads as a complete title) when omitted. */
  title?: string;
  description: string;
  /** Root-relative path for this route, e.g. "/tools" — canonical + all 9
   *  hreflang alternates + x-default are derived from this plus each
   *  locale's own URL shape (see localizedUrl in utils/seo.ts). Defaults to
   *  the current router path when omitted, which is correct for most
   *  pages; pass it explicitly on dynamic routes if router.asPath ever
   *  includes something that shouldn't be canonicalized as-is. */
  canonicalPath?: string;
  /** Root-relative or absolute image URL. Defaults to DEFAULT_OG_IMAGE (a
   *  real 1200x630 branded banner) when omitted. Pass the page/article's own
   *  cover as-is — never stretched/cropped here — since its real dimensions
   *  are usually unknown; width/height below are only declared for the
   *  platform default, whose dimensions are known exactly. */
  ogImage?: string;
  /** Only meaningful together — omit both unless you actually know the
   *  image's real pixel dimensions (e.g. a source generated at a fixed
   *  size). Never guess: a wrong declared size is worse than none, since
   *  crawlers trust it instead of measuring the file themselves. */
  ogImageWidth?: number;
  ogImageHeight?: number;
  /** Alt text for the shared image. Defaults to the resolved page title. */
  ogImageAlt?: string;
  ogType?: OgType;
  /** ISO 8601 timestamp (e.g. a blog post's createdAt) — rendered as
   *  article:published_time. Only meaningful when ogType="article"; ignored
   *  otherwise since Facebook's article schema doesn't apply to a
   *  website/product og:type. */
  articlePublishedTime?: string;
  /** Set true for any page that isn't meant to be publicly indexed (e.g.
   *  anything behind ProtectedRoute) — emits <meta name="robots"
   *  content="noindex, nofollow"> and skips hreflang/OG entirely, since
   *  neither makes sense for a page search engines shouldn't crawl. */
  noIndex?: boolean;
  /** One or more JSON-LD objects (Organization, WebSite, SoftwareApplication,
   *  etc.) — each rendered as its own <script type="application/ld+json">. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

// JSON-LD is site-authored data (never raw user input), but this still
// escapes "</script" defensively so a stray literal string inside a
// description can never break out of the script tag.
function serializeJsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export default function SEOHead({
  title,
  description,
  canonicalPath,
  ogImage,
  ogImageWidth,
  ogImageHeight,
  ogImageAlt,
  ogType = 'website',
  articlePublishedTime,
  noIndex = false,
  jsonLd,
}: SEOHeadProps) {
  const router = useRouter();
  const locale = router.locale ?? DEFAULT_LOCALE;
  const locales = (router.locales as string[] | undefined) ?? [...SITE_LOCALES];
  const path = canonicalPath ?? router.asPath.split('?')[0].split('#')[0];

  const pageTitle = title || DEFAULT_TITLE;
  const documentTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const canonicalUrl = localizedUrl(locale, path);
  const absoluteOgImage = absoluteAsset(ogImage ?? DEFAULT_OG_IMAGE);
  // Only the platform default's dimensions are actually known — a caller's
  // own image (a blog cover, a course thumbnail, ...) never gets a
  // fabricated width/height unless it explicitly passes one.
  const resolvedImageWidth = ogImageWidth ?? (ogImage ? undefined : DEFAULT_OG_IMAGE_WIDTH);
  const resolvedImageHeight = ogImageHeight ?? (ogImage ? undefined : DEFAULT_OG_IMAGE_HEIGHT);
  const resolvedImageAlt = ogImageAlt ?? pageTitle;
  const ogLocale = OG_LOCALE_MAP[locale] ?? OG_LOCALE_MAP[DEFAULT_LOCALE];
  const jsonLdList = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Head>
      <title>{documentTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noIndex ? 'noindex, nofollow' : 'index, follow'} />

      {/* A gated/private page (noIndex) gets only a self-canonical — no
          hreflang set, since search engines shouldn't be pointed at it from
          any locale. Kept as flat, directly-under-<Head> expressions rather
          than a nested <>...</> Fragment: Next's Head child-flattening
          (onlyReactElement in next/dist/shared/lib/head.js) silently drops
          all but the first element of a .map() array when it's nested two
          levels deep inside a Fragment inside a ternary — verified against
          the actual built output, not just in theory — so every array of
          repeated tags below is a direct Head child instead. */}
      <link rel="canonical" href={canonicalUrl} />
      {!noIndex &&
        locales.map((l) => <link key={`hreflang-${l}`} rel="alternate" hrefLang={l} href={localizedUrl(l, path)} />)}
      {!noIndex && <link rel="alternate" hrefLang="x-default" href={localizedUrl(DEFAULT_LOCALE, path)} />}

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={absoluteOgImage} />
      <meta property="og:image:alt" content={resolvedImageAlt} />
      {resolvedImageWidth != null && <meta property="og:image:width" content={String(resolvedImageWidth)} />}
      {resolvedImageHeight != null && <meta property="og:image:height" content={String(resolvedImageHeight)} />}
      <meta property="og:locale" content={ogLocale} />
      {!noIndex &&
        locales
          .filter((l) => l !== locale)
          .map((l) => <meta key={l} property="og:locale:alternate" content={OG_LOCALE_MAP[l] ?? l} />)}
      {ogType === 'article' && articlePublishedTime && (
        <meta property="article:published_time" content={articlePublishedTime} />
      )}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteOgImage} />
      <meta name="twitter:image:alt" content={resolvedImageAlt} />

      {jsonLdList.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      ))}
    </Head>
  );
}
