import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { getAiToolSubscriptionCatalog, getAiToolSubscriptionState, checkoutAiToolSubscription, type AiToolSubscriptionState } from '../../services/aiToolSubscriptionService';
import { formatPrice } from '../../utils/coursePricing';
const copy = {
  ka: {
    subscribe: 'გამოწერა', open: 'გახსნა', included: 'სწავლის პერიოდში უფასოა', includedUntil: (d: string) => `კურსის სტუდენტებისთვის უფასოა ${d}-მდე`,
    ended: 'კურსის უფასო წვდომა დასრულდა. ინსტრუმენტით სარგებლობის გასაგრძელებლად გამოიწერე თვიურად.', month: 'თვეში / თითო ინსტრუმენტი', renew: 'გამოწერის გაგრძელება',
    error: 'ვერ შესრულდა მოთხოვნა. სცადე ხელახლა.', retry: 'ხელახლა ცდა', checking: 'წვდომის შემოწმება',
    terms: 'გადახდა გაძლევს 30 დღის წვდომას. გაგრძელება ხდება ახალი გადახდით; თანხა ავტომატურად არ ჩამოიჭრება.',
    bookPrice: '1 ₾ / გვერდი', bookRange: '(5 – 20 ₾ თითო წიგნზე)', bookCta: 'წიგნის შექმნა',
    bookTerms: 'იხდით მხოლოდ არჩეული წიგნის გვერდების მიხედვით (5, 10, 15 ან 20 გვერდი) — გამოწერის გარეშე. მოყვება გახმოვანება და საბეჭდი PDF.',
  },
  en: {
    subscribe: 'Subscribe', open: 'Open tool', included: 'Included while you study', includedUntil: (d: string) => `Free for course students until ${d}`,
    ended: 'Your free course access has ended. Subscribe monthly to keep using this tool.', month: 'per month / per tool', renew: 'Renew subscription',
    error: 'Request failed. Please try again.', retry: 'Try again', checking: 'Checking access',
    terms: 'Each payment provides 30 days of access. Renew with a new payment; your card is not charged automatically.',
    bookPrice: '1 GEL / page', bookRange: '(5 – 20 GEL per book)', bookCta: 'Create a Book',
    bookTerms: 'Pay only per book based on page count (5, 10, 15, or 20 pages) — no monthly subscription required. Includes audio narration & print-ready PDF.',
  },
};
export default function AiToolSubscriptionActions({ toolKey, href, lang }: { toolKey: string; href: string; lang: 'ka' | 'en' }) {
  const t = copy[lang];
  const { isAuthenticated, user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const router = useRouter();
  const [state, setState] = useState<AiToolSubscriptionState | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const isPayPerBook = toolKey === 'childrens-book' || toolKey === 'childrensBook';
  useEffect(() => {
    if (isPayPerBook) { setLoading(false); return; }
    let active = true; setLoading(true); setError(false);
    Promise.all([getAiToolSubscriptionCatalog(), isAuthenticated ? getAiToolSubscriptionState(toolKey) : Promise.resolve(null)]).then(([catalog, access]) => {
      if (!active) return;
      const entry = catalog.find(tool => tool.key === toolKey);
      if (!entry) throw new Error('Unknown subscription tool.');
      setPrice(entry.priceMinor); setState(access); setLoading(false);
    }).catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [toolKey, isAuthenticated, user?.id, retry, isPayPerBook]);
  if (isPayPerBook) {
    return <div className="mt-4 w-full border-t border-cdc-border pt-4">
      <p className="text-lg font-extrabold text-cdc-ink">{t.bookPrice} <span className="text-[11px] font-normal text-cdc-muted">{t.bookRange}</span></p>
      <Link href={href || '/dashboard/tools/childrens-book'} className="learning-primary mt-3 flex w-full items-center justify-center no-underline">{t.bookCta}</Link>
      <p className="mt-2 text-[10px] leading-relaxed text-cdc-muted">{t.bookTerms}</p>
    </div>;
  }
  const subscribe = async () => {
    setBusy(true); setError(false);
    try {
      const result = await checkoutAiToolSubscription(toolKey, lang);
      if (result.enrolled) { await router.push(href); return; }
      if (result.redirectUrl) { window.location.assign(result.redirectUrl); return; }
      throw new Error('Missing checkout redirect.');
    } catch { setError(true); setBusy(false); }
  };
  const buy = () => { if (!isAuthenticated) openAuthModal({ onSuccess: subscribe }); else void subscribe(); };
  if (loading) return <p role="status" className="inline-flex items-center gap-2 text-xs text-cdc-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t.checking}</p>;
  return <div className="mt-4 w-full border-t border-cdc-border pt-4">
    {price !== null && <p className="text-lg font-extrabold text-cdc-ink">{formatPrice(price)} <span className="text-[11px] font-normal text-cdc-muted">{t.month}</span></p>}
    {state?.collegeAccess && <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">{state.collegeAccessEndsAt ? t.includedUntil(new Date(state.collegeAccessEndsAt).toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-GB')) : t.included}</p>}
    {state?.collegeAccessEnded && !state.allowed && <p role="status" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{t.ended}</p>}
    {state?.allowed ? <button type="button" onClick={() => void router.push(href)} className="learning-primary mt-3 w-full">{t.open}</button> : <button type="button" onClick={buy} disabled={busy || price === null} className="learning-primary mt-3 w-full disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{t.subscribe}</button>}
    {state?.subscriptionEndsAt && !state.collegeAccess && <button type="button" onClick={buy} disabled={busy} className="mt-2 text-xs font-semibold text-cdc-primary-ink underline">{t.renew}</button>}
    <p className="mt-2 text-[10px] leading-relaxed text-cdc-muted">{t.terms}</p>
    {error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{t.error} <button type="button" onClick={() => setRetry(value => value + 1)} className="underline">{t.retry}</button></p>}
  </div>;
}
