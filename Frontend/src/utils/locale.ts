// Single source of truth for which locales the site supports — mirrors
// next-i18next.config.js's `locales` list. Several globally-shared
// components (SiteHeader, SiteFooter, AuthModal, GoogleSignInButton, the
// Google Identity Services script tag in _app.tsx) keep their own inline
// ka/en/de/es/fr/uk dictionaries instead of going through next-i18next's
// useTranslation — they're either mounted once globally before any page's
// serverSideTranslations resolves (AuthModal, _app.tsx), or reused across
// dozens of pages that can't all be guaranteed to declare the same
// namespace. Each of those used to derive its own "is this English or not"
// boolean, which meant every locale other than 'en' silently fell back to
// Georgian. This helper is the one place that mapping happens now.
export const SUPPORTED_LOCALES = ['ka', 'en', 'de', 'es', 'fr', 'uk'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// The site's FULL locale list (mirrors next-i18next.config.js's `locales`
// exactly) — tr/hy/az were added there without ever being added to
// SUPPORTED_LOCALES above, which is the actual bug: resolveLocale() used to
// treat "not in SUPPORTED_LOCALES" as "totally unrecognized" and collapse
// it to 'ka', so switching the site to Turkish/Armenian/Azerbaijani made
// every one of the ~65 files that do `dict[resolveLocale(router.locale)]`
// (or an equivalent `resolveLocale(locale) === 'ka' ? ka-content : en-content`
// ternary) silently render full Georgian instead of falling back to
// English — reported first on the blog pages, confirmed sitewide on
// re-audit.
const SITE_LOCALES = ['ka', 'en', 'de', 'es', 'fr', 'uk', 'tr', 'hy', 'az'] as const;

// A real site locale (tr/hy/az today) that SUPPORTED_LOCALES doesn't cover
// with a full dictionary yet now falls back to 'en', never 'ka' — safe to do
// unconditionally because every one of those ~65 dictionaries already has a
// real 'en' entry (it's the universal secondary-language default
// throughout this codebase), so `dict.en` can never be undefined the way
// `dict['tr']` would be. Only a locale string that isn't a real site locale
// at all (garbage input, not one of next-i18next.config.js's 9) still falls
// back to 'ka', the original default-locale behavior for that case.
export function resolveLocale(locale: string | undefined): SupportedLocale {
  if ((SUPPORTED_LOCALES as readonly string[]).includes(locale ?? '')) return locale as SupportedLocale;
  if ((SITE_LOCALES as readonly string[]).includes(locale ?? '')) return 'en';
  return 'ka';
}

// Next.js's own automatic locale detection (i18n.localeDetection, on by
// default) redirects any locale-prefixless request based on the
// Accept-Language header UNLESS a NEXT_LOCALE cookie is present, in which
// case the cookie wins. Nothing in this app used to set that cookie, so a
// user who explicitly picked "ka" (the defaultLocale, served with no URL
// prefix) would get silently redirected back to whatever their browser's
// Accept-Language preferred on the next full refresh. LanguageSwitcher.tsx
// writes this cookie (plus the localStorage mirror below) on every manual
// switch so Next's own detection logic respects the choice on refreshes and
// on any fresh, prefixless navigation — no custom redirect logic needed.
export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const LOCALE_STORAGE_KEY = 'cdc_locale';

// The one rule for "which language should ka/en-only DB content (blog
// title/content vs. titleEn/contentEn, course title/description vs.
// titleEn/descriptionEn, etc.) render in": Georgian only for the ka locale,
// English for every other real site locale — never Georgian for a non-ka
// locale, and never anything that needs a per-locale DB column that doesn't
// exist (there is no titleTr/titleDe; en is the universal non-ka fallback).
// Since resolveLocale() above already collapses tr/hy/az to 'en', this is
// equivalent to the `lang === 'ka' ? 'ka' : 'en'` ternary already written
// inline in several pages — kept as a named helper so new call sites don't
// have to re-derive it, and so its intent (never Georgian for non-ka) reads
// as a rule, not an ad hoc ternary.
export function contentLocale(locale: SupportedLocale): 'ka' | 'en' {
  return locale === 'ka' ? 'ka' : 'en';
}

// Looks up a UI-string dictionary entry for the resolved locale, falling
// back to English if the dictionary happens not to have a real translation
// for it (e.g. a dict that only ever wrote ka/en copy, reused as-is once a
// new SUPPORTED_LOCALES entry is added later) — never undefined the way a
// bare `dict[locale]` lookup could be, and never Georgian for a non-ka
// locale.
export function pickText<T>(dict: Partial<Record<SupportedLocale, T>> & { ka: T; en: T }, locale: SupportedLocale): T {
  if (locale === 'ka') return dict.ka;
  return dict[locale] ?? dict.en;
}
