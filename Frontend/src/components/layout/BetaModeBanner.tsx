import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { X } from 'lucide-react';
import { resolveLocale, pickText } from '../../utils/locale';

// Session-only dismiss — sessionStorage (not localStorage) so the banner
// comes back on the visitor's next real session, matching "dismiss for the
// current session" rather than "dismiss forever".
const SESSION_KEY = 'cdc-beta-banner-dismissed';
const SUPPORT_EMAIL = 'support@cdc.org.ge';

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
    message: '🚀 CDC პლატფორმა გაშვებულია სატესტო (Beta) რეჟიმში. რაიმე შეფერხების ან ხარვეზის აღმოჩენის შემთხვევაში, გთხოვთ მოგვწეროთ ელ-ფოსტაზე:',
    dismiss: 'დახურვა',
  },
  en: {
    message: '🚀 CDC Platform is currently in Beta mode. If you encounter any issues or technical hiccups, please contact us at',
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
    <div role="status" className="relative z-40 w-full bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-cyan-500/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-start sm:items-center justify-center gap-2 sm:gap-4">
        <p className="flex-1 text-center text-[11px] sm:text-xs font-medium text-slate-200 leading-snug">
          {t.message}{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-2 whitespace-nowrap"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.dismiss}
          className="shrink-0 p-1 rounded-lg border-none bg-transparent cursor-pointer text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
