import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getCandidateResults, CandidateResults } from '../../../src/services/examProctoringService';
import { resolveLocale } from '@/src/utils/locale';
import ExamResultsView from '@/src/components/exam/ExamResultsView';

// The student's own exam results, opened from the "View results online"
// button in the results email. Addressed by the student's private attempt
// token, so no login is needed.

const dictBase = {
  ka: {
    loading: 'იტვირთება…',
    notFound: 'შედეგები ვერ მოიძებნა. შეამოწმეთ ბმული.',
    notShared: 'გამოცდის ორგანიზატორს შედეგები ჯერ არ გაუზიარებია.',
    notSubmitted: 'ეს გამოცდა ჯერ არ დასრულებულა.',
    generic: 'შედეგების ჩატვირთვა ვერ მოხერხდა. სცადეთ თავიდან.',
  },
  en: {
    loading: 'Loading…',
    notFound: 'Results not found. Please check the link.',
    notShared: 'The exam organizer has not shared results for this exam.',
    notSubmitted: 'This exam has not been submitted yet.',
    generic: 'Could not load the results. Please try again.',
  },
};
const dict = { ...dictBase, de: dictBase.en, es: dictBase.en, fr: dictBase.en, uk: dictBase.en };

export default function ExamResultPage() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const token = typeof router.query.token === 'string' ? router.query.token : null;
  const [results, setResults] = useState<CandidateResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getCandidateResults(token)
      .then(setResults)
      .catch((err) => {
        const status = err?.response?.status;
        setError(status === 404 ? t.notFound : status === 403 ? t.notShared : status === 409 ? t.notSubmitted : t.generic);
      });
  }, [token, t]);

  return (
    <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 min-h-screen bg-slate-950 text-white flex flex-col">
      <Head>
        <title>{results ? `${results.examTitle} | CDC Exam` : 'CDC Exam'}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="max-w-2xl mx-auto px-4 py-10 flex-1 w-full">
        {error && <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">{error}</div>}
        {!error && !results && <p className="text-sm text-slate-400">{t.loading}</p>}
        {results && <ExamResultsView results={results} locale={lang} showEmailNote={false} />}
      </div>
    </div>
  );
}
