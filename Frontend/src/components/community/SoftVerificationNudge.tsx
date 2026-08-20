import { useRouter } from 'next/router';
import { Lightbulb } from 'lucide-react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { resolveLocale } from '../../utils/locale';

interface SoftVerificationNudgeProps {
  onContinueWithoutVerifying: () => void;
  onVerify: () => void;
  onClose: () => void;
}

const EN_STRINGS = {
  message: 'Tip: Verified freelancers get hired 3x faster. Want to complete quick verification first?',
  continueWithout: 'Continue without verifying',
  verify: 'Get verified (5 min)',
};

const dict = {
  ka: {
    message: 'რჩევა: ვერიფიცირებული ფრილანსერები 3-ჯერ უფრო სწრაფად იღებენ შეკვეთებს. გსურთ გაიაროთ სწრაფი ვერიფიკაცია?',
    continueWithout: 'გაგრძელება ვერიფიკაციის გარეშე',
    verify: 'ვერიფიკაციის გავლა (5 წთ)',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

// A nudge, never a wall — proposal/vacancy submission stays open to anyone;
// this exists purely to surface the "Verified freelancers get hired
// faster" incentive at the exact moment someone's about to apply, with an
// always-available "continue anyway" path. See Backend's
// utils/freelancerVerification.ts's own comment on why this isn't a hard
// gate (only wallet.ts's payout-requests still is).
export default function SoftVerificationNudge({ onContinueWithoutVerifying, onVerify, onClose }: SoftVerificationNudgeProps) {
  const router = useRouter();
  const t = dict[resolveLocale(router.locale)];
  useEscapeToClose(true, onClose);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#0e1422] rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-6">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-400/30 text-amber-500 flex items-center justify-center">
            <Lightbulb className="w-4.5 h-4.5" />
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium">{t.message}</p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onVerify}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2.5 text-sm font-bold text-white border-none cursor-pointer hover:opacity-90"
          >
            {t.verify}
          </button>
          <button
            type="button"
            onClick={onContinueWithoutVerifying}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-transparent cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {t.continueWithout}
          </button>
        </div>
      </div>
    </div>
  );
}
