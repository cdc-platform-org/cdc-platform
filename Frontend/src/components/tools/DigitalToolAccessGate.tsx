// Client-side companion to each AI tool's backend gate
// (requireDigitalToolAccess in Backend services/marketplace/digitalToolAccessService.ts).
// The backend is what enforces access; this decides what to render:
//   - access  -> the tool (plus a slim trial banner with a Buy button while on trial),
//   - no access -> AiToolPaywall (trial + direct purchase with promo code),
//   - a tool API call answering 403 { paywall } mid-session -> re-check and
//     switch to the paywall, so a used-up trial is never a dead end.
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Gift, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import ToolShell, { ToolPageHeader, ToolAccent, toolPrimaryButton } from './ToolShell';
import AiToolPaywall from './paywall/AiToolPaywall';
import { isAiToolKey } from './paywall/toolMeta';
import { useAiToolsCopy, formatDate } from '../../content/aiTools';
import {
  getAiToolSubscriptionState, TOOL_PAYWALL_EVENT,
  type AiToolSubscriptionState, type ToolPaywallEventDetail,
} from '../../services/aiToolSubscriptionService';

interface GateProps {
  toolKey: string;
  children: ReactNode;
  /** Tool name/icon so the checking state keeps the tool's own header. */
  toolTitle?: ReactNode;
  toolSubtitle?: ReactNode;
  toolIcon?: LucideIcon;
  accent?: ToolAccent;
  /** The page draws its own site header/footer (studios): skip ToolShell. */
  bare?: boolean;
}

// PER_BOOK tools are paid per item at their own checkout, so "Buy" means
// "enter the tool". Remembered for the browser session only.
const continueKey = (toolKey: string) => `cdc-tool-continue:${toolKey}`;
function readContinue(toolKey: string): boolean {
  try { return typeof window !== 'undefined' && sessionStorage.getItem(continueKey(toolKey)) === '1'; } catch { return false; }
}

export default function DigitalToolAccessGate({ toolKey, children, toolTitle, toolSubtitle, toolIcon, accent, bare }: GateProps) {
  const Shell = bare ? BareShell : ToolShell;
  const router = useRouter();
  const copy = useAiToolsCopy(router.locale);
  const [access, setAccess] = useState<AiToolSubscriptionState | null>(null);
  const [failed, setFailed] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [continued, setContinued] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setFailed(false);
    getAiToolSubscriptionState(toolKey)
      .then(state => { if (!cancelled) { setAccess(state); if (state.allowed) setShowPaywall(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [toolKey]);

  useEffect(() => { setContinued(readContinue(toolKey)); return load(); }, [toolKey, load]);

  useEffect(() => {
    const onPaywall = (event: Event) => {
      const detail = (event as CustomEvent<ToolPaywallEventDetail>).detail;
      if (detail?.toolKey === toolKey) { setShowPaywall(true); load(); }
    };
    window.addEventListener(TOOL_PAYWALL_EVENT, onPaywall);
    return () => window.removeEventListener(TOOL_PAYWALL_EVENT, onPaywall);
  }, [toolKey, load]);

  const header = toolTitle && toolIcon ? <ToolPageHeader icon={toolIcon} accent={accent} title={toolTitle} subtitle={toolSubtitle} /> : null;

  if (failed) return (
    <Shell>
      {header}
      <div role="alert" className="rounded-card border border-cdc-border bg-cdc-surface px-6 py-12 text-center shadow-card">
        <p className="text-sm text-cdc-muted">{copy?.ui.error ?? '…'}</p>
        <button type="button" onClick={load} className={`${toolPrimaryButton} mt-4`}>{copy?.ui.retry ?? 'Retry'}</button>
      </div>
    </Shell>
  );

  if (!access || !copy) return (
    <Shell>
      {header}
      <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-cdc-muted">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />{copy?.ui.checking ?? ''}
      </p>
    </Shell>
  );

  const perItem = access.pricing.model === 'PER_BOOK';
  const enterAnyway = perItem && continued && access.lockedReason !== 'TRIAL_LIMIT_REACHED';
  if ((access.allowed || enterAnyway) && !showPaywall) {
    const onTrial = access.source === 'TRIAL' || access.source === 'LEGACY_TRIAL';
    const t = copy.ui;
    const remaining = access.trial.unit && access.source === 'TRIAL' ? copy.units[access.trial.unit](access.trial.remaining) : '';
    return (
      <>
        {onTrial && (
          <div className="no-print border-b border-cdc-primary/20 bg-cdc-primary-soft" data-testid="trial-banner">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
              <p className="flex items-center gap-2 text-sm font-semibold text-cdc-ink">
                <Gift className="w-4 h-4 text-cdc-primary-ink" aria-hidden />
                {remaining ? t.trialActive(remaining, formatDate(copy, access.accessEndsAt)) : `${t.trialActiveShort} · ${formatDate(copy, access.accessEndsAt)}`}
              </p>
              <button type="button" onClick={() => setShowPaywall(true)} className="rounded-lg bg-cdc-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-cdc-primary-hover">{t.buyNow}</button>
            </div>
          </div>
        )}
        {children}
      </>
    );
  }

  if (!isAiToolKey(toolKey)) return <Shell>{header}</Shell>;
  return (
    <AiToolPaywall
      toolKey={toolKey}
      copy={copy}
      // While on trial the Buy banner opens the paywall over a still-valid
      // access; show it as a plain purchase screen.
      access={access.allowed ? { ...access, lockedReason: 'TOOL_LOCKED', trial: { ...access.trial, state: 'NOT_OFFERED' } } : access}
      onRefresh={load}
      bare={bare}
      onClose={access.allowed ? () => setShowPaywall(false) : undefined}
      closeLabel={copy.ui.openTool}
      onContinue={perItem ? () => {
        try { sessionStorage.setItem(continueKey(toolKey), '1'); } catch { /* private mode: state only */ }
        setContinued(true); setShowPaywall(false);
      } : undefined}
    />
  );
}

function BareShell({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
