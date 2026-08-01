import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import RoleGate from '../../src/components/auth/RoleGate';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import Toast from '../../src/components/shared/Toast';
import { JOB_CATEGORIES, JOB_CATEGORY_LABEL } from '../../src/utils/jobCategory';
import { JobCategory } from '../../src/types/community';
import { generateExam, submitExam, ExamQuestion, ExamAttemptResult } from '../../src/services/freelancerExamService';

const MAX_STRIKES = 3;

type Phase = 'select' | 'starting' | 'in-progress' | 'result';

function FreelancerExamContent() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';

  const [phase, setPhase] = useState<Phase>('select');
  const [category, setCategory] = useState<JobCategory | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [strikes, setStrikes] = useState(0);
  const [warningToast, setWarningToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamAttemptResult | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const strikeGuardRef = useRef(false);

  const handleSubmit = useCallback(async () => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitExam(attemptId, answers);
      setResult(res);
      setPhase('result');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'შეფასების გაგზავნა ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, answers, submitting]);

  const registerStrike = useCallback(
    (reason: string) => {
      if (phaseRef.current !== 'in-progress' || strikeGuardRef.current) return;
      strikeGuardRef.current = true;
      setTimeout(() => {
        strikeGuardRef.current = false;
      }, 800);
      setStrikes((prev) => {
        const next = prev + 1;
        if (next >= MAX_STRIKES) {
          setWarningToast(lang === 'ka' ? 'გამოვლენილია განმეორებითი დარღვევა — გამოცდა ავტომატურად იგზავნება.' : 'Repeated violation detected — auto-submitting the exam.');
          handleSubmit();
        } else {
          setWarningToast(
            lang === 'ka'
              ? `⚠️ ${reason} (${next}/${MAX_STRIKES}). კიდევ ერთი დარღვევა და გამოცდა ავტომატურად დასრულდება.`
              : `⚠️ ${reason} (${next}/${MAX_STRIKES}). One more violation and the exam will auto-submit.`
          );
        }
        return next;
      });
    },
    [lang, handleSubmit]
  );

  useEffect(() => {
    if (phase !== 'in-progress') return;

    const onVisibilityChange = () => {
      if (document.hidden) registerStrike(lang === 'ka' ? 'ტაბის გადართვა შეინიშნა' : 'Tab switch detected');
    };
    const onBlur = () => registerStrike(lang === 'ka' ? 'ფოკუსის დაკარგვა შეინიშნა' : 'Window focus loss detected');
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) registerStrike(lang === 'ka' ? 'სრულეკრანიანი რეჟიმიდან გამოსვლა' : 'Exited fullscreen mode');
    };
    const blockEvent = (e: Event) => e.preventDefault();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('contextmenu', blockEvent);
    document.addEventListener('copy', blockEvent);
    document.addEventListener('paste', blockEvent);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('contextmenu', blockEvent);
      document.removeEventListener('copy', blockEvent);
      document.removeEventListener('paste', blockEvent);
    };
  }, [phase, lang, registerStrike]);

  useEffect(() => {
    if (!warningToast) return;
    const timer = setTimeout(() => setWarningToast(null), 4000);
    return () => clearTimeout(timer);
  }, [warningToast]);

  const handleStart = async (cat: JobCategory) => {
    setCategory(cat);
    setPhase('starting');
    setError(null);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Some browsers/contexts block fullscreen (e.g. no user-gesture edge
      // cases) — the exam still proceeds; the anti-cheat listeners above
      // still catch tab/focus switches regardless of fullscreen support.
    }
    try {
      const exam = await generateExam(cat);
      setAttemptId(exam.attemptId);
      setQuestions(exam.questions);
      setCurrentIndex(0);
      setAnswers({});
      setStrikes(0);
      setPhase('in-progress');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'გამოცდის გენერაცია ვერ მოხერხდა.');
      setPhase('select');
    }
  };

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 flex flex-col">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full">
        {phase !== 'in-progress' && <BackButton fallbackHref="/dashboard" className="mb-6" />}
        <h1 className="text-2xl font-black mb-2">CDC Verified Freelancer — უნარების შემოწმება</h1>

        {error && (
          <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</div>
        )}

        {phase === 'select' && (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              აირჩიეთ კატეგორია — გენერირდება 5 კითხვა AI-ს მიერ. წარმატებით ჩაბარება (80%+) განიჭებთ CDC-ის დამოწმებული
              ფრილანსერის სტატუსს. გამოცდის დროს საჭიროა სრულეკრანიანი რეჟიმი — ტაბის შეცვლა ან ფოკუსის დაკარგვა
              აღირიცხება დარღვევად ({MAX_STRIKES} დარღვევის შემდეგ ავტომატურად დასრულდება).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {JOB_CATEGORIES.filter((c) => c !== 'other').map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleStart(cat)}
                  className="text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 hover:border-cyan-400 dark:hover:border-cyan-500 transition-colors"
                >
                  <p className="font-bold text-sm">{JOB_CATEGORY_LABEL[cat][lang]}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {phase === 'starting' && <p className="text-sm text-slate-400">იტვირთება…</p>}

        {phase === 'in-progress' && currentQuestion && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                კითხვა {currentIndex + 1} / {questions.length}
              </span>
              {strikes > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="w-3.5 h-3.5" /> {strikes}/{MAX_STRIKES}
                </span>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
              <p className="text-sm font-bold mb-5">{currentQuestion.question}</p>
              <div className="space-y-2">
                {(['A', 'B', 'C', 'D'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: key }))}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                      answers[currentQuestion.id] === key
                        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold mr-2">{key}.</span>
                    {currentQuestion.options[key]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              {!isLastQuestion ? (
                <button
                  type="button"
                  disabled={!answers[currentQuestion.id]}
                  onClick={() => setCurrentIndex((i) => i + 1)}
                  className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  შემდეგი
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!answers[currentQuestion.id] || submitting}
                  onClick={handleSubmit}
                  className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {submitting ? 'იგზავნება…' : 'დასრულება'}
                </button>
              )}
            </div>
          </div>
        )}

        {phase === 'result' && result && (
          <div className="text-center py-6">
            {result.passed ? (
              <>
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-xl font-black mb-1">🎉 გილოცავთ — CDC Verified Freelancer!</h2>
              </>
            ) : (
              <>
                <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-black mb-1">ამჯერად ვერ ჩააბარეთ</h2>
              </>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              შედეგი: {result.score}% ({result.correctCount}/{result.totalQuestions})
            </p>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-6 py-2.5 text-sm font-bold"
            >
              პირად კაბინეტში დაბრუნება
            </button>
          </div>
        )}
      </div>
      <SiteFooter lang={lang === 'ka' ? 'GEO' : 'ENG'} />
      {warningToast && <Toast message={warningToast} icon="⚠️" />}
    </div>
  );
}

export default function FreelancerExamPage() {
  return (
    <ProtectedRoute>
      <RoleGate
        allowedRoles={['Student']}
        fallback={
          <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
            ეს გვერდი ხელმისაწვდომია მხოლოდ სტუდენტი/ფრილანსერი მომხმარებლებისთვის.
          </div>
        }
      >
        <FreelancerExamContent />
      </RoleGate>
    </ProtectedRoute>
  );
}
