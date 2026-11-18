import { appWithTranslation } from 'next-i18next';
import Head from 'next/head';
import Script from 'next/script';
import localFont from 'next/font/local';
import { useRouter } from 'next/router';
import { AuthProvider } from '@/src/context/AuthContext';
import { AuthModalProvider } from '@/src/context/AuthModalContext';
import AuthModal from '@/src/components/auth/AuthModal';
import { VerificationDrawerProvider } from '@/src/context/VerificationDrawerContext';
import VerificationDrawer from '@/src/components/shared/VerificationDrawer';
import ScrollToTop from '@/src/components/layout/ScrollToTop';
import FloatingButtons from '@/src/components/layout/FloatingButtons';
import CookieConsentBanner from '@/src/components/layout/CookieConsentBanner';
import BetaModeBanner from '@/src/components/layout/BetaModeBanner';
import TermsConsentModal from '@/src/components/auth/TermsConsentModal';
import AdminModeBar from '@/src/components/layout/AdminModeBar';
import { useAdminLangVersion } from '@/src/i18n/admin';
import MotionLayer from '@/src/components/layout/MotionLayer';
import MobileTabBar from '@/src/components/layout/MobileTabBar';
import { resolveLocale } from '@/src/utils/locale';
import type { AppProps } from 'next/app';
import '@fontsource/inter/latin-600.css';
import '@fontsource/noto-sans-georgian/400.css';
import '@fontsource/noto-sans-georgian/500.css';
import '@fontsource/noto-sans-georgian/600.css';
import '@fontsource/noto-sans-georgian/700.css';
import '@/styles/globals.css';

// Heading font — BPG ExtraSquare Mtavruli (public/fonts/), a Georgian
// caps/banner display face from BPG-InfoTech. Verified before wiring in:
// structurally valid TrueType, and walked the glyf table's actual outline
// byte length behind each mapped glyph ID (not just cmap presence, which
// is what silently misled the MS Ring attempt) for Latin A/a/Z/C/D and
// Georgian ა/ბ/ჰ plus a Mtavruli-range codepoint (U+10A0) — all real,
// non-empty outlines.
//
// This is the same "primary face + same-weight Latin fallback" shape
// tried previously with BPG Banner, which was reverted because a
// mixed-script heading (e.g. "HEKS/EPER Georgia-ს მხარდაჭერა") rendered
// in two visibly different typefaces once Latin fell through to Inter.
// That risk is unchanged here — it's inherent to any two-font stack, not
// specific to which Georgian face is primary — so if the same visual
// inconsistency shows up on mixed-script headings, that's this same
// tradeoff recurring, not a new bug. Inter is self-hosted (not the bare
// string 'Inter') at weight 600 as a deliberate attempt to visually match
// this display face's heavier, squared letterforms rather than pairing
// it with Inter's default 400 regular.
const headingFont = localFont({
  src: '../public/fonts/bpg_extrasquare_mtavruli_2009-60394595947.ttf',
  weight: '400',
  variable: '--font-heading',
  display: 'swap',
});

// Primary faces use local WOFF2 files, never Google's build-time font loader.
// The Fontsource CSS above supplies the same named families outside this
// wrapper and the Latin/other-script subsets of Noto Sans Georgian. Keeping
// that family as a fallback preserves mixed-script typography everywhere
// --font-georgian-safe is used, including Tailwind's font-sans utilities.
const fallbackFont = localFont({
  src: '../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2',
  weight: '600',
  variable: '--font-fallback',
  display: 'swap',
  adjustFontFallback: false,
});

const georgianSafeFont = localFont({
  src: [
    { path: '../node_modules/@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-400-normal.woff2', weight: '400' },
    { path: '../node_modules/@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-500-normal.woff2', weight: '500' },
    { path: '../node_modules/@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-600-normal.woff2', weight: '600' },
    { path: '../node_modules/@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-700-normal.woff2', weight: '700' },
  ],
  variable: '--font-georgian-safe',
  fallback: ['Noto Sans Georgian'],
  display: 'swap',
  adjustFontFallback: false,
});

