import { useState } from 'react';
import Router from 'next/router';
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

// The backend's promo errors are English (the target mismatch one is
// Georgian). Show every visitor the reason in the language their account /
// site is switched to: the router locale wins, the caller's ka/en is the
// fallback (e.g. during SSR before the router exists).
const PROMO_ERROR_KEYS: Record<string, string> = {
  'Invalid promo code.': 'invalid',
  'This promo code is no longer active.': 'inactive',
  'This promo code has expired.': 'expired',
  'This promo code has reached its usage limit.': 'limit',
  'This promo code is no longer available or has reached its usage limit.': 'unavailable',
  'This product is already discounted, so a promo code cannot be applied to it.': 'discounted',
  'ეს პრომო კოდი არ ვრცელდება არჩეულ პროდუქტზე': 'mismatch',
};

const PROMO_ERRORS: Record<string, Record<string, string>> = {
  ka: {
    invalid: 'პრომო კოდი არასწორია.',
    inactive: 'ეს პრომო კოდი აღარ არის აქტიური.',
    expired: 'ამ პრომო კოდს ვადა გაუვიდა.',
    limit: 'ამ პრომო კოდის გამოყენების ლიმიტი ამოწურულია.',
    unavailable: 'ეს პრომო კოდი აღარ არის ხელმისაწვდომი ან ლიმიტი ამოწურულია.',
    discounted: 'ეს პროდუქტი უკვე ფასდაკლებულია, ამიტომ პრომო კოდი მასზე არ ვრცელდება.',
    mismatch: 'ეს პრომო კოდი არ ვრცელდება არჩეულ პროდუქტზე',
  },
  en: {
    invalid: 'Invalid promo code.',
    inactive: 'This promo code is no longer active.',
    expired: 'This promo code has expired.',
    limit: 'This promo code has reached its usage limit.',
    unavailable: 'This promo code is no longer available or has reached its usage limit.',
    discounted: 'This product is already discounted, so a promo code cannot be applied to it.',
    mismatch: 'This promo code does not apply to the selected product.',
  },
  az: {
    invalid: 'Promo kod yanlışdır.',
    inactive: 'Bu promo kod artıq aktiv deyil.',
    expired: 'Bu promo kodun müddəti bitib.',
    limit: 'Bu promo kodun istifadə limiti dolub.',
    unavailable: 'Bu promo kod artıq mövcud deyil və ya limiti dolub.',
    discounted: 'Bu məhsul artıq endirimdədir, ona görə promo kod tətbiq edilə bilməz.',
    mismatch: 'Bu promo kod seçilmiş məhsula aid deyil.',
  },
  de: {
    invalid: 'Ungültiger Promo-Code.',
    inactive: 'Dieser Promo-Code ist nicht mehr aktiv.',
    expired: 'Dieser Promo-Code ist abgelaufen.',
    limit: 'Dieser Promo-Code hat sein Nutzungslimit erreicht.',
    unavailable: 'Dieser Promo-Code ist nicht mehr verfügbar oder hat sein Limit erreicht.',
    discounted: 'Dieses Produkt ist bereits reduziert, daher kann kein Promo-Code angewendet werden.',
    mismatch: 'Dieser Promo-Code gilt nicht für das ausgewählte Produkt.',
  },
  es: {
    invalid: 'Código promocional no válido.',
    inactive: 'Este código promocional ya no está activo.',
    expired: 'Este código promocional ha caducado.',
    limit: 'Este código promocional ha alcanzado su límite de usos.',
    unavailable: 'Este código promocional ya no está disponible o ha alcanzado su límite.',
    discounted: 'Este producto ya tiene descuento, por lo que no se puede aplicar un código promocional.',
    mismatch: 'Este código promocional no se aplica al producto seleccionado.',
  },
  fr: {
    invalid: 'Code promo invalide.',
    inactive: "Ce code promo n'est plus actif.",
    expired: 'Ce code promo a expiré.',
    limit: "Ce code promo a atteint sa limite d'utilisation.",
    unavailable: "Ce code promo n'est plus disponible ou a atteint sa limite.",
    discounted: 'Ce produit est déjà en promotion, un code promo ne peut donc pas être appliqué.',
    mismatch: "Ce code promo ne s'applique pas au produit sélectionné.",
  },
  hy: {
    invalid: 'Պրոմո կոդը սխալ է։',
    inactive: 'Այս պրոմո կոդն այլևս ակտիվ չէ։',
    expired: 'Այս պրոմո կոդի ժամկետը լրացել է։',
    limit: 'Այս պրոմո կոդի օգտագործման սահմանաչափը սպառվել է։',
    unavailable: 'Այս պրոմո կոդն այլևս հասանելի չէ կամ սահմանաչափը սպառվել է։',
    discounted: 'Այս ապրանքն արդեն զեղչված է, ուստի պրոմո կոդ կիրառել հնարավոր չէ։',
    mismatch: 'Այս պրոմո կոդը չի վերաբերում ընտրված ապրանքին։',
  },
  tr: {
    invalid: 'Promosyon kodu geçersiz.',
    inactive: 'Bu promosyon kodu artık aktif değil.',
    expired: 'Bu promosyon kodunun süresi doldu.',
    limit: 'Bu promosyon kodunun kullanım limiti doldu.',
    unavailable: 'Bu promosyon kodu artık kullanılamıyor veya limiti doldu.',
    discounted: 'Bu ürün zaten indirimli, bu nedenle promosyon kodu uygulanamaz.',
    mismatch: 'Bu promosyon kodu seçilen ürün için geçerli değil.',
  },
  uk: {
    invalid: 'Недійсний промокод.',
    inactive: 'Цей промокод більше не активний.',
    expired: 'Термін дії цього промокоду минув.',
    limit: 'Ліміт використання цього промокоду вичерпано.',
    unavailable: 'Цей промокод більше не доступний або його ліміт вичерпано.',
    discounted: 'Цей товар уже зі знижкою, тому промокод до нього не застосовується.',
    mismatch: 'Цей промокод не діє для вибраного товару.',
  },
};

function activeLocale(fallback: string): string {
  try {
    const locale = Router.locale;
    if (locale && PROMO_ERRORS[locale]) return locale;
  } catch {
    // No router yet (SSR / tests): use the caller's language.
  }
  return PROMO_ERRORS[fallback] ? fallback : 'en';
}

export function localizePromoError(message: string | undefined, lang: string): string | undefined {
  if (!message) return message;
  const key = PROMO_ERROR_KEYS[message];
  if (!key) return message;
  return PROMO_ERRORS[activeLocale(lang)][key] ?? message;
}

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
      setError(localizePromoError(err?.response?.data?.message, lang) ?? t.invalid);
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
