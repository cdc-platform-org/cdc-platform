// Paywall shown when a logged-in user opens an AI tool without access:
// tool name + rich description, the free 3-day trial (if unused) and a
// direct purchase with promo / gift card code. Never asks for admin approval.
// Pricing models: MONTHLY (30-day purchase), PER_BOOK (children's book, paid
// at the book's own checkout) and CREDIT_PACKS (coloring pages).
// Access state comes from DigitalToolAccessGate; copy from src/content/aiTools.
import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, CreditCard, Gift, Loader2, Lock, ShieldCheck } from 'lucide-react';
import ToolShell, { ToolIconTile, toolPrimaryButton, toolSecondaryButton } from '../ToolShell';
import PromoCodeField from '../../shared/PromoCodeField';
import type { PromoValidationResult } from '../../../services/paymentService';
import {
  checkoutAiToolSubscription, checkoutColoringPack, startAiToolTrial,
  type AiToolSubscriptionState,
} from '../../../services/aiToolSubscriptionService';
import type { AiToolKey, AiToolsLocale } from '../../../content/aiTools';
import { formatDate, formatGel } from '../../../content/aiTools';
import { AI_TOOL_META, TIME_ONLY_TRIAL_TOOLS } from './toolMeta';

// Same pack table as Backend services/coloringPages/coloringPacks.ts; the
// server always re-prices, this only labels the buttons.
const COLORING_PACKS = [
  { id: 'pack-10', credits: 10, priceTetri: 500 },
  { id: 'pack-30', credits: 30, priceTetri: 1200 },
  { id: 'pack-100', credits: 100, priceTetri: 3000 },
];

interface Props {
  toolKey: AiToolKey;
  copy: AiToolsLocale;
  access: AiToolSubscriptionState;
  /** Re-check access after a trial start or a fully discounted purchase. */
  onRefresh: () => void;
  /** PER_BOOK tools: enter the tool and pay per item at its own checkout. */
  onContinue?: () => void;
  /** Shown while the user still has (trial) access: go back to the tool. */
  onClose?: () => void;
  closeLabel?: string;
  /** Render without ToolShell (the page already draws the site header). */
  bare?: boolean;
}

