import Link from 'next/link';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Bot, ShieldCheck, ArrowRight, MessageSquareText } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import RoleGate from '../../src/components/auth/RoleGate';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import BusinessAiAgentsSuite from '../../src/components/dashboard/BusinessAiAgentsSuite';
import { resolveLocale } from '@/src/utils/locale';

// Hub page — the 3 generic Business AI Assistants (content/analytics/
// business text generation) stay inline here since they're simple, but the
// Enterprise Chatbot Builder and AI Exam Proctoring — both full,
// self-contained tools with their own multi-tab UIs — each moved to their
// own dedicated route (/dashboard/tools/chatbot-builder,
// /dashboard/tools/proctored-exam) rather than sharing scroll position
// with unrelated products on one page.
const dict = {
  ka: {
    title: 'AI ხელსაწყოები',
    subtitle: 'ყველა AI ხელსაწყო თქვენი ბიზნესისთვის — ერთ სივრცეში.',
    fallback: 'AI ხელსაწყოები ხელმისაწვდომია მხოლოდ დამკვეთებისა და ადმინისტრატორებისთვის.',
    chatbotTitle: 'CDC ბიზნეს AI ჩატბოტი',
    chatbotDesc: 'შექმენით და მართეთ AI ჩატბოტი თქვენი საიტისთვის — ცოდნის ბაზა, საუბრების ისტორია, პერსონალიზაცია.',
    chatbotCta: 'ჩატბოტის მართვა',
    examTitle: 'AI გამოცდის პროქტორინგი',
    examDesc: 'შექმენით სკრინინგ-გამოცდები კანდიდატებისთვის — კამერისა და მიკროფონის კონტროლით, გასაზიარებელი ბმულით.',
    examCta: 'გამოცდების მართვა',
  },
  en: {
    title: 'AI Tools',
    subtitle: 'All AI tools for your business — in one place.',
    fallback: 'AI tools are available only to business clients and administrators.',
    chatbotTitle: 'CDC Business AI Chatbot',
    chatbotDesc: 'Create and manage an AI chatbot for your website — knowledge base, conversation history, personalization.',
    chatbotCta: 'Manage Chatbot',
    examTitle: 'AI Exam Proctoring',
    examDesc: 'Create candidate screening exams — camera and microphone monitoring, shareable links.',
    examCta: 'Manage Exams',
  },
  de: {
    title: 'AI Tools',
    subtitle: 'All AI tools for your business — in one place.',
    fallback: 'AI tools are available only to business clients and administrators.',
    chatbotTitle: 'CDC Business AI Chatbot',
    chatbotDesc: 'Create and manage an AI chatbot for your website — knowledge base, conversation history, personalization.',
    chatbotCta: 'Manage Chatbot',
    examTitle: 'AI Exam Proctoring',
    examDesc: 'Create candidate screening exams — camera and microphone monitoring, shareable links.',
    examCta: 'Manage Exams',
  },
  es: {
    title: 'AI Tools',
    subtitle: 'All AI tools for your business — in one place.',
    fallback: 'AI tools are available only to business clients and administrators.',
    chatbotTitle: 'CDC Business AI Chatbot',
    chatbotDesc: 'Create and manage an AI chatbot for your website — knowledge base, conversation history, personalization.',
    chatbotCta: 'Manage Chatbot',
    examTitle: 'AI Exam Proctoring',
    examDesc: 'Create candidate screening exams — camera and microphone monitoring, shareable links.',
    examCta: 'Manage Exams',
  },
  fr: {
    title: 'AI Tools',
    subtitle: 'All AI tools for your business — in one place.',
    fallback: 'AI tools are available only to business clients and administrators.',
    chatbotTitle: 'CDC Business AI Chatbot',
    chatbotDesc: 'Create and manage an AI chatbot for your website — knowledge base, conversation history, personalization.',
    chatbotCta: 'Manage Chatbot',
    examTitle: 'AI Exam Proctoring',
    examDesc: 'Create candidate screening exams — camera and microphone monitoring, shareable links.',
    examCta: 'Manage Exams',
  },
  uk: {
    title: 'AI Tools',
    subtitle: 'All AI tools for your business — in one place.',
    fallback: 'AI tools are available only to business clients and administrators.',
    chatbotTitle: 'CDC Business AI Chatbot',
    chatbotDesc: 'Create and manage an AI chatbot for your website — knowledge base, conversation history, personalization.',
    chatbotCta: 'Manage Chatbot',
    examTitle: 'AI Exam Proctoring',
    examDesc: 'Create candidate screening exams — camera and microphone monitoring, shareable links.',
    examCta: 'Manage Exams',
  },
};

function ToolLinkCard({
  href,
  icon: Icon,
  title,
  desc,
  cta,
}: {
  href: string;
  icon: typeof Bot;
  title: string;
  desc: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none p-6 no-underline text-current flex flex-col hover:border-cyan-400/50 dark:hover:border-cyan-400/40 transition-all"
    >
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-base font-black tracking-wide mb-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4 flex-1">{desc}</p>
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-cyan-600 dark:text-cyan-400">
        {cta}
        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </Link>
  );
}

function AiToolsContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>

      <SiteHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/dashboard/client" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>
        <div className="mb-8">
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Bot className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            {t.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        <RoleGate
          allowedRoles={['Client', 'SuperAdmin']}
          fallback={<p className="text-sm text-slate-500 dark:text-slate-400">{t.fallback}</p>}
        >
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            <ToolLinkCard
              href="/dashboard/tools/chatbot-builder"
              icon={MessageSquareText}
              title={t.chatbotTitle}
              desc={t.chatbotDesc}
              cta={t.chatbotCta}
            />
            <ToolLinkCard
              href="/dashboard/tools/proctored-exam"
              icon={ShieldCheck}
              title={t.examTitle}
              desc={t.examDesc}
              cta={t.examCta}
            />
          </div>

          <BusinessAiAgentsSuite lang={lang} />
        </RoleGate>
      </div>

      <SiteFooter />
    </div>
  );
}

export default function AiToolsPage() {
  return (
    <ProtectedRoute>
      <AiToolsContent />
    </ProtectedRoute>
  );
}
