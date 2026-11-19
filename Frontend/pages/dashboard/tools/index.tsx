import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { Bot, Bug, Sparkles, Calendar, LayoutGrid, Loader2 } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import { useAuth } from '../../../src/context/AuthContext';
import { getAiToolSubscriptionState, AI_TOOL_DESTINATIONS, type AiToolSubscriptionState } from '../../../src/services/aiToolSubscriptionService';
import { useAiToolsCopy, formatDate, type AiToolKey } from '../../../src/content/aiTools';
import { AI_TOOL_META, TIME_ONLY_TRIAL_TOOLS } from '../../../src/components/tools/paywall/toolMeta';
import { resolveLocale } from '@/src/utils/locale';
import ToolShell, { ToolPageHeader, ToolIconTile, ToolChip, ToolLinkButton, toolPrimaryButton, toolSecondaryButton, type ToolAccent, type ToolChipTone } from '@/src/components/tools/ToolShell';
import { listMyIakoAssistants, iakoAssistantHref, MyIakoAssistant } from '../../../src/services/iakoAssistantService';

const EN_STRINGS = {
  title: 'My Tools',
  subtitle: 'All your AI tools and subscriptions in one place.',
  loading: 'Loading…',
  empty: 'No active tools yet. Pick one below to get started.',
  browseCatalog: 'Browse AI Tools',
  manage: 'Manage Tool',
  statusPaused: 'Paused',
  expires: 'Expires',
  cyberSentinel: 'Cyber Sentinel (AG-SAIA)',
  cyberSentinelDesc: 'Sovereign AI security node — launching soon',
  sectionMine: 'My active tools',
  sectionAvailable: 'Available to start',
  sectionSoon: 'Coming soon',
  learnMore: 'Learn more',
  allTools: 'All AI tools',
  iakoDesc: 'AI training mentor', openIako: 'Open IAKO', todayGuide: "Today's Guide", requestsUsed: 'requests used',
};

