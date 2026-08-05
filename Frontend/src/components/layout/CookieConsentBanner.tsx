import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Cookie, X } from 'lucide-react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

const STORAGE_KEY = 'cdc-cookie-consent';

interface CookiePreferences {
  essential: true; // always on, not a real choice — kept for shape clarity
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
}

const dict = {
  ka: {
    body: 'ჩვენ ვიყენებთ ქუქიებს საიტის გამართული მუშაობისა და თქვენი გამოცდილების გასაუმჯობესებლად.',
    learnMore: 'დეტალურად',
    acceptAll: 'დადასტურება',
    manage: 'მართვა',
    modalTitle: 'ქუქიების პარამეტრები',
    modalBody: 'აირჩიეთ, რომელი ტიპის ქუქიების გამოყენება გსურთ. აუცილებელი ქუქიები ყოველთვის აქტიურია, რადგან საიტის ძირითადი ფუნქციები მათზეა დამოკიდებული.',
    essential: 'აუცილებელი',
    essentialDesc: 'შესვლა, უსაფრთხოება და საიტის ძირითადი ფუნქციები. არ გამოირთვება.',
    analytics: 'ანალიტიკა',
    analyticsDesc: 'გვეხმარება გავიგოთ, როგორ იყენებენ ვიზიტორები საიტს, რომ გავაუმჯობესოთ იგი.',
    marketing: 'მარკეტინგი',
    marketingDesc: 'გამოიყენება რეკლამების პერსონალიზაციისა და ეფექტურობის გასაზომად.',
    alwaysOn: 'ყოველთვის აქტიური',
    save: 'პარამეტრების შენახვა',
    close: 'დახურვა',
  },
  en: {
    body: 'We use cookies to keep the site running smoothly and improve your experience.',
    learnMore: 'Learn more',
    acceptAll: 'Accept All',
    manage: 'Manage',
    modalTitle: 'Cookie Preferences',
    modalBody: 'Choose which types of cookies you’re okay with. Essential cookies are always on, since core site features depend on them.',
    essential: 'Essential',
    essentialDesc: 'Login, security, and core site functionality. Cannot be turned off.',
    analytics: 'Analytics',
    analyticsDesc: 'Helps us understand how visitors use the site so we can improve it.',
    marketing: 'Marketing',
    marketingDesc: 'Used to personalize ads and measure their effectiveness.',
    alwaysOn: 'Always active',
    save: 'Save Preferences',
    close: 'Close',
  },
};

function readStoredPreferences(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors border-none cursor-pointer ${
        disabled ? 'cursor-not-allowed opacity-60' : ''
      } ${checked ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'}`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// Bottom-left, non-intrusive card — mounted once in _app.tsx so it shows on
// every page until a choice is made. There's no analytics/marketing script
// on this site to actually gate behind the choice yet, so the stored
// granular preferences are there for when one is added, so consent doesn't
// need to be re-asked at that point.
export default function CookieConsentBanner() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEscapeToClose(showPreferences, () => setShowPreferences(false));

  useEffect(() => {
    const stored = readStoredPreferences();
    if (!stored) {
      setVisible(true);
    } else {
      setAnalytics(stored.analytics);
      setMarketing(stored.marketing);
    }
  }, []);

  const persist = (prefs: { analytics: boolean; marketing: boolean }) => {
    const record: CookiePreferences = { essential: true, ...prefs, decidedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    setVisible(false);
    setShowPreferences(false);
  };

  const acceptAll = () => {
    setAnalytics(true);
    setMarketing(true);
    persist({ analytics: true, marketing: true });
  };

  const savePreferences = () => persist({ analytics, marketing });

  return (
    <>
      {visible && !showPreferences && (
        <div className="fixed bottom-4 left-4 right-4 sm:right-auto z-[70] sm:max-w-sm">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0e1422]/95 backdrop-blur-md shadow-xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <Cookie className="w-4 h-4" />
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {t.body}{' '}
                <Link href="/privacy" className="font-bold text-cyan-600 dark:text-cyan-400 hover:underline">
                  {t.learnMore}
                </Link>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPreferences(true)}
                className="flex-1 text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-transparent cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t.manage}
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="flex-1 text-xs font-bold px-3 py-2.5 rounded-xl text-white bg-gradient-to-r from-cyan-500 to-blue-600 border-none cursor-pointer hover:opacity-90 transition-opacity"
              >
                {t.acceptAll}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreferences && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPreferences(false)}
        >
          <div
            className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{t.modalTitle}</h3>
              <button
                type="button"
                onClick={() => setShowPreferences(false)}
                aria-label={t.close}
                className="shrink-0 p-1 rounded-lg border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{t.modalBody}</p>

            <div className="space-y-4 mb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{t.essential}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.essentialDesc}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Toggle checked disabled />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.alwaysOn}</span>
                </div>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{t.analytics}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.analyticsDesc}</p>
                </div>
                <Toggle checked={analytics} onChange={setAnalytics} />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{t.marketing}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.marketingDesc}</p>
                </div>
                <Toggle checked={marketing} onChange={setMarketing} />
              </div>
            </div>

            <button
              type="button"
              onClick={savePreferences}
              className="w-full text-sm font-bold px-4 py-3 rounded-xl text-white bg-gradient-to-r from-cyan-500 to-blue-600 border-none cursor-pointer hover:opacity-90 transition-opacity"
            >
              {t.save}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
