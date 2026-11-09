import { useState } from 'react';
import { Crown, Loader2 } from 'lucide-react';
import PromoCodeField, { localizePromoError } from '../shared/PromoCodeField';
import { PromoValidationResult, TutorSubscriptionCheckoutResult } from '../../services/paymentService';
import { toolPrimaryButton } from './ToolShell';

// Pay-for-30-days block shared by Educator VIP and a Business AI agent:
// price line, promo code field, and one BOG pay button. A 100% code comes
// back as enrolled=true (no redirect), so the page just refreshes its state.
interface Props {
  lang: 'ka' | 'en';
  priceGel: number;
  promoTargetId: 'educator-hub' | 'business-ai';
  checkout: (promoCode?: string) => Promise<TutorSubscriptionCheckoutResult>;
  onActivated: () => void;
  title?: string;
  compact?: boolean;
}

const copy = {
  ka: {
    perMonth: '/ 30 დღე',
    pay: 'გადახდა',
    payDiscounted: (n: string) => `გადახდა — ${n} ₾`,
    redirecting: 'გადამისამართება…',
    note: 'ერთჯერადი გადახდა BOG-ით. ავტომატური ჩამოჭრა არ ხდება: 30 დღის შემდეგ ისევ გადაიხდით, თუ გინდათ.',
    error: 'გადახდის დაწყება ვერ მოხერხდა. სცადეთ თავიდან.',
  },
  en: {
    perMonth: '/ 30 days',
    pay: 'Pay',
    payDiscounted: (n: string) => `Pay — ${n} GEL`,
    redirecting: 'Redirecting…',
    note: 'One-time payment via BOG. Nothing renews automatically: after 30 days you pay again if you want to continue.',
    error: 'Could not start the payment. Please try again.',
  },
};

export default function AiToolCheckoutCard({ lang, priceGel, promoTargetId, checkout, onActivated, title, compact }: Props) {
  const t = copy[lang];
  const [promo, setPromo] = useState<PromoValidationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fmt = (minor: number) => (minor / 100).toFixed(2).replace(/\.00$/, '');

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await checkout(promo?.code);
      if (result.enrolled) {
        setBusy(false);
        onActivated();
        return;
      }
      if (result.redirectUrl) window.location.href = result.redirectUrl;
      else setBusy(false);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(localizePromoError(message, lang) || t.error);
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 ${compact ? 'p-4' : 'p-5'}`} data-testid={`checkout-${promoTargetId}`}>
      {title && <p className="text-sm font-black text-slate-900 dark:text-white mb-1">{title}</p>}
      <p className="text-2xl font-black text-slate-900 dark:text-white mb-3">
        {promo ? (
          <>
            <span className="line-through text-slate-400 text-lg mr-2">{priceGel} ₾</span>
            {fmt(promo.discountedAmount)} ₾
          </>
        ) : (
          <>{priceGel} ₾</>
        )}
        <span className="text-sm font-bold text-slate-500 ml-1">{t.perMonth}</span>
      </p>
      <div className="mb-3">
        <PromoCodeField targetType="AI_TOOL" targetId={promoTargetId} lang={lang} applied={promo} onChange={setPromo} disabled={busy} />
      </div>
      <button type="button" onClick={pay} disabled={busy} className={`${toolPrimaryButton} w-full`} data-testid={`pay-${promoTargetId}`}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
        {busy ? t.redirecting : promo ? t.payDiscounted(fmt(promo.discountedAmount)) : t.pay}
      </button>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">{error}</p>}
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{t.note}</p>
    </div>
  );
}
