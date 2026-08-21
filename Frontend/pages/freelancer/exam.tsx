import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { ShieldAlert, CheckCircle2, XCircle, Loader2, RefreshCw, Clock, HelpCircle, Target, AlertTriangle, Play } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import RoleGate from '../../src/components/auth/RoleGate';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import Toast from '../../src/components/shared/Toast';
import { JOB_CATEGORIES, JOB_CATEGORY_LABEL } from '../../src/utils/jobCategory';
import { JobCategory } from '../../src/types/community';
import { generateExam, submitExam, getExamStatus, ExamQuestion, ExamAttemptResult } from '../../src/services/freelancerExamService';
import { resolveLocale, SupportedLocale } from '../../src/utils/locale';

const MAX_STRIKES = 3;
// Mirrors Backend's routes/freelancerExam.ts (PASS_THRESHOLD, QUESTION_COUNT)
// — there is no server-side time limit on the exam itself, only the
// tab-switch/fullscreen-exit strike system below.
const PASS_THRESHOLD = 80;
const QUESTION_COUNT = 15;
// Mirrors Backend's routes/freelancerExam.ts EXAM_LOCK_HOURS.
const EXAM_LOCK_HOURS = 24;
// generateExam calls out to an AI question generator — bound how long we
// wait so a slow/stuck request surfaces a retry instead of spinning forever.
const GENERATE_TIMEOUT_MS = 45000;
// Per-question countdown — purely client-side pacing (the server has no
// concept of per-question timing, see the note on PASS_THRESHOLD above), so
// running out never disqualifies the attempt, it just auto-advances.
const QUESTION_TIME_LIMIT_SECONDS = 90;

type Phase = 'select' | 'rules' | 'starting' | 'in-progress' | 'result';

// The one rules-card component both the pre-test screen and the failed-
// result screen render — same visual container, same three anti-cheat
// bullets, so the two can never silently drift apart the way the old
// hand-duplicated pre-test/result cards had (different wording, same
// header). `practicalInfo`/`categoryLabel` are pre-test-only; `retakeNote`
// is written by the caller since its wording depends on context (a blanket
// warning before the attempt vs. a specific "you can retry now/in 24h"
// after one already failed).
function ExamRulesCard({
  lang,
  categoryLabel,
  practicalInfo,
  retakeNote,
}: {
  lang: SupportedLocale;
  categoryLabel?: string;
  practicalInfo?: { timeLimit: string; questionCount: number; passThreshold: number };
  retakeNote: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 overflow-hidden">
      <div className="bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-4">
        {categoryLabel && <p className="text-xs font-bold uppercase tracking-widest text-cyan-100">{categoryLabel}</p>}
        <h2 className="text-lg font-black text-white">ტესტირების წესები და პირობები</h2>
      </div>
      <div className="p-6 space-y-4">
        {practicalInfo && (
          <>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
              <p className="text-sm">
                <span className="font-bold">{lang === 'ka' ? 'დროის ლიმიტი კითხვაზე:' : 'Time limit per question:'}</span> {practicalInfo.timeLimit}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
              <p className="text-sm">
                <span className="font-bold">{lang === 'ka' ? 'კითხვების რაოდენობა:' : 'Number of questions:'}</span> {practicalInfo.questionCount}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
              <p className="text-sm">
                <span className="font-bold">{lang === 'ka' ? 'გადალახვის ბარიერი:' : 'Passing threshold:'}</span> {practicalInfo.passThreshold}%
              </p>
            </div>
          </>
        )}
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {lang === 'ka'
              ? 'ტესტირების მიმდინარეობისას საჭიროა სრულეკრანიან რეჟიმში ყოფნა და ბრაუზერის ტაბზე/ფანჯარაზე ფოკუსის შენარჩუნება.'
              : 'The exam requires staying in fullscreen mode and keeping focus on the browser tab/window at all times.'}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {lang === 'ka'
              ? `ტაბის გადართვა, ფოკუსის დაკარგვა ან სრულეკრანიანი რეჟიმიდან გამოსვლა ითვლება დარღვევად — ${MAX_STRIKES} დარღვევის შემთხვევაში ტესტი ავტომატურად წყდება.`
              : `Tab switching, losing window focus, or exiting fullscreen counts as a violation — ${MAX_STRIKES} violations auto-submit and terminate the exam.`}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <RefreshCw className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600 dark:text-slate-300">{retakeNote}</p>
        </div>
      </div>
    </div>
  );
}

function FreelancerExamContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);

  const [phase, setPhase] = useState<Phase>('select');
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [customProfession, setCustomProfession] = useState('');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [strikes, setStrikes] = useState(0);
  const [warningToast, setWarningToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamAttemptResult | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [violationReason, setViolationReason] = useState<string | null>(null);
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(QUESTION_TIME_LIMIT_SECONDS);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const strikeGuardRef = useRef(false);

  useEffect(() => {
    getExamStatus()
      .then((res) => setLockedUntil(res.examLockedUntil))
      .catch(() => {});
  }, []);

  // Pre-populates from VerificationDrawer's "Freelancer" tab, which
  // multi-selects professions before ever landing here — router.isReady
  // guards against reading query before Next.js has parsed it client-side.
  useEffect(() => {
    if (!router.isReady) return;
    const rawCategories = router.query.categories;
    if (typeof rawCategories === 'string' && rawCategories.length > 0) {
      const valid = rawCategories.split(',').filter((c): c is JobCategory => JOB_CATEGORIES.includes(c as JobCategory));
      if (valid.length > 0) setCategories(valid);
    }
    const rawOther = router.query.other;
    if (typeof rawOther === 'string' && rawOther.length > 0) setCustomProfession(rawOther);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // Live countdown for the lockout screen — re-renders every 30s so the
  // remaining time stays roughly accurate without a per-second timer.
  useEffect(() => {
    if (!lockedUntil) return;
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  const isLocked = !!lockedUntil && new Date(lockedUntil).getTime() > nowTick;

  const handleSubmit = useCallback(
    async (disqualified = false) => {
      if (!attemptId || submitting) return;
      setSubmitting(true);
      try {
        const res = await submitExam(attemptId, answers, disqualified);
        setResult(res);
        setPhase('result');
        if (res.examLockedUntil) setLockedUntil(res.examLockedUntil);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      } catch (err: any) {
        setError(err?.response?.data?.message ?? 'შეფასების გაგზავნა ვერ მოხერხდა.');
      } finally {
        setSubmitting(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [attemptId, answers, submitting]
  );

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
          setViolationReason(reason);
          setWarningToast(lang === 'ka' ? 'გამოვლენილია განმეორებითი დარღვევა — გამოცდა ავტომატურად იგზავნება.' : 'Repeated violation detected — auto-submitting the exam.');
          handleSubmit(true);
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

  const toggleCategory = (cat: JobCategory) => {
    setCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
    setError(null);
  };

  const canProceed = categories.length > 0 || customProfession.trim().length > 0;

  // No longer jumps straight into the (fullscreen, timed-strike) exam once
  // a profession is picked — this opens the rules screen first so the user
  // explicitly opts in via "ტესტირების დაწყება" before anything starts.
  const proceedToRules = () => {
    if (!canProceed) return;
    setError(null);
    setPhase('rules');
  };

  const combinedLabel = [...categories.map((c) => JOB_CATEGORY_LABEL[c][lang]), customProfession.trim()].filter(Boolean).join(' + ');

  const confirmStart = async () => {
    if (!canProceed) return;
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
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), GENERATE_TIMEOUT_MS);
      });
      // The AI skill-exam generator only produces 'ka'/'en' exams.
      const exam = await Promise.race([
        generateExam(categories, customProfession.trim() || undefined, lang === 'ka' ? 'ka' : 'en'),
        timeout,
      ]);
      setAttemptId(exam.attemptId);
      setQuestions(exam.questions);
      setCurrentIndex(0);
      setAnswers({});
      setStrikes(0);
      setViolationReason(null);
      setPhase('in-progress');
    } catch (err: any) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setError(
        err?.message === 'timeout'
          ? lang === 'ka'
            ? 'გამოცდის ჩატვირთვას დიდი დრო სჭირდება — შეამოწმეთ ინტერნეტ კავშირი და სცადეთ ხელახლა.'
            : 'Loading the exam is taking too long — check your connection and try again.'
          : err?.response?.data?.message ?? 'გამოცდის გენერაცია ვერ მოხერხდა.'
      );
      setPhase('rules');
    }
  };

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  // Per-question countdown — resets whenever a genuinely new question comes
  // into view (keyed on the question's own id, not just currentIndex, so a
  // re-render that doesn't actually change the question can't restart the
  // clock). Reaching 0 auto-advances exactly like the manual "შემდეგი"
  // button would (or auto-submits on the last question, like "დასრულება"),
  // leaving the question unanswered in `answers` if none was picked — same
  // as a manual skip would.
  useEffect(() => {
    if (phase !== 'in-progress' || !currentQuestion) return;
    setQuestionSecondsLeft(QUESTION_TIME_LIMIT_SECONDS);
    const timer = setInterval(() => {
      setQuestionSecondsLeft((prev) => {
        if (prev <= 1) {
          if (isLastQuestion) {
            handleSubmit();
          } else {
            setCurrentIndex((i) => i + 1);
          }
          return QUESTION_TIME_LIMIT_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentQuestion?.id]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 flex flex-col">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full">
        {phase !== 'in-progress' && <BackButton fallbackHref="/dashboard" className="mb-6" />}
        <h1 className="text-2xl font-black mb-2">CDC Verified Freelancer — უნარების შემოწმება</h1>

        {error && phase !== 'rules' && (
          <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</div>
        )}

        {isLocked && (phase === 'select' || phase === 'rules') && lockedUntil && (
          <div className="rounded-2xl border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6 flex items-start gap-4">
            <ShieldAlert className="w-8 h-8 text-red-500 shrink-0" />
            <div>
              <h2 className="text-sm font-black text-red-700 dark:text-red-300 mb-1">ტესტირება დაბლოკილია</h2>
              <p className="text-sm text-red-600 dark:text-red-300">
                ტესტირება დაბლოკილია 3 დარღვევის გამო. დარჩენილი დრო:{' '}
                {(() => {
                  const remainingMs = Math.max(0, new Date(lockedUntil).getTime() - nowTick);
                  const hours = Math.floor(remainingMs / 3_600_000);
                  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);
                  return `${hours} საათი და ${minutes} წუთი`;
                })()}
                .
              </p>
            </div>
          </div>
        )}

        {!isLocked && phase === 'select' && (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {lang === 'ka'
                ? 'აირჩიეთ ერთი ან რამდენიმე პროფესია — ტესტი დაფარავს ყველა არჩეულს ერთდროულად.'
                : 'Select one or more professions — the test will cover all of them at once.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {JOB_CATEGORIES.filter((c) => c !== 'other').map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`text-left rounded-2xl border backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 p-5 ${
                    categories.includes(cat)
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10'
                      : 'border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10'
                  }`}
                >
                  <p className="font-bold text-sm">{JOB_CATEGORY_LABEL[cat][lang]}</p>
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-5">
              <label className="block font-bold text-sm mb-2">{lang === 'ka' ? 'სხვა პროფესია (არასავალდებულო)' : 'Other profession (optional)'}</label>
              <input
                type="text"
                value={customProfession}
                onChange={(e) => setCustomProfession(e.target.value)}
                placeholder={lang === 'ka' ? 'ჩაწერეთ თქვენი პროფესია…' : 'Type your profession…'}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 px-3.5 py-2.5 text-sm"
              />
            </div>

            <div className="flex justify-end pt-6">
              <button
                type="button"
                onClick={proceedToRules}
                disabled={!canProceed}
                className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {lang === 'ka' ? 'გაგრძელება →' : 'Continue →'}
              </button>
            </div>
          </>
        )}

        {!isLocked && phase === 'rules' && canProceed && (
          <div>
            <ExamRulesCard
              lang={lang}
              categoryLabel={combinedLabel}
              practicalInfo={{
                timeLimit: lang === 'ka' ? `${QUESTION_TIME_LIMIT_SECONDS} წამი` : `${QUESTION_TIME_LIMIT_SECONDS} seconds`,
                questionCount: QUESTION_COUNT,
                passThreshold: PASS_THRESHOLD,
              }}
              retakeNote={
                lang === 'ka'
                  ? `დაბალი ქულით ჩაჭრის შემთხვევაში ხელახლა ცდა შესაძლებელია დაუყოვნებლივ, ხოლო დარღვევით შეწყვეტისას — ${EXAM_LOCK_HOURS} საათის შემდეგ.`
                  : `If you fail on score alone you can retake immediately; a violation-terminated attempt locks retakes for ${EXAM_LOCK_HOURS} hours.`
              }
            />

            {error && (
              <div className="mt-4 flex items-start gap-3 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3">
                <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-4">
              <button
                type="button"
                onClick={() => { setPhase('select'); setError(null); }}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-sm font-bold"
              >
                ← უკან
              </button>
              <button
                type="button"
                onClick={confirmStart}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-bold text-white"
              >
                {error ? <RefreshCw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {error ? 'ხელახლა ცდა' : 'გაგება და დაწყება'}
              </button>
            </div>
          </div>
        )}

        {phase === 'starting' && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
            <p className="text-sm text-slate-500 dark:text-slate-400">ტესტები იტვირთება, გთხოვთ დაელოდოთ...</p>
          </div>
        )}

        {phase === 'in-progress' && currentQuestion && (
          <div>
            <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-4 flex items-center justify-between bg-slate-100/95 dark:bg-[#0b0f19]/95 backdrop-blur-sm">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                კითხვა {currentIndex + 1} / {questions.length}
              </span>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-black tabular-nums ${
                    questionSecondsLeft <= 10 ? 'text-red-500' : 'text-cyan-600 dark:text-cyan-400'
                  }`}
                >
                  ⏱️ {String(Math.floor(questionSecondsLeft / 60)).padStart(2, '0')}:{String(questionSecondsLeft % 60).padStart(2, '0')}
                </span>
                {strikes > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <ShieldAlert className="w-3.5 h-3.5" /> {strikes}/{MAX_STRIKES}
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6">
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
            <div className="flex flex-col items-end gap-1.5 mt-5">
              <div className="flex justify-end gap-3">
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
                    onClick={() => handleSubmit()}
                    className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {submitting ? 'იგზავნება…' : 'დასრულება'}
                  </button>
                )}
              </div>
              {!answers[currentQuestion.id] && (
                <p className="text-xs text-amber-600 dark:text-amber-400">{lang === 'ka' ? 'გთხოვთ აირჩიოთ პასუხი გასაგრძელებლად.' : 'Please select an answer to continue.'}</p>
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

            {!result.passed && result.examLockedUntil && (
              <div className="mt-4 mb-2 text-left rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-300">
                  {lang === 'ka'
                    ? `ტესტირება შეწყდა დარღვევის გამო${violationReason ? `: ${violationReason}` : ''}.`
                    : `Exam terminated due to violation${violationReason ? `: ${violationReason}` : ''}.`}
                </p>
              </div>
            )}

            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 mt-4">
              შედეგი: {result.score}% ({result.correctCount}/{result.totalQuestions})
            </p>

            {!result.passed && (
              <div className="text-left mb-6">
                <ExamRulesCard
                  lang={lang}
                  retakeNote={
                    result.examLockedUntil
                      ? lang === 'ka'
                        ? `დარღვევით შეწყვეტილი ტესტირების ხელახლა ცდა შესაძლებელია ${EXAM_LOCK_HOURS} საათის შემდეგ.`
                        : `A violation-terminated exam can be retaken after ${EXAM_LOCK_HOURS} hours.`
                      : lang === 'ka'
                      ? 'დაბალი ქულით ჩაჭრის შემთხვევაში ტესტის ხელახლა ცდა შესაძლებელია დაუყოვნებლივ.'
                      : "If you failed on score alone (no violation), you can retake the exam immediately."
                  }
                />
              </div>
            )}

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
      <SiteFooter />
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
