import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { Bot, GraduationCap, Mic, Bug, Sparkles, Calendar, BookOpen, ShieldCheck, LayoutGrid, Loader2 } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import { useAuth } from '../../../src/context/AuthContext';
import { getMyAgents } from '../../../src/services/agentService';
import { Agent } from '../../../src/types/agent';
import { getTutorState, TutorState } from '../../../src/services/englishTutorService';
import { getEducatorHubState, EducatorHubState } from '../../../src/services/educatorHubService';
import { resolveLocale } from '@/src/utils/locale';
import ToolShell, { ToolPageHeader, ToolIconTile, ToolChip, ToolLinkButton, toolPrimaryButton, toolSecondaryButton, type ToolAccent, type ToolChipTone } from '@/src/components/tools/ToolShell';
import { listMyIakoAssistants, hasDigitalToolAccess, iakoAssistantHref, MyIakoAssistant } from '../../../src/services/iakoAssistantService';

const EN_STRINGS = {
  title: 'My Tools',
  subtitle: 'All your AI tools and subscriptions in one place.',
  loading: 'Loading…',
  empty: 'No active tools yet. Pick one below to get started.',
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
  businessAiAvailableDesc: 'Build an AI chatbot for your website — free trial',
  englishTutorAvailableDesc: 'Learn English step by step — free trial',
  educatorAvailableDesc: 'Tests, rubrics and lesson plans for teachers — 5-day free trial',
  childrensBook: "AI Children's Book",
  childrensBookDesc: 'A personalized illustrated book starring your child',
  proctoredExam: 'AI-Proctored Exam',
  proctoredExamDesc: 'Create exams and send students a supervised exam link',
  open: 'Open',
  start: 'Get started',
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
    businessAiAvailableDesc: 'შექმენით AI ჩატბოტი თქვენი საიტისთვის — უფასო საცდელი',
    englishTutorAvailableDesc: 'ისწავლეთ ინგლისური ნაბიჯ-ნაბიჯ — უფასო საცდელი',
    educatorAvailableDesc: 'ტესტები, რუბრიკები და გაკვეთილის გეგმები მასწავლებლებისთვის — 5 დღე უფასოდ',
    childrensBook: 'AI საბავშვო წიგნი',
    childrensBookDesc: 'პერსონალური ილუსტრირებული წიგნი, სადაც მთავარი გმირი თქვენი შვილია',
    proctoredExam: 'AI ზედამხედველობით გამოცდა',
    proctoredExamDesc: 'შექმენით გამოცდა და გაუგზავნეთ სტუდენტებს ბმული',
    open: 'გახსნა',
    start: 'დაწყება',
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

type ToolBadge = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'PAUSED' | 'AVAILABLE' | 'COMING_SOON';

const BADGE_TONE: Record<ToolBadge, ToolChipTone> = {
  TRIAL: 'brand',
  ACTIVE: 'success',
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
      accent: 'indigo',
      title: `${t.businessAi} — ${agent.name}`,
      description: t.businessAiDesc(1),
      badge,
      badgeLabel,
      dateLine: agent.status === 'TRIAL' ? `${t.expires}: ${new Date(agent.trialEndsAt).toLocaleDateString()}` : null,
      manageHref: '/dashboard/tools/chatbot-builder',
    });
  }

  if (agents.length === 0) {
    cards.push({
      key: 'business-ai',
      icon: Bot,
      accent: 'indigo',
      title: t.businessAi,
      description: t.businessAiAvailableDesc,
      badge: 'AVAILABLE',
      badgeLabel: t.statusAvailable,
      dateLine: null,
      manageHref: '/dashboard/tools/chatbot-builder',
      actionLabel: t.start,
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
      accent: 'purple',
      title: t.englishTutor,
      description: badgeLabel,
      badge,
      badgeLabel,
      dateLine,
      manageHref: '/dashboard/english-tutor',
    });
  } else {
    // Not engaged yet — still list it so the tool is discoverable from here.
    cards.push({
      key: 'english-tutor',
      icon: GraduationCap,
      accent: 'purple',
      title: t.englishTutor,
      description: t.englishTutorAvailableDesc,
      badge: 'AVAILABLE',
      badgeLabel: t.statusAvailable,
      dateLine: null,
      manageHref: '/dashboard/english-tutor',
      actionLabel: t.start,
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
      accent: 'amber',
      title: t.educatorVip,
      description: badgeLabel,
      badge,
      badgeLabel,
      dateLine,
      manageHref: '/dashboard/tools/educator-hub',
    });
  } else {
    cards.push({
      key: 'educator-vip',
      icon: Sparkles,
      accent: 'amber',
      title: t.educatorVip,
      description: t.educatorAvailableDesc,
      badge: 'AVAILABLE',
      badgeLabel: t.statusAvailable,
      dateLine: null,
      manageHref: '/dashboard/tools/educator-hub',
      actionLabel: t.start,
    });
  }

  // Children's Book and the AI-proctored exam are open to every signed-in
  // user (pay-per-book / free to create), so they're always listed.
  cards.push({
    key: 'childrens-book',
    icon: BookOpen,
    accent: 'pink',
    title: t.childrensBook,
    description: t.childrensBookDesc,
    badge: 'AVAILABLE',
    badgeLabel: t.statusAvailable,
    dateLine: null,
    manageHref: '/dashboard/tools/childrens-book',
    actionLabel: t.start,
  });
  cards.push({
    key: 'proctored-exam',
    icon: ShieldCheck,
    accent: 'cyan',
    title: t.proctoredExam,
    description: t.proctoredExamDesc,
    badge: 'AVAILABLE',
    badgeLabel: t.statusAvailable,
    dateLine: null,
    manageHref: '/dashboard/tools/proctored-exam',
    actionLabel: t.start,
  });

  // AI Voice & Video Studio — gated by digitalToolAccessService's
  // requireDigitalToolAccess('media-studio') on the backend (an
  // AccessGrant or a linked purchase); reflect the real state here rather
  // than always claiming it's open, which it no longer is.
  cards.push({
    key: 'media-studio',
    icon: Mic,
    accent: 'pink',
    title: t.mediaStudio,
    description: mediaStudioAccess ? t.mediaStudioDescActive : t.mediaStudioDescLocked,
    badge: mediaStudioAccess ? 'ACTIVE' : 'AVAILABLE',
    badgeLabel: mediaStudioAccess ? t.statusActive : t.statusAvailable,
    dateLine: null,
    manageHref: '/dashboard/tools/media-studio',
    actionLabel: mediaStudioAccess ? undefined : t.open,
  });

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
    accent: 'cyan',
    title: t.cyberSentinel,
    description: t.cyberSentinelDesc,
    badge: 'COMING_SOON',
    badgeLabel: t.statusComingSoon,
    dateLine: null,
    manageHref: '/dashboard/cyber-security',
  });

  const mine = cards.filter((c) => c.badge !== 'AVAILABLE' && c.badge !== 'COMING_SOON');
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

      {loading ? (
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
