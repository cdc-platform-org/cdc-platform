import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { Sparkles } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { CareerQuizSubmission } from '../../src/types/careerQuiz';
import { getMyCareerQuizSubmissions } from '../../src/services/careerQuizService';
import { resolveLocale, contentLocale } from '@/src/utils/locale';

const dict = {
  ka: {
    title: 'ჩემი კარიერული ტესტი / AI რეკომენდაციები',
    subtitle: 'აქ ინახება თქვენი ყველა წარსული AI კარიერული ტესტის შედეგი.',
    loading: 'იტვირთება…',
    empty: 'ჯერ არცერთი ტესტი არ გაგივლიათ.',
    takeTest: 'ტესტის გავლა',
    retake: 'ხელახლა გავლა',
  },
  en: {
    title: 'My Career Test / AI Recommendations',
    subtitle: 'Every past result from your AI Career Test lives here.',
    loading: 'Loading…',
    empty: "You haven't taken the career test yet.",
    takeTest: 'Take the Test',
    retake: 'Retake the Test',
  },
};

function CareerQuizContent() {
  const router = useRouter();
  const lang = contentLocale(resolveLocale(router.locale));
  const t = dict[lang];

  const [submissions, setSubmissions] = useState<CareerQuizSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSubmissions(await getMyCareerQuizSubmissions());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 w-full">
        <BackButton fallbackHref="/dashboard" className="dark:text-slate-400 dark:hover:text-slate-100" />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full">
        <div className="mb-8 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-black tracking-wide flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-cyan-500" />
              {t.title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
          </div>
          <Link
            href="/career-test"
            className="inline-block text-xs font-bold text-white bg-slate-900 dark:bg-cyan-600 px-4 py-2.5 rounded-xl no-underline"
          >
            {submissions.length > 0 ? t.retake : t.takeTest}
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.loading}</p>
        ) : submissions.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-10 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.empty}</p>
            <Link href="/career-test" className="inline-block text-xs font-bold text-white bg-slate-900 dark:bg-cyan-600 px-4 py-2.5 rounded-xl no-underline">
              {t.takeTest}
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {submissions.map((s) => (
              <div key={s.id} className="bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6">
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mb-3">
                  {new Date(s.createdAt).toLocaleString()}
                </p>
                <div className="prose prose-sm dark:prose-invert max-w-none prose-a:text-cyan-600 dark:prose-a:text-cyan-400">
                  <ReactMarkdown>{s.resultText}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

export default function CareerQuizDashboardPage() {
  return (
    <ProtectedRoute>
      <CareerQuizContent />
    </ProtectedRoute>
  );
}
