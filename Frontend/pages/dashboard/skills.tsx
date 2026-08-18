import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2, Clock, ShieldCheck, Award, GraduationCap } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import {
  getMySkills,
  generateSkillTest,
  submitSkillTest,
  MySkillsResult,
  SkillClientQuestion,
  SubmitSkillTestResult,
} from '../../src/services/skillTestService';

// Mirrors Backend's routes/skillTests.ts's SECONDS_PER_QUESTION/PASS_THRESHOLD.
const SECONDS_PER_QUESTION = 90;
const PASS_THRESHOLD = 80;
const GENERATE_TIMEOUT_MS = 45000;

type Phase = 'list' | 'starting' | 'in-progress' | 'result';

const dict = {
  ka: {
    title: 'უნარების ვერიფიკაცია',
    subtitle: 'გაიარეთ AI-ტესტი დაფიქსირებულ უნარებზე და მიიღეთ „დამოწმებული უნარი" ბეჯი თქვენს საჯარო პროფილზე.',
    noSkills: 'ჯერ არცერთი უნარი არ გაქვთ დაფიქსირებული.',
    addSkills: 'უნარების დამატება პარამეტრებში',
    verified: 'დამოწმებულია',
    verifiedByCourse: 'დამოწმებულია კურსით',
    takeTest: 'ტესტის დაწყება',
    loadingSkills: 'იტვირთება…',
    starting: 'ტესტი მზადდება…',
    question: 'კითხვა',
    practicalLabel: 'პრაქტიკული დავალება',
    practicalPlaceholder: 'აღწერეთ თქვენი მიდგომა რამდენიმე წინადადებით…',
    next: 'შემდეგი',
    finish: 'დასრულება',
    submitting: 'იგზავნება…',
    passedTitle: '🎉 გილოცავთ — უნარი დამოწმებულია!',
    failedTitle: 'ამჯერად ვერ ჩააბარეთ',
    resultScore: 'შედეგი',
    retryHint: 'შეგიძლიათ ხელახლა სცადოთ ნებისმიერ დროს.',
    backToList: '← უნარებთან დაბრუნება',
    error: 'შეცდომა დაფიქსირდა. სცადეთ ხელახლა.',
    timeoutError: 'ტესტის ჩატვირთვას დიდი დრო სჭირდება — შეამოწმეთ ინტერნეტ კავშირი და სცადეთ ხელახლა.',
  },
  en: {
    title: 'Skill Verification',
    subtitle: 'Take an AI-generated test for a declared skill and earn a "Verified Skill" badge on your public profile.',
    noSkills: "You haven't declared any skills yet.",
    addSkills: 'Add skills in Settings',
    verified: 'Verified',
    verifiedByCourse: 'Verified via course',
    takeTest: 'Take Test',
    loadingSkills: 'Loading…',
    starting: 'Preparing your test…',
    question: 'Question',
    practicalLabel: 'Practical question',
    practicalPlaceholder: 'Describe your approach in a few sentences…',
    next: 'Next',
    finish: 'Finish',
    submitting: 'Submitting…',
    passedTitle: '🎉 Congratulations — skill verified!',
    failedTitle: "You didn't pass this time",
    resultScore: 'Score',
    retryHint: 'You can try again any time.',
    backToList: '← Back to skills',
    error: 'Something went wrong. Please try again.',
    timeoutError: 'Loading the test is taking too long — check your connection and try again.',
  },
} as const;