function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const adminLangVersion = useAdminLangVersion();
  const isAdminRoute = router.pathname.startsWith('/admin');

  // FloatingButtons only renders on the homepage (see FloatingButtons.tsx) —
  // a fixed bottom-6 right-6 stack of two 48px pills (96px + 12px gap =
  // 132px tall from the viewport edge) there. ScrollToTop is pushed above it
  // only on that same page, with extra clearance (44px gap, not just enough
  // to technically not touch) so it reads as clearly separate rather than
  // crowded on narrow mobile widths; everywhere else it sits at the normal
  // corner.
  // On phones the bottom tab bar (MobileTabBar) sets --tabbar-h; both
  // positions add it so the button never sits underneath the bar. sm+ is
  // unchanged (the variable is unset there and the sm: values win anyway).
  const scrollToTopPosition = router.pathname === '/'
    ? 'bottom-[calc(11rem+var(--tabbar-h,0px))] sm:bottom-44 right-6'
    : 'bottom-[calc(1.5rem+var(--tabbar-h,0px))] sm:bottom-6 right-6';

  return (
    <>
      <Head>
        {/* No viewport meta existed anywhere in the app (Next.js Pages
            Router does not inject one for non-AMP pages — only _document.js's
            AMP-mode branch does). Without it, mobile browsers default to a
            ~980px desktop layout viewport and every sm:/md: Tailwind
            breakpoint below effectively never activates on a real phone. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* Installable web app (Add to Home Screen) — manifest + icons in
            /public. Opens standalone, without browser chrome. */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0b0a1c" media="(prefers-color-scheme: dark)" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="CDC" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* AUDIT NOTE (fixed): this block used to also render og:title/
            og:description/og:image/og:url and twitter:*, hardcoded to the
            homepage's own content, in a <Head> that wraps EVERY page. Next's
            next/head does NOT dedupe plain (un-keyed) <meta property="og:*">
            tags across separate Head instances — this app-wide Head and a
            page's own SEOHead (src/components/seo/SEOHead.tsx) both render
            an og:url tag, so both landed in the final HTML, and og:url was
            hardcoded to https://www.cdc.ge on every single page regardless.
            A Facebook/LinkedIn share of e.g. a course or blog post could
            then get attributed/cached under the homepage URL instead of the
            actual page. Removed here — SEOHead is the single, correct
            source for these on every page that renders it; a page that
            doesn't yet use SEOHead simply has no og:* tags rather than
            wrong ones. */}
        <meta name="description" content="ციფრული პროფესიების ცენტრი (CDC) გთავაზობთ ტოპ 10 პროფესიას საქართველოში, მათ შორის მაღალანაზღაურებადი პროფესიები, AI ტესტების გენერატორი და მასწავლებლის ასისტენტი." />
        <meta name="keywords" content="ციფრული პროფესიები, ტოპ 10 პროფესია საქართველოში, მაღალანაზღაურებადი პროფესიები, ციფრული პროფესიების ცენტრი, CDC, მასწავლებლის ასისტენტი, AI ტესტების გენერატორი, ონლაინ სწავლება" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "CDC - ციფრული პროფესიების ცენტრი",
              "url": "https://www.cdc.ge",
              "description": "ციფრული პროფესიების ცენტრი (CDC) გთავაზობთ ტოპ 10 პროფესიას საქართველოში, მათ შორის მაღალანაზღაურებადი პროფესიები, AI ტესტების გენერატორი და მასწავლებლის ასისტენტი.",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://www.cdc.ge/search?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            }),
          }}
        />

      </Head>
      <Script
        // Google's IdConfiguration has no `locale` field — despite
        // AuthModal.tsx passing one to initialize(), the actual documented
        // way to control the "Sign in/up with Google" button and One Tap
        // prompt's language is the `hl` query param on this script URL
        // itself. Without it the button falls back to the browser/OS
        // locale, which is why it was rendering in Russian for some users
        // regardless of the site's own ka/en language switcher.
        src={`https://accounts.google.com/gsi/client?hl=${resolveLocale(router.locale || 'en')}`}
        strategy="afterInteractive"
        // Google's script loads async — if AuthModal.tsx opens before this
        // fires, window.google is still undefined and its render-button
        // effect has nothing to retry on. This event lets it react once the
        // script actually becomes available instead of silently giving up.
        onLoad={() => window.dispatchEvent(new Event('google-gsi-ready'))}
      />
      <div className={`app-shell ${headingFont.variable} ${fallbackFont.variable} ${georgianSafeFont.variable} overflow-x-hidden px-4 sm:px-6`}>
        <AuthProvider>
          <AuthModalProvider>
            <VerificationDrawerProvider>
              <BetaModeBanner />
              {/* Admin pages re-mount when the admin KA/EN switch flips, so
                  every at()-translated string re-evaluates (src/i18n/admin). */}
              <Component key={isAdminRoute ? `admin-lang-${adminLangVersion}` : undefined} {...pageProps} />
              <MotionLayer />
              <MobileTabBar />
              <ScrollToTop positionClassName={scrollToTopPosition} />
              <FloatingButtons />
              <AuthModal />
              <VerificationDrawer />
              <CookieConsentBanner />
              <TermsConsentModal />
              <AdminModeBar />
            </VerificationDrawerProvider>
          </AuthModalProvider>
        </AuthProvider>
      </div>
    </>
  );
}

export default appWithTranslation(App);
