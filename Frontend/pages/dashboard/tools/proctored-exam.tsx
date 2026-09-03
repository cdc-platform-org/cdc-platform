import { useRouter } from 'next/router';
import Head from 'next/head';
import { ShieldCheck } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import RoleGate from '../../../src/components/auth/RoleGate';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import ExamProctoringTab from '../../../src/components/dashboard/ExamProctoringTab';
import { resolveLocale } from '@/src/utils/locale';

// AI Proctored Exam & Skill Assessment System — split out of
// /dashboard/ai-tools (now a hub linking here) into its own dedicated
// route. This used to be a separate, simpler client-only "practice exam"
// tool with no persistence and no shareable links (see this file's git
// history); that tool is retired in favor of the real, DB-backed
// ExamSession system (ExamProctoringTab), which already has candidate
// links, embeddable widgets, and results/analytics.
const dict = {
  ka: {
    title: 'AI გამოცდის პროქტორინგი',
    subtitle: 'შექმენით AI-გენერირებული სკრინინგ-გამოცდები კანდიდატებისთვის — უნიკალური ბმულით, კამერისა და მიკროფონის კონტროლით.',
    fallback: 'AI გამოცდის პროქტორინგი ხელმისაწვდომია მხოლოდ დამკვეთებისა და ადმინისტრატორებისთვის.',
  },
  en: {
    title: 'AI Exam Proctoring',
    subtitle: 'Create AI-generated candidate screening exams — each with a unique link, camera and microphone monitoring.',
    fallback: 'AI Exam Proctoring is available only to business clients and administrators.',
  },
  de: {
    title: 'AI Exam Proctoring',
    subtitle: 'Create AI-generated candidate screening exams — each with a unique link, camera and microphone monitoring.',
    fallback: 'AI Exam Proctoring is available only to business clients and administrators.',
  },
  es: {
    title: 'AI Exam Proctoring',
    subtitle: 'Create AI-generated candidate screening exams — each with a unique link, camera and microphone monitoring.',
    fallback: 'AI Exam Proctoring is available only to business clients and administrators.',
  },
  fr: {
    title: 'AI Exam Proctoring',
    subtitle: 'Create AI-generated candidate screening exams — each with a unique link, camera and microphone monitoring.',
    fallback: 'AI Exam Proctoring is available only to business clients and administrators.',
  },
  uk: {
    title: 'AI Exam Proctoring',
    subtitle: 'Create AI-generated candidate screening exams — each with a unique link, camera and microphone monitoring.',
    fallback: 'AI Exam Proctoring is available only to business clients and administrators.',
  },
};

function ProctoredExamContent() {
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
            <ShieldCheck className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            {t.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        <RoleGate
          allowedRoles={['Client', 'SuperAdmin']}
          fallback={<p className="text-sm text-slate-500 dark:text-slate-400">{t.fallback}</p>}
        >
          <ExamProctoringTab lang={lang} />
        </RoleGate>
      </div>

      <SiteFooter />
    </div>
  );
}

export default function ProctoredExamPage() {
  return (
    <ProtectedRoute>
      <ProctoredExamContent />
    </ProtectedRoute>
  );
}