function SkillsContent() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];

  const [phase, setPhase] = useState<Phase>('list');
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [mySkills, setMySkills] = useState<MySkillsResult | null>(null);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<SkillClientQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [practicalAnswer, setPracticalAnswer] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(SECONDS_PER_QUESTION);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitSkillTestResult | null>(null);
  const submittingRef = useRef(false);

  const loadSkills = useCallback(() => {
    setLoadingSkills(true);
    getMySkills()
      .then(setMySkills)
      .catch(() => setMySkills({ declaredSkills: [], verifiedSkills: [] }))
      .finally(() => setLoadingSkills(false));
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const verifiedByName = new Map((mySkills?.verifiedSkills ?? []).map((v) => [v.skillName, v]));

  const handleSubmit = useCallback(async () => {
    if (!attemptId || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await submitSkillTest(attemptId, { mcqAnswers, practicalAnswer });
      setResult(res);
      setPhase('result');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.error);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [attemptId, mcqAnswers, practicalAnswer, t.error]);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  // Per-question 90s countdown — auto-advances (or auto-submits on the last
  // question) when it hits zero, recording whatever was answered so far.
  useEffect(() => {
    if (phase !== 'in-progress' || !currentQuestion) return;
    setSecondsLeft(SECONDS_PER_QUESTION);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (isLastQuestion) {
            handleSubmit();
          } else {
            setCurrentIndex((i) => i + 1);
          }
          return SECONDS_PER_QUESTION;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex, currentQuestion, isLastQuestion]);

  const startTest = async (skillName: string) => {
    setActiveSkill(skillName);
    setPhase('starting');
    setError(null);
    try {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), GENERATE_TIMEOUT_MS);
      });
      const test = await Promise.race([generateSkillTest(skillName, lang), timeout]);
      setAttemptId(test.attemptId);
      setQuestions(test.questions);
      setCurrentIndex(0);
      setMcqAnswers({});
      setPracticalAnswer('');
      setPhase('in-progress');
    } catch (err: any) {
      setError(err?.message === 'timeout' ? t.timeoutError : err?.response?.data?.message ?? t.error);
      setPhase('list');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 flex flex-col">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full">
        {phase !== 'in-progress' && <BackButton fallbackHref="/dashboard" className="mb-6" />}

        {phase === 'list' && (
          <>
            <h1 className="text-2xl font-black mb-2 flex items-center gap-2">
              <Award className="w-6 h-6 text-cyan-500" /> {t.title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t.subtitle}</p>

            {error && (
              <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</div>
            )}

            {loadingSkills ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.loadingSkills}</p>
            ) : !mySkills || mySkills.declaredSkills.length === 0 ? (
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-10 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t.noSkills}</p>
                <Link
                  href="/dashboard/settings"
                  className="inline-block text-xs font-bold text-white bg-slate-900 dark:bg-cyan-600 px-4 py-2.5 rounded-xl no-underline"
                >
                  {t.addSkills}
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {mySkills.declaredSkills.map((skill) => {
                  const verified = verifiedByName.get(skill);
                  return (
                    <div
                      key={skill}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-5"
                    >
                      <div>
                        <p className="font-bold text-sm">{skill}</p>
                        {verified && (
                          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">
                            {verified.verifiedVia === 'COURSE_COMPLETION' ? (
                              <GraduationCap className="w-3.5 h-3.5" />
                            ) : (
                              <ShieldCheck className="w-3.5 h-3.5" />
                            )}
                            {verified.verifiedVia === 'COURSE_COMPLETION' ? t.verifiedByCourse : t.verified}
                            {verified.score != null ? ` (${Math.round(verified.score)}%)` : ''}
                          </p>
                        )}
                      </div>
                      {!verified && (
                        <button
                          type="button"
                          onClick={() => startTest(skill)}
                          className="shrink-0 text-xs font-bold px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                        >
                          {t.takeTest}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {phase === 'starting' && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.starting}</p>
          </div>
        )}

        {phase === 'in-progress' && currentQuestion && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t.question} {currentIndex + 1} / {questions.length}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold ${
                  secondsLeft <= 15 ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> {secondsLeft}s
              </span>
            </div>
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-6">
              <p className="text-sm font-bold mb-5">{currentQuestion.question}</p>
              {currentQuestion.type === 'mcq' ? (
                <div className="space-y-2">
                  {(['A', 'B', 'C', 'D'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMcqAnswers((prev) => ({ ...prev, [currentQuestion.id]: key }))}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                        mcqAnswers[currentQuestion.id] === key
                          ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className="font-bold mr-2">{key}.</span>
                      {currentQuestion.options[key]}
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                    {t.practicalLabel}
                  </label>
                  <textarea
                    rows={5}
                    value={practicalAnswer}
                    onChange={(e) => setPracticalAnswer(e.target.value)}
                    placeholder={t.practicalPlaceholder}
                    maxLength={4000}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-5">
              {!isLastQuestion ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => i + 1)}
                  className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-bold text-white"
                >
                  {t.next}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {submitting ? t.submitting : t.finish}
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
                <h2 className="text-xl font-black mb-1">{t.passedTitle}</h2>
              </>
            ) : (
              <>
                <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-black mb-1">{t.failedTitle}</h2>
              </>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 mt-4">
              {activeSkill} — {t.resultScore}: {result.totalScore}% ({lang === 'ka' ? 'ბარიერი' : 'threshold'} {PASS_THRESHOLD}%)
            </p>
            {!result.passed && <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">{t.retryHint}</p>}
            {result.practicalFeedback && (
              <div className="text-left rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-4 mb-6">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">{t.practicalLabel}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{result.practicalFeedback}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setPhase('list');
                setResult(null);
                loadSkills();
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-6 py-2.5 text-sm font-bold"
            >
              {t.backToList}
            </button>
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}

export default function SkillsPage() {
  return (
    <ProtectedRoute>
      <SkillsContent />
    </ProtectedRoute>
  );
}
