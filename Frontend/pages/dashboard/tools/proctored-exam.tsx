import { useRouter } from 'next/router';
import ToolGuideButton from '../../../src/components/tools/ToolGuideButton';
import Head from 'next/head';
import { ShieldCheck } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import ToolErrorBoundary from '../../../src/components/common/ToolErrorBoundary';
import ExamProctoringTab from '../../../src/components/dashboard/ExamProctoringTab';
import { resolveLocale } from '@/src/utils/locale';
import ToolMediaBanner from '../../../src/components/tools/ToolMediaBanner';
import ToolShell, { ToolPageHeader } from '../../../src/components/tools/ToolShell';

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
    subtitle: 'შექმენით AI-გენერირებული გამოცდები მოსწავლეებისთვის ან კანდიდატებისთვის — ერთი ბმულით, არეული კითხვებით, კამერისა და მიკროფონის კონტროლით.',
  },
  en: {
    title: 'AI Exam Proctoring',
    subtitle: 'Create AI-generated exams for students or candidates — one link, shuffled questions, camera and microphone monitoring.',
  },
  de: {
    title: 'AI Exam Proctoring',
    subtitle: 'Create AI-generated exams for students or candidates — one link, shuffled questions, camera and microphone monitoring.',
  },
  es: {
    title: 'AI Exam Proctoring',
    subtitle: 'Create AI-generated exams for students or candidates — one link, shuffled questions, camera and microphone monitoring.',
  },
  fr: {
    title: 'AI Exam Proctoring',
    subtitle: 'Create AI-generated exams for students or candidates — one link, shuffled questions, camera and microphone monitoring.',
  },
  uk: {
    title: 'AI Exam Proctoring',
    subtitle: 'Create AI-generated exams for students or candidates — one link, shuffled questions, camera and microphone monitoring.',
  },
};

function ProctoredExamContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];

  return (
    <ToolShell backHref="/dashboard/tools">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>
      <ToolPageHeader icon={ShieldCheck} accent="cyan" title={t.title} subtitle={t.subtitle} actions={<ToolGuideButton guide="exam" />} />
      <ToolMediaBanner slug="proctoring" alt={t.title} />
      <ExamProctoringTab lang={lang} />
    </ToolShell>
  );
}

export default function ProctoredExamPage() {
  return (
    <ProtectedRoute>
      <ToolErrorBoundary>
        <ProctoredExamContent />
      </ToolErrorBoundary>
    </ProtectedRoute>
  );
}
