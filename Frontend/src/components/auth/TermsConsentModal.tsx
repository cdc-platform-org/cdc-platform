import { useState, useReducer } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ScrollText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { acceptTerms } from '../../services/authService';

// Scoped to the accepting user's id (not a flat boolean) — localStorage is
// per-browser, not per-account, so a flat flag would incorrectly skip the
// modal for a second user logging into the same browser/device after a
// first user already accepted. Set only AFTER the DB write succeeds (see
// handleAgree) — a fast, synchronous fallback so the modal never has to
// wait on a full user-object refresh/hydration cycle to know it should stay
// closed, without ever trusting local state the server hasn't confirmed.
//
// Read directly from localStorage on every render rather than cached in
// useState — this component is mounted once in _app.tsx and never
// unmounts, including across a same-tab logout → different-account login
// (a shared-computer scenario), so a cached value from the first account
// would otherwise leak into a second account's session and skip its modal.
const LOCAL_ACCEPTED_KEY = 'cdc_terms_accepted';
function hasAcceptedLocally(userId: string): boolean {
  return typeof window !== 'undefined' && localStorage.getItem(LOCAL_ACCEPTED_KEY) === userId;
}

const dict = {
  ka: {
    title: 'წესები და პირობების განახლება',
    body: 'გასაგრძელებლად გთხოვთ დაეთანხმოთ ჩვენს წესებსა და პირობებს.',
    linkText: 'წესები და პირობების სრულად ნახვა',
    agree: 'ვეთანხმები და ვაგრძელებ',
    agreeing: 'იტვირთება…',
  },
  en: {
    title: 'Terms & Conditions Update',
    body: 'Please accept our Terms & Conditions to continue.',
    linkText: 'Read the full Terms & Conditions',
    agree: 'I Agree & Continue',
    agreeing: 'Please wait…',
  },
};

// Blocking, non-dismissable overlay (no backdrop-click, no X/Escape close) —
// shown for ANY authenticated user whose termsAcceptedAt is still null: both
// pre-existing accounts (this field didn't exist before) and every Google
// sign-up, which has no separate consent checkbox before account creation.
// Mounted once in _app.tsx so it's covered on every page, not just the
// dashboard.
export default function TermsConsentModal() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // No state to trigger with — writing to localStorage doesn't itself cause
  // a re-render, so handleAgree calls this to force one after the write.
  const [, forceRerender] = useReducer((c: number) => c + 1, 0);

  const hasAccepted = !!user?.termsAcceptedAt || (!!user && hasAcceptedLocally(user.id));
  // The full Terms page must be freely readable — never cover it with this
  // blocking overlay, even for a user who still hasn't accepted yet.
  const onTermsPage = router.pathname === '/terms';

  if (!isAuthenticated || !user || hasAccepted || onTermsPage) return null;

  const handleAgree = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await acceptTerms();
      // DB write succeeded — persist the fallback flag and force a
      // re-render so hasAccepted picks it up immediately, closing the
      // modal without waiting on the (separate, best-effort) full
      // user-object refresh below.
      localStorage.setItem(LOCAL_ACCEPTED_KEY, user.id);
      forceRerender();
      refreshUser().catch(() => {});
    } catch {
      setError(lang === 'ka' ? 'დაფიქსირდა შეცდომა. სცადეთ თავიდან.' : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-4">
          <ScrollText className="w-5 h-5" />
        </div>
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">{t.title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">{t.body}</p>
        {/* Same-tab navigation (not target="_blank") — the modal itself
            checks router.pathname === '/terms' and hides on that route, so
            clicking through actually reveals the full page underneath
            instead of leaving this overlay covering a background tab. */}
        <Link href="/terms" className="inline-block text-sm font-bold text-cyan-600 dark:text-cyan-400 hover:underline mb-5">
          {t.linkText} →
        </Link>
        {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-3">{error}</p>}
        <button
          type="button"
          onClick={handleAgree}
          disabled={submitting}
          className="w-full text-sm font-bold px-4 py-3 rounded-xl text-white bg-gradient-to-r from-cyan-500 to-blue-600 border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {submitting ? t.agreeing : t.agree}
        </button>
      </div>
    </div>
  );
}
