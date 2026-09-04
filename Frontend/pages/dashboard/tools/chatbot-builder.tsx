import { useRouter } from 'next/router';
import Head from 'next/head';
import { Bot } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import ToolErrorBoundary from '../../../src/components/common/ToolErrorBoundary';
import RoleGate from '../../../src/components/auth/RoleGate';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import BusinessAiTab from '../../../src/components/dashboard/BusinessAiTab';
import { resolveLocale } from '@/src/utils/locale';

// Enterprise AI Chatbot & Knowledge Base — split out of /dashboard/ai-tools
// (now a hub linking here) into its own dedicated route, same reasoning as
// proctored-exam.tsx's own split: a full, self-contained tool deserves its
// own URL rather than sharing scroll position with unrelated products.
const dict = {
  ka: {
    title: 'CDC ბიზნეს AI',
    subtitle: 'შექმენით და მართეთ AI ჩატბოტი თქვენი საიტისთვის.',
    fallback: 'AI ჩატბოტის კონფიგურაცია ხელმისაწვდომია მხოლოდ დამკვეთებისა და ადმინისტრატორებისთვის.',
  },
  en: {
    title: 'CDC Business AI',
    subtitle: 'Create and manage an AI chatbot for your website.',
    fallback: 'AI chatbot configuration is available only to business clients and administrators.',
  },
  de: {
    title: 'CDC Business AI',
    subtitle: 'Create and manage an AI chatbot for your website.',
    fallback: 'AI chatbot configuration is available only to business clients and administrators.',
  },
  es: {
    title: 'CDC Business AI',
    subtitle: 'Create and manage an AI chatbot for your website.',
    fallback: 'AI chatbot configuration is available only to business clients and administrators.',
  },
  fr: {
    title: 'CDC Business AI',
    subtitle: 'Create and manage an AI chatbot for your website.',
    fallback: 'AI chatbot configuration is available only to business clients and administrators.',
  },
  uk: {
    title: 'CDC Business AI',
    subtitle: 'Create and manage an AI chatbot for your website.',
    fallback: 'AI chatbot configuration is available only to business clients and administrators.',
  },
};

function ChatbotBuilderContent() {
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
          <BackButton fallbackHref="/dashboard/ai-tools" className="dark:text-slate-400 dark:hover:text-slate-100" />
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
          <BusinessAiTab lang={lang} />
        </RoleGate>
      </div>

      <SiteFooter />
    </div>
  );
}

export default function ChatbotBuilderPage() {
  return (
    <ProtectedRoute>
      <ToolErrorBoundary>
        <ChatbotBuilderContent />
      </ToolErrorBoundary>
    </ProtectedRoute>
  );
}
