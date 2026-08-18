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

export function resolveLocale(locale: string | undefined): SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale ?? '')
    ? (locale as SupportedLocale)
    : 'ka';
}
