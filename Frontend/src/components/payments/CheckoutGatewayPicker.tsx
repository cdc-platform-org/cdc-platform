/**
 * Checkout payment-method picker shared by every paid checkout (store,
 * courses, live trainings, mentors, IMIAKO PRO).
 *
 * Why it exists: checkout used to pick the gateway from the UI language
 * alone (ka -> BOG/GEL, otherwise Stripe/USD), so a foreigner browsing in
 * Georgian, or a Georgian browsing in English, never saw a choice, and when
 * Stripe was not configured the "USD" path silently fell back to GEL.
 * Now the buyer picks explicitly, and the Stripe option only appears when
 * the backend reports it is enabled (GET /payments/stripe/config).
 *
 * Gateway calls themselves stay in src/services/{payment,stripePayment}Service.ts.
 */
import { useEffect, useState } from 'react';
import { CreditCard, Globe2 } from 'lucide-react';
import { getStripeConfig } from '../../services/stripePaymentService';

export type CheckoutGateway = 'bog' | 'stripe';

const STORAGE_KEY = 'cdc.checkoutGateway';

function readStoredGateway(): CheckoutGateway | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'bog' || v === 'stripe' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Returns the gateway the buyer will pay with. Defaults: Stripe for
 * non-Georgian UI when Stripe is enabled, otherwise BOG. A choice the buyer
 * made earlier wins (remembered per browser).
 */
export function useCheckoutGateway(lang: string) {
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [gateway, setGatewayState] = useState<CheckoutGateway>('bog');

  useEffect(() => {
    let cancelled = false;
    getStripeConfig().then((cfg) => {
      if (cancelled) return;
      setStripeEnabled(cfg.enabled);
      const stored = readStoredGateway();
      if (!cfg.enabled) setGatewayState('bog');
      else setGatewayState(stored ?? (lang === 'ka' ? 'bog' : 'stripe'));
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const setGateway = (g: CheckoutGateway) => {
    setGatewayState(g);
    try {
      window.localStorage.setItem(STORAGE_KEY, g);
    } catch {
      /* private mode: choice just isn't remembered */
    }
  };

  return { gateway, setGateway, stripeEnabled };
}

const copy = {
  ka: {
    title: 'გადახდის მეთოდი',
    bog: 'ქართული ბარათი (ლარი)',
    bogHint: 'საქართველოს ბანკის უსაფრთხო გვერდი. Visa / Mastercard.',
    stripe: 'საერთაშორისო ბარათი (USD)',
    stripeHint: 'უცხოეთში გაცემული Visa, Mastercard, Amex, Stripe-ის უსაფრთხო გვერდით.',
    onlyBog:
      'უცხოეთში გაცემული Visa / Mastercard ბარათითაც შეგიძლიათ გადახდა. თანხა ჩამოიჭრება ლარში და თქვენი ბანკი ავტომატურად გადაიყვანს თქვენს ვალუტაში.',
  },
  en: {
    title: 'Payment method',
    bog: 'Georgian card (GEL)',
    bogHint: 'Secure Bank of Georgia page. Visa / Mastercard.',
    stripe: 'International card (USD)',
    stripeHint: 'Cards issued abroad: Visa, Mastercard, Amex, via secure Stripe checkout.',
    onlyBog:
      'Foreign Visa / Mastercard cards are accepted. You are charged in Georgian lari (GEL) and your bank converts it to your currency automatically.',
  },
};

interface Props {
  lang: string;
  gateway: CheckoutGateway;
  onChange: (g: CheckoutGateway) => void;
  stripeEnabled: boolean;
  disabled?: boolean;
}

export default function CheckoutGatewayPicker({ lang, gateway, onChange, stripeEnabled, disabled }: Props) {
  const t = lang === 'ka' ? copy.ka : copy.en;

  if (!stripeEnabled) {
    return (
      <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Globe2 className="w-4 h-4 shrink-0 mt-px text-cyan-600" aria-hidden />
        <span>{t.onlyBog}</span>
      </p>
    );
  }

  const option = (value: CheckoutGateway, label: string, hint: string, Icon: typeof CreditCard) => {
    const active = gateway === value;
    return (
      <label
        className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 cursor-pointer text-xs transition-colors ${
          active
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
            : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <input
          type="radio"
          name="checkout-gateway"
          value={value}
          checked={active}
          disabled={disabled}
          onChange={() => onChange(value)}
          className="mt-0.5 accent-purple-600"
        />
        <Icon className="w-4 h-4 shrink-0 mt-px text-purple-600" aria-hidden />
        <span>
          <span className="block font-bold text-slate-900 dark:text-white">{label}</span>
          <span className="block text-slate-500 dark:text-slate-400">{hint}</span>
        </span>
      </label>
    );
  };

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t.title}</legend>
      {option('bog', t.bog, t.bogHint, CreditCard)}
      {option('stripe', t.stripe, t.stripeHint, Globe2)}
    </fieldset>
  );
}
