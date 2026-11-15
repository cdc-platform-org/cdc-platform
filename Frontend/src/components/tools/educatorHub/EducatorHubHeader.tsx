/**
 * Educator Hub page header: title, VIP status / upgrade CTA and usage meters.
 */
import { ToolChip, ToolPageHeader } from '../ToolShell';
import { Crown, Loader2, Sparkles } from 'lucide-react';
import ToolGuideButton from '../ToolGuideButton';
import ToolMediaBanner from '../ToolMediaBanner';
import AiToolCheckoutCard from '../AiToolCheckoutCard';
import { checkoutEducatorVip } from '../../../services/paymentService';
import { EducatorHubState, EducatorUsage } from '../../../services/educatorHubService';
import type { TFunction } from 'i18next';
import { UsageMeter } from './educatorHubShared';

interface EducatorHubHeaderProps {
  t: TFunction<"educatorHub", undefined>;
  hubState: EducatorHubState | null;
  stateLoading: boolean;
  stateError: boolean;
  hasAccess: boolean;
  trialStarting: boolean;
  handleStartTrial: () => Promise<void>;
  lang: "ka" | "en";
  refreshState: () => Promise<void>;
  trialError: string | null;
  usage: EducatorUsage | null | undefined;
}

export default function EducatorHubHeader({
  t,
  hubState,
  stateLoading,
  stateError,
  hasAccess,
  trialStarting,
  handleStartTrial,
  lang,
  refreshState,
  trialError,
  usage,
}: EducatorHubHeaderProps) {
  return (
    <>
        <div className="mb-8 no-print">
          <ToolPageHeader
            icon={Sparkles}
            accent="amber"
            title={t('pageTitle')}
            subtitle={t('pageSubtitle')}
            chips={
              <>
                <ToolChip tone="vip" icon={Crown}>{t('vipBadge', 'VIP 29 ₾/თვე')}</ToolChip>
                {hubState?.isVipActive && <ToolChip tone="success">{t('vipActiveLabel')}</ToolChip>}
                {!hubState?.isVipActive && hubState?.trialActive && (
                  <ToolChip tone="brand">
                    {t('trialActiveLabel', {
                      days: Math.max(1, Math.ceil((new Date(hubState.educatorVipTrialEndDate ?? 0).getTime() - Date.now()) / (24 * 60 * 60 * 1000))),
                    })}
                  </ToolChip>
                )}
              </>
            }
            actions={<ToolGuideButton guide="educatorHub" />}
          />
          <ToolMediaBanner slug="educator-hub" alt={t('pageTitle')} />

          {!stateLoading && !stateError && !hasAccess && (
            <div className="mt-5 rounded-2xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-5">
              <h3 className="text-sm font-black text-amber-800 dark:text-amber-300 mb-1">{t('vipRequiredTitle')}</h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">{t('vipRequiredDesc')}</p>
              {hubState?.trialAvailable ? (
                <button
                  type="button"
                  disabled={trialStarting}
                  onClick={handleStartTrial}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-60"
                >
                  {trialStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                  {t('trialCta')}
                </button>
              ) : hubState ? (
                <div className="max-w-sm">
                  <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">{t('vipTrialUsedDesc')}</p>
                  <AiToolCheckoutCard
                    lang={lang}
                    priceGel={hubState.priceGel ?? 50}
                    promoTargetId="educator-hub"
                    checkout={(code) => checkoutEducatorVip(lang, code)}
                    onActivated={refreshState}
                  />
                </div>
              ) : null}
              {trialError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">{trialError}</p>}
            </div>
          )}

          {hasAccess && hubState && !hubState.isVipActive && hubState.trialActive && (
            <details className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
              <summary className="cursor-pointer text-sm font-bold text-slate-800 dark:text-slate-100">
                {lang === 'ka' ? 'VIP-ის შეძენა საცდელის დასრულებამდე' : 'Get VIP before your trial ends'}
              </summary>
              <div className="mt-3 max-w-sm">
                <AiToolCheckoutCard lang={lang} priceGel={hubState.priceGel ?? 50} promoTargetId="educator-hub" checkout={(code) => checkoutEducatorVip(lang, code)} onActivated={refreshState} compact />
              </div>
            </details>
          )}

          {hubState?.isVipActive && hubState.educatorVipPaidUntil && (
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              {lang === 'ka' ? 'VIP აქტიურია ' : 'VIP active until '}
              {new Date(hubState.educatorVipPaidUntil).toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-GB')}
              {lang === 'ka' ? '-მდე.' : '.'}
            </p>
          )}

          {hasAccess && usage && (
            <div className="mt-5 flex flex-wrap gap-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
              <UsageMeter label={t('usageMeterGenerationsLabel')} used={usage.generationsUsed} limit={usage.generationsLimit} />
              <UsageMeter label={t('usageMeterGradingsLabel')} used={usage.gradingsUsed} limit={usage.gradingsLimit} />
            </div>
          )}
        </div>
    </>
  );
}
