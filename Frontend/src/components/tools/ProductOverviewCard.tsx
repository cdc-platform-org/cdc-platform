import { LucideIcon, CheckCircle2, Sparkles, Coins } from 'lucide-react';
import { SupportedLocale } from '../../utils/locale';

const dictBase = {
  ka: {
    whatYouGet: 'რას იღებთ',
    whyGameChanger: 'რატომ არის გარდამტეხი',
    keyBenefits: 'ძირითადი უპირატესობები',
    pricing: 'გამჭვირვალე ფასდაკლება',
    integration: '3-ნაბიჯიანი ინტეგრაცია',
  },
  en: {
    whatYouGet: 'What You Get',
    whyGameChanger: "Why It's a Game-Changer",
    keyBenefits: 'Key Benefits',
    pricing: 'Transparent Pricing',
    integration: '3-Step Integration',
  },
};

// English fallback for locales without a translation yet.
const dict: Record<SupportedLocale, typeof dictBase.en> = {
  ...dictBase,
  de: dictBase.en,
  es: dictBase.en,
  fr: dictBase.en,
  uk: dictBase.en,
};

export interface ProductOverviewPricing {
  trialLabel: string;
  baseFeeLabel: string;
  usageLabel: string;
}

export interface ProductOverviewCardProps {
  lang: SupportedLocale;
  icon: LucideIcon;
  title: string;
  tagline: string;
  whatYouGet: string;
  whyGameChanger: readonly string[];
  keyBenefits: readonly { icon: LucideIcon; label: string }[];
  pricing: ProductOverviewPricing;
  // Omitted for a not-yet-launched product — there's nothing to integrate yet.
  integrationSteps?: readonly string[];
}

// Standardized product detail layout — used both inline (Dashboard > My
// Tools) and inside a modal shell (/tools "Learn More"). Deliberately no
// modal chrome of its own (no overlay/close button) so each call site
// controls its own presentation.
export default function ProductOverviewCard({
  lang,
  icon: Icon,
  title,
  tagline,
  whatYouGet,
  whyGameChanger,
  keyBenefits,
  pricing,
  integrationSteps,
}: ProductOverviewCardProps) {
  const t = dict[lang];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-black tracking-wide">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{tagline}</p>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-2">{t.whatYouGet}</h4>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{whatYouGet}</p>
      </div>

      <div>
        <h4 className="text-xs font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-2">{t.whyGameChanger}</h4>
        <ul className="space-y-2">
          {whyGameChanger.map((point) => (
            <li key={point} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
              {point}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="text-xs font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-2">{t.keyBenefits}</h4>
        <ul className="grid sm:grid-cols-2 gap-2.5">
          {keyBenefits.map(({ icon: BenefitIcon, label }) => (
            <li key={label} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <BenefitIcon className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      {integrationSteps && integrationSteps.length > 0 && (
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-2">{t.integration}</h4>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            {integrationSteps.map((step, i) => (
              <span key={step} className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1.5">{step}</span>
                {i < integrationSteps.length - 1 && <span className="text-slate-300 dark:text-slate-600">→</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-5">
        <h4 className="text-xs font-black uppercase tracking-widest text-cyan-700 dark:text-cyan-400 mb-3 flex items-center gap-1.5">
          <Coins className="w-3.5 h-3.5" />
          {t.pricing}
        </h4>
        <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            {pricing.trialLabel}
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            {pricing.baseFeeLabel}
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            {pricing.usageLabel}
          </li>
        </ul>
      </div>
    </div>
  );
}
