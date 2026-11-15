import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { X } from 'lucide-react';
import { resolveLocale, pickText } from '../../utils/locale';

// Session-only dismiss — sessionStorage (not localStorage) so the banner
// comes back on the visitor's next real session, matching "dismiss for the
// current session" rather than "dismiss forever".
const SESSION_KEY = 'cdc-beta-banner-dismissed';
const SUPPORT_EMAIL = 'contact@cdc.org.ge';

// Real ka/en copy; every other site locale (de/es/fr/uk/tr/hy/az) falls
// back to English via pickText/resolveLocale — same "real ka/en, English
// fallback for the rest" convention as this file's own dictionary-based
// siblings (CookieConsentBanner, AdminModeBar).
//
// Deliberately an inline dictionary, not a next-i18next `common.json` key,
// even though that's the more obviously "proper i18n" shape: this component
// is mounted once in _app.tsx so it renders on every page regardless of
// that page's own serverSideTranslations() namespace list — and today only
// 17 of this app's 144 pages actually load the `common` namespace. A real
// useTranslation('common') call here would silently render as a blank/raw
// key on the other 127. resolveLocale()'s own comment documents this exact
// tradeoff and names _app.tsx-mounted components specifically as the case
// where an inline dictionary is the correct choice, not a shortcut.
const COPY = {
  ka: {
    message: 'პლატფორმა სატესტო რეჟიმშია. მხარდაჭერა:',
    mobileMessage: 'სატესტო რეჟიმი ·',
    dismiss: 'დახურვა',
  },
  en: {
    message: 'The platform is in beta. Support:',
    mobileMessage: 'Beta ·',
    dismiss: 'Dismiss',
  },
};

export default function BetaModeBanner() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = pickText(COPY, lang);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) !== '1') setVisible(true);
    } catch {
      // sessionStorage unavailable (privacy mode, etc.) — fail open rather
      // than silently hiding a real announcement.
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // Nothing to persist — the banner will just show again next render,
      // which is an acceptable degrade, not a broken feature.
    }
  };

  if (!visible) return null;

  return (
    <div
      role="status"
      data-beta-banner
      // -mx-4 sm:-mx-6 cancels _app.tsx's app-shell px-4 sm:px-6 (the same
      // full-bleed technique SiteHeader.tsx's <nav> uses) — without it this
      // banner's background rendered inset from the real viewport edges by
      // that padding, showing white gaps on either side on wide screens.
      // Deliberately no `w-full` alongside it: a fixed width:100% is measured
      // against the (still-padded) parent's content box, so it would only
      // shift the box left without actually widening it to reach the real
      // right edge too — confirmed live as a real, screenshot-visible bug on
      // a sibling full-bleed element, not just a theoretical concern.
      className="relative z-40 -mx-4 sm:-mx-6 border-b border-cdc-border bg-cdc-bg text-cdc-muted"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex items-center justify-center gap-2 sm:gap-4">
        <p className="flex-1 text-center text-[10px] sm:text-[11px] font-normal leading-snug">
          <span className="hidden sm:inline">{t.message}</span><span className="sm:hidden">{t.mobileMessage}</span>{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-cdc-ink hover:underline underline-offset-2 whitespace-nowrap"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.dismiss}
          className="shrink-0 p-1 rounded border-none bg-transparent cursor-pointer text-cdc-muted hover:text-cdc-ink transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
