// Shared SEO constants/helpers used by SEOHead.tsx, pages/sitemap.xml.ts, and
// any page injecting its own JSON-LD. Kept separate from utils/locale.ts
// (which owns the UI-string locale-resolution rules) since this file is
// purely about URLs/meta — no dictionary lookups here.

// No NEXT_PUBLIC_SITE_URL is set in any .env today (see .env.example) — the
// production origin is hardcoded as the fallback so canonical/hreflang URLs
// are always correct even before that var exists in a deploy environment.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://cdc.org.ge').replace(/\/+$/, '');

export const SITE_NAME = 'CDC Platform';
export const DEFAULT_TITLE = 'CDC — Digital Tools & AI Platform';
// No dedicated 1200x630 OG banner exists in public/ yet — falls back to the
// real logo asset rather than a fabricated path. Swap this for a real
// banner once one is designed.
export const DEFAULT_OG_IMAGE = '/images/cdc-logo.png';

export const DEFAULT_LOCALE = 'ka';
// Mirrors next-i18next.config.js's `locales` exactly — same duplication
// pattern (and reasoning) as SITE_LOCALES in src/utils/locale.ts.
export const SITE_LOCALES = ['ka', 'en', 'de', 'es', 'fr', 'uk', 'tr', 'hy', 'az'] as const;

// schema.org/Open Graph want full BCP-47-ish locale tags, not bare language
// codes — one real-country guess per language (this platform has no
// per-country content split, so any reasonable choice is fine here).
export const OG_LOCALE_MAP: Record<string, string> = {
  ka: 'ka_GE',
  en: 'en_US',
  de: 'de_DE',
  es: 'es_ES',
  fr: 'fr_FR',
  uk: 'uk_UA',
  tr: 'tr_TR',
  hy: 'hy_AM',
  az: 'az_AZ',
};

// Next's built-in i18n routing (see next.config.mjs) serves the default
// locale unprefixed and every other locale under /<locale>/... — this
// mirrors that exactly so canonical/hreflang URLs never 404.
export function localizedUrl(locale: string, path: string): string {
  const cleanPath = path === '/' ? '' : path;
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  return `${SITE_URL}${prefix}${cleanPath}`;
}

export function absoluteAsset(src: string): string {
  if (/^https?:\/\//.test(src)) return src;
  return `${SITE_URL}${src.startsWith('/') ? '' : '/'}${src}`;
}

// Real, verified brand accounts (see SiteFooter.tsx) — never fabricate a
// sameAs entry that isn't an actual linked profile.
export const ORGANIZATION_SAME_AS = [
  'https://www.facebook.com/cdc.digitalcareers',
  'https://www.instagram.com/digitalcareers1/',
  'https://www.linkedin.com/in/cdc-%E1%83%AA%E1%83%98%E1%83%A4%E1%83%A0%E1%83%A3%E1%83%9A%E1%83%98-%E1%83%9E%E1%83%A0%E1%83%9D%E1%83%A4%E1%83%94%E1%83%A1%E1%83%98%E1%83%91%E1%83%98%E1%83%A1-%E1%83%AA%E1%83%94%E1%83%9C%E1%83%A2%E1%83%A0%E1%83%98-473404428/',
];

export const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'CDC',
  alternateName: SITE_NAME,
  url: SITE_URL,
  logo: absoluteAsset(DEFAULT_OG_IMAGE),
  sameAs: ORGANIZATION_SAME_AS,
};

export function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

// EducationalApplication for tutoring-style tools, SoftwareApplication for
// everything else — both accept the same field shape, so one builder covers
// both per Schema.org's own EducationalApplication-extends-SoftwareApplication
// hierarchy. Deliberately no `offers`/`aggregateRating` fields: neither a
// fixed price nor a real review count exists anywhere in this codebase, and
// fabricating either would violate Google's structured-data guidelines.
export function buildSoftwareApplicationSchema(opts: {
  type: 'SoftwareApplication' | 'EducationalApplication';
  name: string;
  description: string;
  path: string;
  applicationCategory: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': opts.type,
    name: opts.name,
    description: opts.description,
    url: localizedUrl(DEFAULT_LOCALE, opts.path),
    applicationCategory: opts.applicationCategory,
    operatingSystem: 'Web',
    provider: { '@type': 'Organization', name: 'CDC', url: SITE_URL },
  };
}
