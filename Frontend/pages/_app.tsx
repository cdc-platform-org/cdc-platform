import { appWithTranslation } from 'next-i18next';
import Head from 'next/head';
import Script from 'next/script';
import localFont from 'next/font/local';
import { Inter } from 'next/font/google';
import { useRouter } from 'next/router';
import { AuthProvider } from '@/src/context/AuthContext';
import { AuthModalProvider } from '@/src/context/AuthModalContext';
import AuthModal from '@/src/components/auth/AuthModal';
import ScrollToTop from '@/src/components/layout/ScrollToTop';
import FloatingButtons from '@/src/components/layout/FloatingButtons';
import CookieConsentBanner from '@/src/components/layout/CookieConsentBanner';
import TermsConsentModal from '@/src/components/auth/TermsConsentModal';
import { resolveLocale } from '@/src/utils/locale';
import type { AppProps } from 'next/app';
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

const fallbackFont = Inter({
  subsets: ['latin'],
  weight: '600',
  variable: '--font-fallback',
  display: 'swap',
});

function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  // FloatingButtons only renders on the homepage (see FloatingButtons.tsx) —
  // a fixed bottom-6 right-6 stack of two 48px pills (96px + 12px gap =
  // 132px tall from the viewport edge) there. ScrollToTop is pushed above it
  // only on that same page, with extra clearance (44px gap, not just enough
  // to technically not touch) so it reads as clearly separate rather than
  // crowded on narrow mobile widths; everywhere else it sits at the normal
  // corner.
  const scrollToTopPosition = router.pathname === '/' ? 'bottom-44 right-6' : 'bottom-6 right-6';

  return (
    <>
      <Head>
        <style>{`
          /* Font-family itself (GL-Kirovi @font-face + the forced rule on
             html/body/inputs/headings) now lives in styles/globals.css —
             one canonical declaration instead of two copies drifting apart.
             This block keeps only the letter-spacing/line-height tuning. */
          /* ორიგინალური ფონტის პარამეტრები */
          html, body, button, input, select, textarea {
            letter-spacing: 0.05em !important;
            line-height: 1.6 !important;
          }

          /* სათაურის ხაზებს შორის დაშორება */
          h1, h2, h3 {
            letter-spacing: 0.05em !important;
            line-height: 1.65 !important;
          }

          /* ბლოკების (ქარდების) გაცოცხლება და ნეონის ცისფერი ნათება —
             შემოსაზღვრულია მხოლოდ მთავარი გვერდის ამ სექციებით. (Deliberately
             scoped to just these homepage sections — an earlier, unscoped
             ".grid > div" version of this rule matched every Tailwind
             "grid" class on the entire site, including Wallet/Payouts/
             Dashboard/admin pages never designed for a card hover-lift,
             causing the glow/scale to overlap neighboring text there.) */
          section#about .grid > div,
          section#courses .grid > div,
          section#blog .grid > div,
          section#about > div > div {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }

          section#about .grid > div:hover,
          section#courses .grid > div:hover,
          section#blog .grid > div:hover {
            transform: translateY(-4px) scale(1.01) !important;
            border-color: #22d3ee !important;
            box-shadow: 0 10px 30px -5px rgba(34, 211, 238, 0.3) !important;
          }

          /* ყველა ღილაკის გაცოცხლება */
          button, 
          a.bg-slate-900, 
          a.bg-gradient-to-r,
          .bg-cyan-500,
          button.bg-gradient-to-r {
            transition: all 0.25s ease !important;
          }

          button:hover, 
          a.bg-slate-900:hover, 
          a.bg-gradient-to-r:hover {
            transform: translateY(-2px) !important;
            opacity: 0.95;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15) !important;
          }

          button:active, 
          a.bg-slate-900:active, 
          a.bg-gradient-to-r:active {
            transform: translateY(1px) !important;
          }
        `}</style>
      </Head>
      <Script
        // Google's IdConfiguration has no `locale` field — despite
        // AuthModal.tsx passing one to initialize(), the actual documented
        // way to control the "Sign in/up with Google" button and One Tap
        // prompt's language is the `hl` query param on this script URL
        // itself. Without it the button falls back to the browser/OS
        // locale, which is why it was rendering in Russian for some users
        // regardless of the site's own ka/en language switcher.
        src={`https://accounts.google.com/gsi/client?hl=${resolveLocale(router.locale)}`}
        strategy="afterInteractive"
        // Google's script loads async — if AuthModal.tsx opens before this
        // fires, window.google is still undefined and its render-button
        // effect has nothing to retry on. This event lets it react once the
        // script actually becomes available instead of silently giving up.
        onLoad={() => window.dispatchEvent(new Event('google-gsi-ready'))}
      />
      <div className={`${headingFont.variable} ${fallbackFont.variable}`}>
        <AuthProvider>
          <AuthModalProvider>
            <Component {...pageProps} />
            <ScrollToTop positionClassName={scrollToTopPosition} />
            <FloatingButtons />
            <AuthModal />
            <CookieConsentBanner />
            <TermsConsentModal />
          </AuthModalProvider>
        </AuthProvider>
      </div>
    </>
  );
}

export default appWithTranslation(App);