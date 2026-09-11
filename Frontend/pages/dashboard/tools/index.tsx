import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { Bot, GraduationCap, Mic, Bug, Sparkles, Calendar } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import { useAuth } from '../../../src/context/AuthContext';
import { getMyAgents } from '../../../src/services/agentService';
import { Agent } from '../../../src/types/agent';
import { getTutorState, TutorState } from '../../../src/services/englishTutorService';
import { getEducatorHubState, EducatorHubState } from '../../../src/services/educatorHubService';
import { resolveLocale } from '@/src/utils/locale';
import { listMyIakoAssistants, hasDigitalToolAccess, iakoAssistantHref, MyIakoAssistant } from '../../../src/services/iakoAssistantService';

const EN_STRINGS = {
  title: 'My Tools',
  subtitle: 'Your active AI tools and subscriptions in one place.',
  loading: 'Loading…',
  empty: 'You have no active tools yet — browse the catalog to get started.',
  browseCatalog: 'Browse AI Tools',
  manage: 'Manage Tool',
  statusTrial: 'Trial',
  statusActive: 'Active',
  statusExpired: 'Expired',
  statusPaused: 'Paused',
  statusAvailable: 'Available',
  statusComingSoon: 'Coming Soon',
  expires: 'Expires',
  renews: 'Renews',
  businessAi: 'CDC Business AI',
  businessAiDesc: (n: number) => `${n} chatbot agent${n === 1 ? '' : 's'}`,
  englishTutor: 'IMIAKO — AI English Tutor',
  educatorVip: 'AI Educator VIP Hub',
  mediaStudio: 'AI Voice & Video Studio',
  mediaStudioDescActive: 'Access granted',
  mediaStudioDescLocked: 'Requires access — contact us to request it',
  cyberSentinel: 'Cyber Sentinel (AG-SAIA)',
  cyberSentinelDesc: 'Sovereign AI security node — launching soon',
  iakoDesc: 'AI training mentor', openIako: 'Open IAKO', todayGuide: "Today's Guide", requestsUsed: 'requests used',
};

