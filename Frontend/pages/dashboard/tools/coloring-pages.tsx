import DigitalToolAccessGate from '../../../src/components/tools/DigitalToolAccessGate';
/**
 * /dashboard/tools/coloring-pages — AI coloring-page generator.
 * Type a topic -> backend checks it is kid-safe, draws it with Azure
 * gpt-image-2, checks the image, and returns a printable page. Credits
 * (1 free page, then packs bought via BOG) are handled server-side; see
 * Backend/src/services/coloringPages/. UI pieces: src/components/tools/coloringPages/.
 */
import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Palette, Sparkles, Loader2, ShieldCheck, Gift, Coins } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import ToolErrorBoundary from '../../../src/components/common/ToolErrorBoundary';
import ToolShell, { ToolPageHeader, ToolChip, toolPrimaryButton, toolSecondaryButton } from '../../../src/components/tools/ToolShell';
import ColoringPageCard from '../../../src/components/tools/coloringPages/ColoringPageCard';
import { coloringStrings } from '../../../src/components/tools/coloringPages/strings';
import { resolveLocale } from '@/src/utils/locale';
import { ColoringState, getColoringState, generateColoringPage, buyColoringPack } from '../../../src/services/coloringPagesService';

function ColoringPagesTool() {
  const router = useRouter();
  const t = coloringStrings(router.locale);
  const [state, setState] = useState<ColoringState | null>(null);
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getColoringState().then(setState).catch(() => setError(t.errors.GENERIC));
  }, [t.errors.GENERIC]);

  useEffect(() => {
    load();
  }, [load]);

  const canGenerate = !!state && (state.includedAccess || state.freeAvailable || state.balance > 0);

  const onGenerate = async () => {
    const clean = topic.trim();
    if (clean.length < 2) {
      setError(t.errors.INVALID_TOPIC);
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const res = await generateColoringPage(clean);
      setState((s) => (s ? { ...s, balance: res.balance, freeAvailable: res.freeAvailable, pages: [res.page, ...s.pages] } : s));
      setTopic('');
    } catch (err: any) {
      const code = err?.response?.data?.code as keyof typeof t.errors | undefined;
      const reason = err?.response?.data?.reason as string | null | undefined;
      let msg = (code && t.errors[code]) || t.errors.GENERIC;
      if (code === 'BLOCKED' && reason && t.reasons[reason]) msg += ` ${t.reasonPrefix} ${t.reasons[reason]}.`;
      setError(msg);
      if (code === 'NO_CREDITS') load();
    } finally {
      setGenerating(false);
    }
  };

  const onBuy = async (packId: string) => {
    setBuying(packId);
    setError(null);
    try {
      const { redirectUrl } = await buyColoringPack(packId, resolveLocale(router.locale), promoCode.trim() || undefined);
      if (redirectUrl) window.location.href = redirectUrl;
      else { setBuying(null); load(); }
    } catch (err) {
      // A rejected promo / gift card code comes back as a readable 400 message.
      const message = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
      setError(message?.status === 400 && message.data?.message ? message.data.message : t.errors.PAYMENT);
      setBuying(null);
    }
  };

  const chips = state ? (
    <>
      {!state.includedAccess && state.freeAvailable && <ToolChip tone="success" icon={Gift}>{t.freeChip}</ToolChip>}
      <ToolChip tone="brand" icon={Coins}>{state.includedAccess ? (router.locale === 'ka' ? 'წვდომა აქტიურია' : 'Access included') : t.creditsChip(state.balance)}</ToolChip>
    </>
  ) : null;

  return (
    <ToolShell>
      <Head>
        <title>{`${t.title} | CDC`}</title>
      </Head>
      <ToolPageHeader icon={Palette} accent="emerald" title={t.title} subtitle={t.subtitle} chips={chips} />

      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 md:p-6 shadow-sm">
        <label htmlFor="coloring-topic" className="block text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">{t.topicLabel}</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="coloring-topic"
            type="text"
            value={topic}
            maxLength={state?.limits.topicMaxLength ?? 200}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !generating && canGenerate) onGenerate();
            }}
            placeholder={t.topicPlaceholder}
            disabled={generating}
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button type="button" className={toolPrimaryButton} disabled={generating || !canGenerate} onClick={onGenerate}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? t.generating : t.generate}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">{t.examplesLabel}</span>
          {t.examples.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={generating}
              onClick={() => setTopic(ex)}
              className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 cursor-pointer hover:border-cyan-400"
            >
              {ex}
            </button>
          ))}
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" /> {t.rules}
        </p>
        {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
      </section>

      {state && !state.includedAccess && (
        <section className="mt-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 md:p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">{t.buyTitle}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t.buySubtitle}</p>
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder={t.promoPlaceholder}
            aria-label={t.promoPlaceholder}
            disabled={!!buying}
            className="mb-4 w-full max-w-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {state.packs.map((p) => (
              <div key={p.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col">
                <span className="text-base font-black text-slate-900 dark:text-white">{t.pagesLabel(p.credits)}</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white mt-1">{(p.priceTetri / 100).toFixed(0)} ₾</span>
                <span className="text-xs text-slate-500 mb-3">{t.perPage((p.priceTetri / 100 / p.credits).toFixed(2))}</span>
                <button type="button" className={`${toolSecondaryButton} mt-auto`} disabled={!!buying} onClick={() => onBuy(p.id)}>
                  {buying === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {buying === p.id ? t.redirecting : t.buy}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">{t.myPages}</h2>
        {!state ? (
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        ) : state.pages.length === 0 ? (
          <p className="text-sm text-slate-500">{t.empty}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {state.pages.map((p) => (
              <ColoringPageCard key={p.id} page={p} t={t} onDeleted={(id) => setState((s) => (s ? { ...s, pages: s.pages.filter((x) => x.id !== id) } : s))} />
            ))}
          </div>
        )}
      </section>
    </ToolShell>
  );
}

export default function ColoringPagesPage() {
  return (
    <ProtectedRoute>
      <ToolErrorBoundary>
        <DigitalToolAccessGate toolKey="coloring-pages"><ColoringPagesTool /></DigitalToolAccessGate>
      </ToolErrorBoundary>
    </ProtectedRoute>
  );
}
