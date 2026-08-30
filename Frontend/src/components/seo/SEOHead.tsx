import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  DEFAULT_LOCALE,
  DEFAULT_OG_IMAGE,
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
  /** Root-relative or absolute image URL. Defaults to the platform logo —
   *  swap in a real 1200x630 banner per page once one exists. */
  ogImage?: string;
  ogType?: OgType;
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
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
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
  const absoluteOgImage = absoluteAsset(ogImage);
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
      <meta property="og:locale" content={ogLocale} />
      {!noIndex &&
        locales
          .filter((l) => l !== locale)
          .map((l) => <meta key={l} property="og:locale:alternate" content={OG_LOCALE_MAP[l] ?? l} />)}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteOgImage} />

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