const dict = {
  ka: {
    title: 'ჩემი ხელსაწყოები',
    subtitle: 'თქვენი აქტიური AI ხელსაწყოები და გამოწერები ერთ ადგილას.',
    loading: 'იტვირთება…',
    empty: 'თქვენ ჯერ არცერთი აქტიური ხელსაწყო არ გაქვთ — დაათვალიერეთ კატალოგი დასაწყებად.',
    browseCatalog: 'AI ხელსაწყოების ნახვა',
    manage: 'მართვა',
    statusTrial: 'საცდელი',
    statusActive: 'აქტიური',
    statusExpired: 'ვადაგასული',
    statusPaused: 'შეჩერებული',
    statusAvailable: 'ხელმისაწვდომი',
    statusComingSoon: 'მალე',
    expires: 'სრულდება',
    renews: 'განახლდება',
    businessAi: 'CDC ბიზნეს AI',
    businessAiDesc: (n: number) => `${n} ჩატბოტ აგენტი`,
    englishTutor: 'IMIAKO — AI ინგლისურის მასწავლებელი',
    educatorVip: 'AI მასწავლებლის VIP ჰაბი',
    mediaStudio: 'AI ხმისა და ვიდეოს სტუდია',
    mediaStudioDescActive: 'წვდომა მინიჭებულია',
    mediaStudioDescLocked: 'საჭიროებს წვდომას — დაგვიკავშირდით მოთხოვნისთვის',
    cyberSentinel: 'Cyber Sentinel (AG-SAIA)',
    cyberSentinelDesc: 'სუვერენული AI უსაფრთხოების კვანძი — მალე გაეშვება',
    iakoDesc: 'AI ტრენინგის მენტორი', openIako: 'IAKO-ს გახსნა', todayGuide: 'დღევანდელი გზამკვლევი', requestsUsed: 'მოთხოვნა გამოყენებულია',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

type ToolBadge = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'PAUSED' | 'AVAILABLE' | 'COMING_SOON';

const BADGE_CLASS: Record<ToolBadge, string> = {
  TRIAL: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  ACTIVE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  EXPIRED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  PAUSED: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30',
  AVAILABLE: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
  COMING_SOON: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
};

interface ToolCardData {
  key: string;
  icon: typeof Bot;
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

function ToolCard({ tool, manageLabel }: { tool: ToolCardData; manageLabel: string }) {
  const Icon = tool.icon;
  return (
    <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${BADGE_CLASS[tool.badge]}`}>
          {tool.badgeLabel}
        </span>
      </div>
      <h3 className="font-black text-sm mb-1">{tool.title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex-1">{tool.description}</p>
      {tool.dateLine && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mb-3">
          <Calendar className="w-3 h-3" />
          {tool.dateLine}
        </p>
      )}
      {tool.usageLine && <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{tool.usageLine}</p>}
      <Link
        href={tool.manageHref}
        className="mt-auto inline-flex items-center justify-center text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 no-underline hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        {tool.actionLabel || manageLabel}
      </Link>
      {tool.guideHref && <Link href={tool.guideHref} className="mt-2 text-center text-xs font-bold text-cyan-700 dark:text-cyan-300 py-2">{tool.guideLabel}</Link>}
    </div>
  );
}

function MyToolsContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const { isAuthenticated } = useAuth();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [tutorState, setTutorState] = useState<TutorState | null>(null);
  const [educatorState, setEducatorState] = useState<EducatorHubState | null>(null);
  const [myAssistants, setMyAssistants] = useState<MyIakoAssistant[]>([]);
  const [mediaStudioAccess, setMediaStudioAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([
      getMyAgents().catch(() => []),
      getTutorState().catch(() => null),
      getEducatorHubState().catch(() => null),
      listMyIakoAssistants().catch(() => []),
      hasDigitalToolAccess('media-studio').catch(() => false),
    ]).then(([a, ts, es, assistants, mediaAccess]) => {
      setAgents(a);
      setTutorState(ts);
      setEducatorState(es);
      setMyAssistants(assistants);
      setMediaStudioAccess(mediaAccess);
      setLoading(false);
    });
  }, [isAuthenticated]);

  const cards: ToolCardData[] = [];

  // CDC Business AI — one card per agent (a business may run more than
  // one), only shown at all if the account has actually created one.
  for (const agent of agents) {
    const trialEnded = new Date(agent.trialEndsAt).getTime() <= Date.now();
    const badge: ToolBadge = agent.status === 'TRIAL' ? (trialEnded ? 'EXPIRED' : 'TRIAL') : agent.status === 'ACTIVE' ? 'ACTIVE' : trialEnded ? 'EXPIRED' : 'PAUSED';
    const badgeLabel = { TRIAL: t.statusTrial, ACTIVE: t.statusActive, EXPIRED: t.statusExpired, PAUSED: t.statusPaused, AVAILABLE: t.statusAvailable, COMING_SOON: t.statusComingSoon }[badge];
    cards.push({
      key: `agent-${agent.id}`,
      icon: Bot,
      title: `${t.businessAi} — ${agent.name}`,
      description: t.businessAiDesc(1),
      badge,
      badgeLabel,
      dateLine: agent.status === 'TRIAL' ? `${t.expires}: ${new Date(agent.trialEndsAt).toLocaleDateString()}` : null,
      manageHref: '/dashboard/tools/chatbot-builder',
    });
  }

  // English Tutor — only shown once the user has actually engaged with it
  // (started a trial or subscribed), not for every account site-wide.
  if (tutorState && (tutorState.trialActive || tutorState.subscriptionTier === 'PRO' || (!tutorState.trialAvailable && !tutorState.trialActive))) {
    const badge: ToolBadge = tutorState.trialActive ? 'TRIAL' : tutorState.subscriptionTier === 'PRO' ? 'ACTIVE' : 'EXPIRED';
    const badgeLabel = { TRIAL: t.statusTrial, ACTIVE: t.statusActive, EXPIRED: t.statusExpired, PAUSED: t.statusPaused, AVAILABLE: t.statusAvailable, COMING_SOON: t.statusComingSoon }[badge];
    const dateLine = tutorState.trialActive
      ? `${t.expires}: ${new Date(tutorState.tutorTrialEndDate!).toLocaleDateString()}`
      : tutorState.subscriptionTier === 'PRO' && tutorState.subscriptionPeriodEnd
      ? `${t.renews}: ${new Date(tutorState.subscriptionPeriodEnd).toLocaleDateString()}`
      : null;
    cards.push({
      key: 'english-tutor',
      icon: GraduationCap,
      title: t.englishTutor,
      description: badgeLabel,
      badge,
      badgeLabel,
      dateLine,
      manageHref: '/dashboard/english-tutor',
    });
  }

  // Educator VIP Hub — same "only if engaged" gating as English Tutor above.
  if (educatorState && (educatorState.trialActive || educatorState.isVipActive || (!educatorState.trialAvailable && !educatorState.trialActive))) {
    const badge: ToolBadge = educatorState.trialActive ? 'TRIAL' : educatorState.isVipActive ? 'ACTIVE' : 'EXPIRED';
    const badgeLabel = { TRIAL: t.statusTrial, ACTIVE: t.statusActive, EXPIRED: t.statusExpired, PAUSED: t.statusPaused, AVAILABLE: t.statusAvailable, COMING_SOON: t.statusComingSoon }[badge];
    const dateLine = educatorState.educatorVipTrialEndDate
      ? `${t.expires}: ${new Date(educatorState.educatorVipTrialEndDate).toLocaleDateString()}`
      : null;
    cards.push({
      key: 'educator-vip',
      icon: Sparkles,
      title: t.educatorVip,
      description: badgeLabel,
      badge,
      badgeLabel,
      dateLine,
      manageHref: '/dashboard/tools/educator-hub',
    });
  }

  // AI Voice & Video Studio — gated by digitalToolAccessService's
  // requireDigitalToolAccess('media-studio') on the backend (an
  // AccessGrant or a linked purchase); reflect the real state here rather
  // than always claiming it's open, which it no longer is.
  cards.push({
    key: 'media-studio',
    icon: Mic,
    title: t.mediaStudio,
    description: mediaStudioAccess ? t.mediaStudioDescActive : t.mediaStudioDescLocked,
    badge: mediaStudioAccess ? 'ACTIVE' : 'AVAILABLE',
    badgeLabel: mediaStudioAccess ? t.statusActive : t.statusAvailable,
    dateLine: null,
    manageHref: '/dashboard/tools/media-studio',
  });

  // IAKO — one card per Live Training or Digital Tool this learner
  // currently has a real, active assistant assignment for (see
  // GET /api/iako/my-assistants).
  for (const assistant of myAssistants) {
    const expired = assistant.usage.revokedAt != null || (assistant.usage.expiresAt != null && new Date(assistant.usage.expiresAt) < new Date());
    cards.push({
      key: `iako-${assistant.resourceType}-${assistant.resourceId}`,
      icon: Sparkles,
      title: `IAKO — ${assistant.mentorTagline || assistant.resourceTitle}`,
      description: t.iakoDesc,
      badge: expired ? 'EXPIRED' : 'ACTIVE',
      badgeLabel: expired ? t.statusExpired : t.statusActive,
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
    title: t.cyberSentinel,
    description: t.cyberSentinelDesc,
    badge: 'COMING_SOON',
    badgeLabel: t.statusComingSoon,
    dateLine: null,
    manageHref: '/dashboard/cyber-security',
  });

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>
      <SiteHeader />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/dashboard" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>
        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-wide">{t.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">{t.loading}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => (
              <ToolCard key={card.key} tool={card} manageLabel={t.manage} />
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

export default function MyToolsPage() {
  return (
    <ProtectedRoute>
      <MyToolsContent />
    </ProtectedRoute>
  );
}
