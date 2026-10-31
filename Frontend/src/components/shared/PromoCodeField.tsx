import { useState } from 'react';
import { validatePromoCode, PromoTargetType, PromoValidationResult } from '../../services/paymentService';

// Shared promo-code input for checkout surfaces that don't already carry
// their own inline copy (the course, live-training and store pages predate
// this). It only previews the discount via POST /promos/validate; the
// checkout route always re-validates the code server-side and is the one
// that actually spends a use (see Backend couponService.ts).
interface PromoCodeFieldProps {
  targetType: PromoTargetType;
  targetId: string;
  lang: 'ka' | 'en';
  applied: PromoValidationResult | null;
  onChange: (promo: PromoValidationResult | null) => void;
  disabled?: boolean;
}

const copy = {
  ka: { placeholder: 'პრომო კოდი', apply: 'გამოყენება', applied: 'პრომო კოდი გააქტიურდა', remove: 'მოხსნა', invalid: 'პრომო კოდი არასწორია.' },
  en: { placeholder: 'Promo code', apply: 'Apply', applied: 'Promo applied', remove: 'Remove', invalid: 'Invalid promo code.' },
};

export default function PromoCodeField({ targetType, targetId, lang, applied, onChange, disabled }: PromoCodeFieldProps) {
  const t = copy[lang];
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    const code = input.trim();
    if (!code) return;
    setError(null);
    setApplying(true);
    try {
      onChange(await validatePromoCode(code, targetType, targetId));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.invalid);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div data-testid="promo-code-field">
      {applied ? (
        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <span>✓ {t.applied}: {applied.code}</span>
          <button
            type="button"
            onClick={() => { onChange(null); setInput(''); }}
            disabled={disabled}
            className="font-medium text-slate-500 underline disabled:opacity-50"
          >
            {t.remove}
          </button>
        </p>
      ) : (
        <div className="flex gap-2 max-w-sm">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApply(); } }}
            placeholder={t.placeholder}
            aria-label={t.placeholder}
            disabled={disabled}
            className="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleApply}
            disabled={disabled || applying || !input.trim()}
            className="shrink-0 text-sm font-bold px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            {applying ? '…' : t.apply}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
