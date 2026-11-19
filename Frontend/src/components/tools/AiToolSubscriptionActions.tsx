// Compact price + status block for an AI tool card (Digital Store, studio
// guard). Shows the real price model (30 days / per book / credit packs),
// the caller's status and the free trial. The buttons open the tool page,
// where DigitalToolAccessGate shows the full paywall (trial start, promo /
// gift card code, BOG checkout) — one purchase flow for every entry point.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowRight, Gift, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAiToolSubscriptionCatalog, getAiToolSubscriptionState, type AiToolCatalogEntry, type AiToolSubscriptionState } from '../../services/aiToolSubscriptionService';
import { useAiToolsCopy, formatGel, formatDate } from '../../content/aiTools';
import { TIME_ONLY_TRIAL_TOOLS } from './paywall/toolMeta';

export default function AiToolSubscriptionActions({ toolKey, href }: { toolKey: string; href: string; lang?: 'ka' | 'en' }) {
  const router = useRouter();
  const copy = useAiToolsCopy(router.locale);
  const { isAuthenticated, user } = useAuth();
  const key = toolKey === 'childrensBook' ? 'childrens-book' : toolKey;
  const [entry, setEntry] = useState<AiToolCatalogEntry | null>(null);
  const [state, setState] = useState<AiToolSubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true; setLoading(true); setError(false);
    Promise.all([getAiToolSubscriptionCatalog(), isAuthenticated ? getAiToolSubscriptionState(key).catch(() => null) : Promise.resolve(null)]).then(([catalog, access]) => {
      if (!active) return;
      setEntry(catalog.find(tool => tool.key === key) ?? null); setState(access); setLoading(false);
    }).catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [key, isAuthenticated, user?.id, retry]);

  if (loading || !copy) return <p role="status" className="inline-flex items-center gap-2 text-xs text-cdc-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />{copy?.ui.checking}</p>;
  const t = copy.ui;
  if (error || !entry) return <p role="alert" className="text-xs text-red-600 dark:text-red-400">{t.error} <button type="button" onClick={() => setRetry(v => v + 1)} className="underline">{t.retry}</button></p>;

  const target = href || '#';
  const price = entry.priceMinor != null ? formatGel(copy, entry.priceMinor) : null;
  const trialAvailable = !state || state.trial.state === 'AVAILABLE';
  const trialAmount = entry.trial && entry.trial.cap && !TIME_ONLY_TRIAL_TOOLS.has(key) ? copy.units[entry.trial.unit](entry.trial.cap) : '';
  let statusLine: string | null = null;
  if (state?.allowed && state.source === 'COURSE') statusLine = t.includedByCourse(formatDate(copy, state.collegeAccessEndsAt));
  else if (state?.allowed && state.source === 'PAID' && state.accessEndsAt) statusLine = t.paidUntil(formatDate(copy, state.accessEndsAt));
  else if (state?.allowed && state.source === 'TRIAL' && state.trial.unit) statusLine = t.trialActive(copy.units[state.trial.unit](state.trial.remaining), formatDate(copy, state.accessEndsAt));

  return (
    <div className="mt-4 w-full border-t border-cdc-border pt-4">
      {price && (
        <p className="text-lg font-extrabold text-cdc-ink">
          {entry.model === 'PER_BOOK' || entry.model === 'CREDIT_PACKS' ? `${price} +` : price}{' '}
          <span className="text-[11px] font-normal text-cdc-muted">{entry.model === 'MONTHLY' && entry.periodDays ? t.perPeriod(entry.periodDays) : entry.model === 'PER_BOOK' ? t.perBookFrom : ''}</span>
        </p>
      )}
      {statusLine && <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">{statusLine}</p>}
      {state?.allowed ? (
        <Link href={target} className="learning-primary mt-3 flex w-full items-center justify-center gap-2 no-underline">{t.openTool}<ArrowRight className="h-4 w-4" aria-hidden /></Link>
      ) : (
        <>
          {trialAvailable && entry.trial && (
            <Link href={target} className="learning-primary mt-3 flex w-full items-center justify-center gap-2 no-underline"><Gift className="h-4 w-4" aria-hidden />{t.startTrial}</Link>
          )}
          <Link href={target} className={`${trialAvailable && entry.trial ? 'mt-2 text-xs font-semibold text-cdc-primary-ink underline' : 'learning-primary mt-3 flex w-full items-center justify-center no-underline'}`}>{entry.model === 'PER_BOOK' ? t.createBook : entry.model === 'CREDIT_PACKS' ? t.packsTitle : t.buyMonthly}</Link>
        </>
      )}
      {entry.trial && trialAvailable && <p className="mt-2 text-[10px] leading-relaxed text-cdc-muted">{trialAmount ? t.trialIncludes(entry.trial.days, trialAmount) : t.trialNoCard}</p>}
    </div>
  );
}