const dict = {
  ka: {
    title: 'ჩემი ხელსაწყოები',
    subtitle: 'ყველა თქვენი AI ხელსაწყო და გამოწერა ერთ ადგილას.',
    loading: 'იტვირთება…',
    empty: 'ჯერ არცერთი აქტიური ხელსაწყო არ გაქვთ. ქვემოთ აირჩიეთ და დაიწყეთ.',
    browseCatalog: 'AI ხელსაწყოების ნახვა',
    manage: 'მართვა',
    statusPaused: 'შეჩერებული',
    expires: 'სრულდება',
    cyberSentinel: 'Cyber Sentinel (AG-SAIA)',
    cyberSentinelDesc: 'სუვერენული AI უსაფრთხოების კვანძი — მალე გაეშვება',
    sectionMine: 'ჩემი აქტიური ხელსაწყოები',
    sectionAvailable: 'შეგიძლიათ დაიწყოთ',
    sectionSoon: 'მალე',
    learnMore: 'გაიგეთ მეტი',
    allTools: 'ყველა AI ხელსაწყო',
    iakoDesc: 'AI ტრენინგის მენტორი', openIako: 'IAKO-ს გახსნა', todayGuide: 'დღევანდელი გზამკვლევი', requestsUsed: 'მოთხოვნა გამოყენებულია',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

type ToolBadge = 'TRIAL' | 'ACTIVE' | 'INCLUDED' | 'EXPIRED' | 'PAUSED' | 'AVAILABLE' | 'COMING_SOON';

const BADGE_TONE: Record<ToolBadge, ToolChipTone> = {
  TRIAL: 'brand',
  ACTIVE: 'success',
  INCLUDED: 'success',
  EXPIRED: 'danger',
  PAUSED: 'neutral',
  AVAILABLE: 'neutral',
  COMING_SOON: 'warning',
};

interface ToolCardData {
  key: string;
  icon: typeof Bot;
  accent: ToolAccent;
  title: string;
  description: string;
  badge: ToolBadge;
  badgeLabel: string;
  dateLine: string | null;
  manageHref: string;
  actionLabel?: string;
  usageLine?: string;
  guideHref?: string;
  guideLabel?: string;
}

function ToolCard({ tool, manageLabel, learnMoreLabel }: { tool: ToolCardData; manageLabel: string; learnMoreLabel: string }) {
  const soon = tool.badge === 'COMING_SOON';
  const available = tool.badge === 'AVAILABLE';
  return (
    <div className={`rounded-2xl border bg-white dark:bg-slate-900/60 p-5 flex flex-col shadow-sm hover:shadow-md transition-shadow ${soon ? 'border-dashed border-slate-300 dark:border-slate-700' : 'border-slate-200 dark:border-slate-800'}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className={soon ? 'opacity-60' : ''}>
          <ToolIconTile icon={tool.icon} accent={tool.accent} size="sm" />
        </div>
        {!available && <ToolChip tone={BADGE_TONE[tool.badge]}>{tool.badgeLabel}</ToolChip>}
      </div>
      <h3 className="font-black text-base leading-snug text-slate-900 dark:text-white mb-1">{tool.title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 flex-1">{tool.description}</p>
      {tool.dateLine && (
        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3">
          <Calendar className="w-3.5 h-3.5" />
          {tool.dateLine}
        </p>
      )}
      {tool.usageLine && <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{tool.usageLine}</p>}
      {soon ? (
        <Link href={tool.manageHref} className="mt-auto text-sm font-bold text-cyan-700 dark:text-cyan-400 no-underline hover:underline">
          {learnMoreLabel} →
        </Link>
      ) : (
        <Link href={tool.manageHref} className={`mt-auto w-full ${available ? toolSecondaryButton : toolPrimaryButton}`}>
          {tool.actionLabel || manageLabel}
        </Link>
      )}
      {tool.guideHref && <Link href={tool.guideHref} className="mt-2 text-center text-xs font-bold text-cyan-700 dark:text-cyan-300 py-2">{tool.guideLabel}</Link>}
    </div>
  );
}

function ToolSection({ title, cards, manageLabel, learnMoreLabel, empty }: { title: string; cards: ToolCardData[]; manageLabel: string; learnMoreLabel: string; empty?: string }) {
  if (cards.length === 0 && !empty) return null;
  return (
    <section className="mb-10">
      <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">{title}</h2>
      {cards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 px-5 py-6 text-sm text-slate-600 dark:text-slate-400">{empty}</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {cards.map((card) => (
            <ToolCard key={card.key} tool={card} manageLabel={manageLabel} learnMoreLabel={learnMoreLabel} />
          ))}
        </div>
      )}
    </section>
  );
}

// Every AI tool, in catalog order. Status comes from one endpoint
// (/digital-tools/:key/access) so the chips here always match what the
// tool page and its backend decide.
const AI_TOOL_ORDER: AiToolKey[] = [
  'childrens-book', 'english-tutor', 'smart-reader', 'educator-hub', 'chatbot-builder', 'ai-agents',
  'media-studio', 'design-studio', 'code-studio', 'proctoring', 'coloring-pages',
];

function MyToolsContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const copy = useAiToolsCopy(router.locale);
  const { isAuthenticated } = useAuth();

  const [accessByTool, setAccessByTool] = useState<Partial<Record<AiToolKey, AiToolSubscriptionState | null>>>({});
  const [myAssistants, setMyAssistants] = useState<MyIakoAssistant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([
      Promise.all(AI_TOOL_ORDER.map(key => getAiToolSubscriptionState(key).then(state => [key, state] as const).catch(() => [key, null] as const))),
      listMyIakoAssistants().catch(() => []),
    ]).then(([states, assistants]) => {
      setAccessByTool(Object.fromEntries(states));
      setMyAssistants(assistants);
      setLoading(false);
    });
  }, [isAuthenticated]);

  const cards: ToolCardData[] = [];
  const label = (badge: ToolBadge) => copy
    ? { TRIAL: copy.ui.status.trial, ACTIVE: copy.ui.status.active, INCLUDED: copy.ui.status.included, EXPIRED: copy.ui.status.expired, PAUSED: t.statusPaused, AVAILABLE: copy.ui.status.available, COMING_SOON: copy.ui.status.comingSoon }[badge]
    : '';

  if (copy) {
    for (const key of AI_TOOL_ORDER) {
      const state = accessByTool[key];
      const meta = AI_TOOL_META[key];
      const tool = copy.tools[key];
      let badge: ToolBadge = 'AVAILABLE';
      let dateLine: string | null = null;
      let usageLine: string | undefined;
      if (state?.allowed) {
        badge = state.source === 'TRIAL' || state.source === 'LEGACY_TRIAL' ? 'TRIAL' : state.source === 'COURSE' ? 'INCLUDED' : 'ACTIVE';
        const ends = state.source === 'COURSE' ? state.collegeAccessEndsAt : state.accessEndsAt;
        if (ends) dateLine = `${t.expires}: ${formatDate(copy, ends)}`;
        if (state.source === 'TRIAL' && state.trial.unit && !TIME_ONLY_TRIAL_TOOLS.has(key)) usageLine = copy.units[state.trial.unit](state.trial.remaining);
      } else if (state && (state.trial.state === 'EXHAUSTED' || state.trial.state === 'EXPIRED')) {
        badge = 'EXPIRED';
      }
      cards.push({
        key,
        icon: meta.icon,
        accent: meta.accent,
        title: tool.name,
        description: tool.tagline,
        badge,
        // A locked tool whose trial is over says 'Trial ended', not just 'Expired'.
        badgeLabel: badge === 'EXPIRED' ? copy.ui.status.trialEnded : label(badge),
        dateLine,
        usageLine,
        manageHref: AI_TOOL_DESTINATIONS[key] ?? '/dashboard/tools',
        actionLabel: state?.allowed ? copy.ui.openTool : badge === 'EXPIRED' ? copy.ui.buyNow : state?.trial.state === 'AVAILABLE' ? copy.ui.startTrial : copy.ui.learnMore,
      });
    }
  }

  // IAKO — one card per Live Training or Digital Tool this learner
  // currently has a real, active assistant assignment for (see
  // GET /api/iako/my-assistants).
  for (const assistant of myAssistants) {
    const expired = assistant.usage.revokedAt != null || (assistant.usage.expiresAt != null && new Date(assistant.usage.expiresAt) < new Date());
    cards.push({
      key: `iako-${assistant.resourceType}-${assistant.resourceId}`,
      icon: Sparkles,
      accent: 'emerald',
      title: `IAKO — ${assistant.mentorTagline || assistant.resourceTitle}`,
      description: t.iakoDesc,
      badge: expired ? 'EXPIRED' : 'ACTIVE',
      badgeLabel: label(expired ? 'EXPIRED' : 'ACTIVE'),
      dateLine: assistant.usage.expiresAt ? `${t.expires}: ${new Date(assistant.usage.expiresAt).toLocaleDateString()}` : null,
      manageHref: iakoAssistantHref(assistant),
      actionLabel: t.openIako,
      usageLine: `${assistant.usage.requestsUsed}${assistant.usage.requestLimit != null ? ` / ${assistant.usage.requestLimit}` : ''} ${t.requestsUsed}`,
      guideHref: assistant.resourceType === 'LIVE_TRAINING' ? `/dashboard/live-trainings/${assistant.resourceId}/guide` : undefined,
      guideLabel: t.todayGuide,
    });
  }

  // Cyber Sentinel / AG-SAIA — not purchasable by anyone yet (see
  // pages/dashboard/cyber-security.tsx's own "coming soon" framing) —
  // shown honestly as a preview, never as an active/purchased tool.
  cards.push({
    key: 'cyber-sentinel',
    icon: Bug,
    accent: 'cyan',
    title: t.cyberSentinel,
    description: t.cyberSentinelDesc,
    badge: 'COMING_SOON',
    badgeLabel: label('COMING_SOON'),
    dateLine: null,
    manageHref: '/dashboard/cyber-security',
  });

  const mine = cards.filter((c) => c.badge !== 'AVAILABLE' && c.badge !== 'COMING_SOON');
  // Loading also waits for the catalog copy (lazy per-locale chunk).
  const ready = !loading && !!copy;
  const available = cards.filter((c) => c.badge === 'AVAILABLE');
  const soon = cards.filter((c) => c.badge === 'COMING_SOON');

  return (
    <ToolShell backHref="/dashboard">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>
      <ToolPageHeader
        icon={LayoutGrid}
        accent="cyan"
        title={t.title}
        subtitle={t.subtitle}
        actions={<ToolLinkButton href="/tools" variant="secondary">{t.allTools}</ToolLinkButton>}
      />

      {!ready ? (
        <p role="status" className="flex items-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          {t.loading}
        </p>
      ) : (
        <>
          <ToolSection title={t.sectionMine} cards={mine} manageLabel={t.manage} learnMoreLabel={t.learnMore} empty={t.empty} />
          <ToolSection title={t.sectionAvailable} cards={available} manageLabel={t.manage} learnMoreLabel={t.learnMore} />
          <ToolSection title={t.sectionSoon} cards={soon} manageLabel={t.manage} learnMoreLabel={t.learnMore} />
        </>
      )}
    </ToolShell>
  );
}

export default function MyToolsPage() {
  return (
    <ProtectedRoute>
      <MyToolsContent />
    </ProtectedRoute>
  );
}
