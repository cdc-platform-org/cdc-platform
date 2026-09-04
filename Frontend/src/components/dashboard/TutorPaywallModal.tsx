import { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { startTutorTrial } from '../../services/englishTutorService';
import { checkoutEnglishTutorSubscription } from '../../services/paymentService';
import { checkoutEnglishTutorSubscriptionStripe } from '../../services/stripePaymentService';

interface TutorPaywallModalProps {
  lang: 'ka' | 'en';
  trialAvailable: boolean;
  onClose: () => void;
  onTrialStarted: () => void;
}

const dict = {
  ka: {
    title: 'IMIAKO PRO',
    trialEnded: 'თქვენი 5-დღიანი ტესტ-ვერსია IMIAKO-სთან დასრულდა. გააგრძელეთ სწავლა ბარათის მიბმით (50 ₾/თვე).',
    upsell: 'გახსენით შეუზღუდავი გაკვეთილები, ყველა დონე (A1-C2) და შეუზღუდავი დიალოგი/როლური თამაში.',
    startTrial: '5 დღიანი უფასო ტესტის დაწყება (ბარათის გარეშე)',
    startingTrial: 'იწყება…',
    upgrade: 'PRO-ზე გადასვლა — 50 ₾/თვე',
    redirecting: 'გადამისამართება…',
    close: 'დახურვა',
  },
  en: {
    title: 'IMIAKO PRO',
    trialEnded: 'Your 5-day trial with IMIAKO has ended. Attach a card to continue learning (50 GEL/month).',
    upsell: 'Unlock unlimited lessons, every level (A1-C2), and unlimited Dialogue/Roleplay.',
    startTrial: 'Start 5-day free trial (no card required)',
    startingTrial: 'Starting…',
    upgrade: 'Upgrade to PRO — 50 GEL/month',
    redirecting: 'Redirecting…',
    close: 'Close',
  },
};

export default function TutorPaywallModal({ lang, trialAvailable, onClose, onTrialStarted }: TutorPaywallModalProps) {
  const t = dict[lang];
  const [startingTrial, setStartingTrial] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartTrial = async () => {
    setStartingTrial(true);
    setError(null);
    try {
      await startTutorTrial();
      onTrialStarted();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? (lang === 'ka' ? 'შეცდომა' : 'Something went wrong.'));
    } finally {
      setStartingTrial(false);
    }
  };

  const handleUpgrade = async () => {
    setCheckingOut(true);
    setError(null);
    try {
      const result = lang === 'ka' ? await checkoutEnglishTutorSubscription('ka') : await checkoutEnglishTutorSubscriptionStripe(undefined, 'usd');
      if (result.enrolled) {
        onTrialStarted(); // reuse the same "state changed, refetch" callback
        return;
      }
      if (result.redirectUrl) window.location.href = result.redirectUrl;
    } catch (err: any) {
      setError(err?.response?.data?.message ?? (lang === 'ka' ? 'შეცდომა' : 'Something went wrong.'));
      setCheckingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
        <button type="button" onClick={onClose} aria-label={t.close} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-black">{t.title}</h2>
        </div>

        {!trialAvailable && <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{t.trialEnded}</p>}
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{t.upsell}</p>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <div className="flex flex-col gap-2.5">
          {trialAvailable && (
            <button
              type="button"
              onClick={handleStartTrial}
              disabled={startingTrial}
              className="rounded-full border border-purple-400 text-purple-600 dark:text-purple-300 font-bold px-5 py-2.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {startingTrial && <Loader2 className="w-4 h-4 animate-spin" />}
              {startingTrial ? t.startingTrial : t.startTrial}
            </button>
          )}
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={checkingOut}
            className="rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 text-white font-bold px-5 py-2.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {checkingOut && <Loader2 className="w-4 h-4 animate-spin" />}
            {checkingOut ? t.redirecting : t.upgrade}
          </button>
        </div>
      </div>
    </div>
  );
}
