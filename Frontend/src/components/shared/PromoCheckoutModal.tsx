import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import PromoCodeField from './PromoCodeField';
import { PromoTargetType, PromoValidationResult } from '../../services/paymentService';
import { formatPrice } from '../../utils/coursePricing';

// Small "confirm purchase" step for places that start a checkout straight
// from a card (course list, homepage) instead of a product page, so every
// paid purchase gets the same promo-code input + apply button the product
// pages already have. It only previews the discount; the checkout route
// re-validates the code server-side (Backend couponService.ts).
interface PromoCheckoutModalProps {
  title: string;
  // Minor units (tetri), same as the prices the card shows.
  currentPrice: number;
  originalPrice?: number;
  targetType: PromoTargetType;
  targetId: string;
  lang: 'ka' | 'en';
  busy: boolean;
  error?: string | null;
  onConfirm: (promoCode?: string) => void;
  onClose: () => void;
}

const copy = {
  ka: { heading: 'შეძენა', promo: 'გაქვს პრომო კოდი?', pay: 'გადახდა', free: 'უფასოდ ჩარიცხვა', processing: 'მუშავდება…', close: 'დახურვა' },
  en: { heading: 'Checkout', promo: 'Have a promo code?', pay: 'Pay', free: 'Enroll for free', processing: 'Processing…', close: 'Close' },
};

export default function PromoCheckoutModal({
  title,
  currentPrice,
  originalPrice,
  targetType,
  targetId,
  lang,
  busy,
  error,
  onConfirm,
  onClose,
}: PromoCheckoutModalProps) {
  const t = copy[lang];
  const [appliedPromo, setAppliedPromo] = useState<PromoValidationResult | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const finalPrice = appliedPromo ? appliedPromo.discountedAmount : currentPrice;
  const struck = appliedPromo ? (originalPrice ?? currentPrice) : originalPrice && originalPrice > currentPrice ? originalPrice : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-4 pb-[calc(var(--tabbar-h,0px)+1rem)] sm:pb-4"
      onClick={() => { if (!busy) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t.heading}
      data-testid="promo-checkout-modal"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-5 text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t.heading}</p>
            <h2 className="text-lg font-black leading-snug break-words">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t.close}
            className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-baseline gap-2 mb-4">
          {struck != null && struck !== finalPrice && <s className="text-base text-slate-500">{formatPrice(struck)}</s>}
          <span className="text-2xl font-black">{formatPrice(finalPrice)}</span>
        </div>

        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.promo}</p>
        <PromoCodeField
          targetType={targetType}
          targetId={targetId}
          lang={lang}
          applied={appliedPromo}
          onChange={setAppliedPromo}
          disabled={busy}
        />

        {error && <p role="alert" className="text-xs text-red-500 mt-3">{error}</p>}

        <button
          type="button"
          onClick={() => onConfirm(appliedPromo?.code)}
          disabled={busy}
          className="mt-5 w-full text-sm font-bold text-white px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-60"
        >
          {busy ? t.processing : finalPrice === 0 ? t.free : `${t.pay} ${formatPrice(finalPrice)}`}
        </button>
      </div>
    </div>
  );
}