function errorMessage(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function AiToolPaywall({ toolKey, copy, access, onRefresh, onContinue, onClose, closeLabel, bare }: Props) {
  const router = useRouter();
  const lang = router.locale || 'ka';
  const promoLang: 'ka' | 'en' = lang === 'ka' ? 'ka' : 'en';
  const t = copy.ui;
  const tool = copy.tools[toolKey];
  const meta = AI_TOOL_META[toolKey];
  const { trial, pricing } = access;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promo, setPromo] = useState<PromoValidationResult | null>(null);
  const [packId, setPackId] = useState(COLORING_PACKS[0].id);
  useEffect(() => { setPromo(null); }, [packId]);

  const unitLabel = (n: number) => (trial.unit ? copy.units[trial.unit](n) : '');
  const trialAmount = !TIME_ONLY_TRIAL_TOOLS.has(toolKey) && trial.cap ? unitLabel(trial.cap) : '';

  const start = async () => {
    setBusy('trial'); setError(null);
    try { await startAiToolTrial(toolKey); onRefresh(); }
    catch (err) { setError(errorMessage(err, t.error)); setBusy(null); }
  };

  const buy = async () => {
    setBusy('buy'); setError(null);
    try {
      const result = pricing.model === 'CREDIT_PACKS'
        ? await checkoutColoringPack(packId, lang, promo?.code)
        : await checkoutAiToolSubscription(toolKey, lang, promo?.code);
      if (result.redirectUrl) { window.location.assign(result.redirectUrl); return; }
      // Fully covered by a code, or already included: access is live now.
      setBusy(null); onRefresh();
    } catch (err) { setError(errorMessage(err, t.error)); setBusy(null); }
  };

  // Headline explains WHY the paywall is shown — the trial cap, the trial
  // end, the end of course access — so it is never a silent lock.
  let headline = t.lockedTitle(tool.name);
  let body = t.lockedBody;
  let Icon = Lock;
  if (access.lockedReason === 'TRIAL_LIMIT_REACHED') { headline = t.limitTitle; body = t.limitBody(trialAmount || unitLabel(trial.cap)); Icon = AlertCircle; }
  else if (access.lockedReason === 'TRIAL_EXPIRED' && trial.endsAt) { headline = t.expiredTitle; body = t.expiredBody; Icon = Clock; }
  else if (access.collegeAccessEnded) { body = t.courseEnded; }

  const selectedPack = COLORING_PACKS.find(p => p.id === packId) ?? COLORING_PACKS[0];
  const listPrice = pricing.model === 'CREDIT_PACKS' ? selectedPack.priceTetri : pricing.priceMinor ?? 0;
  const promoTargetId = pricing.model === 'CREDIT_PACKS' ? `coloring-pages:${packId}` : toolKey;

  const Frame = bare ? BareFrame : ToolShell;
  return (
    <Frame>
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr] items-start" data-testid="ai-tool-paywall">
        <section className="rounded-card border border-cdc-border bg-cdc-surface p-6 md:p-8 shadow-card">
          <div className="flex items-start gap-4">
            <ToolIconTile icon={meta.icon} accent={meta.accent} size="lg" />
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-cdc-ink" style={{ lineHeight: 1.3 }}>{tool.name}</h1>
              <p className="mt-1.5 text-sm md:text-[15px] text-cdc-muted leading-relaxed">{tool.tagline}</p>
            </div>
          </div>
          <div role="status" className="mt-6 flex items-start gap-3 rounded-xl border border-cdc-primary/20 bg-cdc-primary-soft px-4 py-3">
            <Icon className="w-5 h-5 mt-0.5 shrink-0 text-cdc-primary-ink" aria-hidden />
            <div>
              <p className="text-sm font-extrabold text-cdc-ink">{headline}</p>
              <p className="text-sm text-cdc-muted leading-relaxed">{body}</p>
            </div>
          </div>
          <p className="mt-6 text-[15px] text-cdc-ink leading-relaxed">{tool.description}</p>
          <h2 className="mt-6 text-xs font-black uppercase tracking-wider text-cdc-muted">{t.whatYouGet}</h2>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {tool.features.map(feature => (
              <li key={feature} className="flex items-start gap-2 text-sm text-cdc-ink">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />{feature}
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-4">
          {trial.state === 'AVAILABLE' && (
            <div className="rounded-card border border-cdc-border bg-cdc-surface p-5 shadow-card">
              <p className="flex items-center gap-2 text-sm font-black text-cdc-ink"><Gift className="w-4 h-4 text-cdc-primary-ink" aria-hidden />{t.trialTitle}</p>
              <p className="mt-1 text-sm text-cdc-muted">{trialAmount ? t.trialIncludes(trial.days, trialAmount) : t.trialIncludes(trial.days, '').replace(/ · .*$/, '')}</p>
              <button type="button" onClick={start} disabled={!!busy} className={`${toolPrimaryButton} mt-4 w-full`} data-testid="start-trial">
                {busy === 'trial' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Gift className="w-4 h-4" aria-hidden />}
                {busy === 'trial' ? t.startingTrial : t.startTrial}
              </button>
              <p className="mt-2 text-[11px] text-cdc-muted">{t.trialNoCard}</p>
            </div>
          )}
          {trial.state !== 'AVAILABLE' && trial.state !== 'NOT_OFFERED' && access.lockedReason === 'TOOL_LOCKED' && (
            <p className="text-xs text-cdc-muted px-1">{t.trialUsed}</p>
          )}

          <div className="rounded-card border border-cdc-border bg-cdc-surface p-5 shadow-card">
            <p className="flex items-center gap-2 text-sm font-black text-cdc-ink"><CreditCard className="w-4 h-4 text-cdc-primary-ink" aria-hidden />{pricing.model === 'CREDIT_PACKS' ? t.packsTitle : t.buyTitle}</p>

            {pricing.model === 'PER_BOOK' && pricing.priceMinor != null && (
              <>
                <p className="mt-2 text-2xl font-black text-cdc-ink">{formatGel(copy, pricing.priceMinor)} <span className="text-sm font-bold text-cdc-muted">{t.perBookFrom}</span></p>
                {pricing.maxPriceMinor != null && <p className="text-xs text-cdc-muted">{t.bookRange(formatGel(copy, pricing.priceMinor), formatGel(copy, pricing.maxPriceMinor))}</p>}
                <button type="button" onClick={onContinue} className={`${trial.state === 'AVAILABLE' ? toolSecondaryButton : toolPrimaryButton} mt-4 w-full`} data-testid="continue-per-book">
                  {t.createBook}<ArrowRight className="w-4 h-4" aria-hidden />
                </button>
                <p className="mt-2 text-[11px] text-cdc-muted leading-relaxed">{t.bookNote}</p>
              </>
            )}

            {(pricing.model === 'MONTHLY' || pricing.model === 'CREDIT_PACKS') && (
              <>
                {pricing.model === 'CREDIT_PACKS' && (
                  <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.packsTitle}>
                    {COLORING_PACKS.map(pack => (
                      <button key={pack.id} type="button" role="radio" aria-checked={pack.id === packId} onClick={() => setPackId(pack.id)}
                        className={`rounded-xl border px-2 py-2.5 text-center transition-colors ${pack.id === packId ? 'border-cdc-primary bg-cdc-primary-soft' : 'border-cdc-border hover:border-cdc-primary/40'}`}>
                        <span className="block text-xs font-bold text-cdc-muted">{t.packCredits(pack.credits)}</span>
                        <span className="block text-sm font-black text-cdc-ink">{formatGel(copy, pack.priceTetri)}</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-2xl font-black text-cdc-ink">
                  {promo ? <><span className="mr-2 text-lg text-cdc-muted line-through">{formatGel(copy, listPrice)}</span>{formatGel(copy, promo.discountedAmount)}</> : formatGel(copy, listPrice)}
                  {pricing.model === 'MONTHLY' && pricing.periodDays && <span className="ml-1 text-sm font-bold text-cdc-muted">{t.perPeriod(pricing.periodDays)}</span>}
                </p>
                <div className="mt-3">
                  <PromoCodeField targetType="AI_TOOL" targetId={promoTargetId} lang={promoLang} labels={t.promo} applied={promo} onChange={setPromo} disabled={!!busy} />
                </div>
                <button type="button" onClick={buy} disabled={!!busy} className={`${trial.state === 'AVAILABLE' ? toolSecondaryButton : toolPrimaryButton} mt-3 w-full`} data-testid="buy-tool">
                  {busy === 'buy' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <CreditCard className="w-4 h-4" aria-hidden />}
                  {busy === 'buy' ? t.redirecting : promo ? t.payDiscounted(formatGel(copy, promo.discountedAmount)) : pricing.model === 'CREDIT_PACKS' ? `${t.buyPack} — ${formatGel(copy, listPrice)}` : t.buyMonthly}
                </button>
                <p className="mt-2 flex items-start gap-1.5 text-[11px] text-cdc-muted leading-relaxed">
                  <ShieldCheck className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden />{pricing.model === 'CREDIT_PACKS' ? t.packNote : t.noAutoRenew}
                </p>
              </>
            )}
            {error && <p role="alert" className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
          </div>
          {onClose && <button type="button" onClick={onClose} className={`${toolSecondaryButton} w-full`}>{closeLabel ?? tool.name}</button>}
          {access.collegeAccessEndsAt && access.collegeAccess && <p className="text-xs text-emerald-700 dark:text-emerald-400 px-1">{t.includedByCourse(formatDate(copy, access.collegeAccessEndsAt))}</p>}
        </aside>
      </div>
    </Frame>
  );
}

function BareFrame({ children }: { children: ReactNode }) {
  return <div className="text-cdc-ink">{children}</div>;
}
