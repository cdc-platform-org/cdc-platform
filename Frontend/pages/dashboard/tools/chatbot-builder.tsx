import { useRouter } from 'next/router';
import Head from 'next/head';
import { Bot } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import ToolErrorBoundary from '../../../src/components/common/ToolErrorBoundary';
import BusinessAiTab from '../../../src/components/dashboard/BusinessAiTab';
import { resolveLocale } from '@/src/utils/locale';
import ToolMediaBanner from '../../../src/components/tools/ToolMediaBanner';
import ToolShell, { ToolPageHeader } from '../../../src/components/tools/ToolShell';

// Enterprise AI Chatbot & Knowledge Base — split out of /dashboard/ai-tools
// (now a hub linking here) into its own dedicated route, same reasoning as
// proctored-exam.tsx's own split: a full, self-contained tool deserves its
// own URL rather than sharing scroll position with unrelated products.
const dict = {
  ka: {
    title: 'CDC ბიზნეს AI',
    subtitle: 'შექმენით და მართეთ AI ჩატბოტი თქვენი საიტისთვის.',
  },
  en: {
    title: 'CDC Business AI',
    subtitle: 'Create and manage an AI chatbot for your website.',
  },
  de: {
    title: 'CDC Business AI',
    subtitle: 'Create and manage an AI chatbot for your website.',
  },
  es: {
    title: 'CDC Business AI',
    subtitle: 'Create and manage an AI chatbot for your website.',
  },
  fr: {
    title: 'CDC Business AI',
    subtitle: 'Create and manage an AI chatbot for your website.',
  },
  uk: {
    title: 'CDC Business AI',
    subtitle: 'Create and manage an AI chatbot for your website.',
  },
};

function ChatbotBuilderContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];

  return (
    <ToolShell backHref="/dashboard/tools">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>
      <ToolPageHeader icon={Bot} accent="indigo" title={t.title} subtitle={t.subtitle} />
      <ToolMediaBanner slug="enterprise-ai" alt={t.title} />
      <BusinessAiTab lang={lang} />
    </ToolShell>
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
