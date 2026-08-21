import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ShieldCheck, Video, ClipboardCheck, BarChart3 } from 'lucide-react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { getHRSupportQuote } from '../../services/hrSupportService';
import { checkoutHRSupport } from '../../services/paymentService';
import { resolveLocale } from '../../utils/locale';
import { HRSupportQuote } from '../../types/hrSupport';

interface HRSupportRequestModalProps {
  vacancyId: string;
  vacancyTitle: string;
  onClose: () => void;
}

const EN_STRINGS = {
  title: 'Request HR Screening Support',
  scopeHeading: 'What this includes',
  scopeItems: [
    'Detailed screening of up to 10 applications (+50 GEL per candidate beyond 10).',
    'Preparing, sending, and evaluating a technical task.',
    '1-on-1 online interview (Google Meet / Zoom) with each shortlisted candidate.',
    'A comparative analytical report and Top-3 candidate presentation.',
  ],
  loading: 'Calculating price…',
  candidates: (n: number) => `${n} candidate${n !== 1 ? 's' : ''} currently applied`,
  baseFee: 'Base package (up to 10 candidates)',
  extraFee: (n: number) => `Extra candidates (${n} × 50 GEL)`,
  total: 'Total',
  tosLabel:
    'I confirm I am paying for the screening, interview, and analytical report service provided by HR — this service does not guarantee a hire.',
  noCandidates: 'This vacancy has no applicants yet — there is nothing to screen.',
  loadError: 'Unable to load pricing. Please try again.',
  checkoutError: 'Unable to start checkout. Please try again.',
  cancel: 'Cancel',
  pay: 'Pay & Request',
  processing: 'Processing…',
};

const dict = {
  ka: {
    title: 'HR დახმარების მოთხოვნა',
    scopeHeading: 'რას მოიცავს სერვისი',
    scopeItems: [
      '10-მდე კანდიდატის განაცხადის დეტალური გადარჩევა (10+ კანდიდატზე +50 GEL/თითოეულზე).',
      'ტექნიკური დავალების მომზადება, გაგზავნა და შეფასება.',
      '1-on-1 ონლაინ გასაუბრება (Google Meet / Zoom) თითოეულ შერჩეულ კანდიდატთან.',
      'შედარებითი ანალიტიკური რეპორტი და TOP-3 კანდიდატის წარდგენა.',
    ],
    loading: 'ფასდება…',
    candidates: (n: number) => `ამჟამად ${n} კანდიდატი განაცხადებულია`,
    baseFee: 'საბაზისო პაკეტი (10 კანდიდატამდე)',
    extraFee: (n: number) => `დამატებითი კანდიდატები (${n} × 50 GEL)`,
    total: 'ჯამური ღირებულება',
    tosLabel:
      'ვადასტურებ, რომ თანხას ვიხდი HR-ის მიერ გაწეული გადარჩევის, ინტერვიუებისა და ანალიტიკური რეპორტის მომზადების მომსახურებაში. აღნიშნული სერვისი არ წარმოადგენს გარანტირებული თანამშრომლის აყვანის გარანტიას.',
    noCandidates: 'ამ ვაკანსიაზე ჯერ არცერთი განაცხადი არ არის — გადასარჩევი არაფერია.',
    loadError: 'ფასის გამოთვლა ვერ მოხერხდა. სცადეთ თავიდან.',
    checkoutError: 'გადახდის დაწყება ვერ მოხერხდა. სცადეთ თავიდან.',
    cancel: 'გაუქმება',
    pay: 'გადახდა და მოთხოვნა',
    processing: 'მიმდინარეობს…',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

function formatGel(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

export default function HRSupportRequestModal({ vacancyId, vacancyTitle, onClose }: HRSupportRequestModalProps) {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const [quote, setQuote] = useState<HRSupportQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEscapeToClose(true, onClose);

  useEffect(() => {
    let cancelled = false;
    getHRSupportQuote(vacancyId)
      .then((data) => {
        if (!cancelled) setQuote(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(t.loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vacancyId]);

  const handlePay = async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const { redirectUrl } = await checkoutHRSupport(vacancyId, lang === 'ka' ? 'ka' : 'en');
      window.location.href = redirectUrl;
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || t.checkoutError);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="max-w-lg w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-black text-slate-900 dark:text-white mb-1">{t.title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 truncate">{vacancyTitle}</p>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 mb-5">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">{t.scopeHeading}</p>
          <ul className="space-y-2.5">
            {t.scopeItems.map((item, i) => {
              const icons = [ClipboardCheck, ClipboardCheck, Video, BarChart3];
              const Icon = icons[i] ?? ClipboardCheck;
              return (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <Icon className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              );
            })}
          </ul>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 mb-5">{t.loading}</p>
        ) : loadError ? (
          <p className="text-sm text-red-600 dark:text-red-400 mb-5">{loadError}</p>
        ) : quote && quote.candidateCount === 0 ? (
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-5">{t.noCandidates}</p>
        ) : quote ? (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 mb-5 space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.candidates(quote.candidateCount)}</p>
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <span>{t.baseFee}</span>
              <span className="font-bold">{formatGel(quote.baseFee)} GEL</span>
            </div>
            {quote.extraCandidates > 0 && (
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>{t.extraFee(quote.extraCandidates)}</span>
                <span className="font-bold">{formatGel(quote.extraCandidates * quote.extraCandidateFee)} GEL</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-cyan-500/20">
              <span className="text-sm font-black text-slate-900 dark:text-white">{t.total}</span>
              <span className="text-lg font-black text-cyan-600 dark:text-cyan-300">{formatGel(quote.totalFee)} GEL</span>
            </div>
          </div>
        ) : null}

        {quote && quote.candidateCount > 0 && (
          <>
            <label className="flex items-start gap-2.5 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                {t.tosLabel}
              </span>
            </label>

            {submitError && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {submitError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm py-3"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handlePay}
                disabled={!tosAccepted || submitting}
                className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm py-3 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? t.processing : t.pay}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
