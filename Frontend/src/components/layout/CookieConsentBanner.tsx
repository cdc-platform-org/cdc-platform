import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Cookie } from 'lucide-react';

const STORAGE_KEY = 'cdc-cookie-consent';

const dict = {
  ka: {
    body: 'ჩვენ ვიყენებთ ქუქიებს საიტის გამართული მუშაობისა და თქვენი გამოცდილების გასაუმჯობესებლად.',
    learnMore: 'დეტალურად',
    acceptAll: 'დადასტურება',
    essentialOnly: 'მართვა',
  },
  en: {
    body: 'We use cookies to keep the site running smoothly and improve your experience.',
    learnMore: 'Learn more',
    acceptAll: 'Accept All',
    essentialOnly: 'Manage',
  },
};

// Bottom-left, non-intrusive card — mounted once in _app.tsx so it shows on
// every page until a choice is made. There's no analytics/marketing script
// on this site to actually gate behind the choice yet, so both buttons just
// record the preference and dismiss; the stored value is there for when one
// is added, so consent doesn't need to be re-asked at that point.
export default function CookieConsentBanner() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  const choose = (value: 'accepted' | 'essential') => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ value, decidedAt: new Date().toISOString() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
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
            onClick={() => choose('essential')}
            className="flex-1 text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-transparent cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t.essentialOnly}
          </button>
          <button
            type="button"
            onClick={() => choose('accepted')}
            className="flex-1 text-xs font-bold px-3 py-2.5 rounded-xl text-white bg-gradient-to-r from-cyan-500 to-blue-600 border-none cursor-pointer hover:opacity-90 transition-opacity"
          >
            {t.acceptAll}
          </button>
        </div>
      </div>
    </div>
  );
}
