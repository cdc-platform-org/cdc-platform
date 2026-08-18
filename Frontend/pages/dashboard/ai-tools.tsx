import { useRouter } from 'next/router';
import Head from 'next/head';
import { Bot } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import RoleGate from '../../src/components/auth/RoleGate';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import BusinessAiTab from '../../src/components/dashboard/BusinessAiTab';
import BusinessAiAgentsSuite from '../../src/components/dashboard/BusinessAiAgentsSuite';
import ExamProctoringTab from '../../src/components/dashboard/ExamProctoringTab';

const dict = {
  ka: {
    title: 'AI აგენტი',
    subtitle: 'შექმენით და მართეთ AI ჩატბოტი თქვენი ბიზნესისთვის — ერთ სივრცეში.',
    fallback: 'AI აგენტის კონფიგურაცია ხელმისაწვდომია მხოლოდ დამკვეთებისა და ადმინისტრატორებისთვის.',
  },
  en: {
    title: 'AI Agent',
    subtitle: 'Create and manage an AI chatbot for your business — all in one place.',
    fallback: 'AI agent configuration is available only to business clients and administrators.',
  },
};

function AiToolsContent() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
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
          <BusinessAiAgentsSuite lang={lang} />
          <BusinessAiTab lang={lang} />
          <div className="h-px bg-slate-200 dark:bg-slate-800 my-10" />
          <ExamProctoringTab lang={lang} />
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
