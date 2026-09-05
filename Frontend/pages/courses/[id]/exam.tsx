import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import confetti from 'canvas-confetti';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import ToolErrorBoundary from '../../../src/components/common/ToolErrorBoundary';
import { useAuth } from '../../../src/context/AuthContext';
import { Course, ExamStatus, ExamQuestion, ExamSubmitResult, ExamAnswerLetter } from '../../../src/types/lms';
import { getCourse, getExamStatus, startExam, submitExam } from '../../../src/services/courseService';
import { resolveLocale } from '../../../src/utils/locale';

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function fireConfetti() {
  const end = Date.now() + 1500;
  const colors = ['#6366f1', '#f59e0b', '#10b981'];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 65, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 65, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

type Phase = 'loading' | 'blocked' | 'ready' | 'in-progress' | 'result';

function ExamContent() {
  const router = useRouter();
  const { t } = useTranslation('courses');
  const courseId = typeof router.query.id === 'string' ? router.query.id : null;
  const { refreshUser } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // The AI exam generator only produces 'ka'/'en' exams (see startExam /
  // aiExamService) — resolveLocale's other 4 locales collapse to English.
  const [examLang, setExamLang] = useState<'ka' | 'en'>(resolveLocale(router.locale) === 'ka' ? 'ka' : 'en');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [passingScore, setPassingScore] = useState(0);
  const [answers, setAnswers] = useState<Record<string, ExamAnswerLetter>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamSubmitResult | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const sessionTokenRef = useRef(sessionToken);
  sessionTokenRef.current = sessionToken;

  const load = useCallback(async () => {
    if (!courseId) return;
    setPhase('loading');
    setError(null);
    try {
      const [courseData, statusData] = await Promise.all([getCourse(courseId), getExamStatus(courseId)]);
      setCourse(courseData);
      setStatus(statusData);
      setPhase(statusData.configured && statusData.canStart ? 'ready' : 'blocked');
    } catch {
      setError(t('error'));
      setPhase('blocked');
    }
  }, [courseId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const finishExam = useCallback(async () => {
    if (!courseId || !sessionTokenRef.current) return;
    setSubmitting(true);
    try {
      const res = await submitExam(courseId, sessionTokenRef.current, answersRef.current);
      setResult(res);
      setPhase('result');
      if (res.passed) {
        fireConfetti();
        // Passing instantly grants isVerifiedGraduate server-side (glowing
        // badge, unlimited posts, mentorship button) — refresh the cached
        // user so those show up immediately without a re-login.
        refreshUser().catch(() => {});
      }
    } catch {
      setError(t('error'));
    } finally {
      setSubmitting(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [courseId, t]);

  useEffect(() => {
    if (phase !== 'in-progress') return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          finishExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, finishExam]);

  const handleStart = async () => {
    if (!courseId) return;
    setStarting(true);
    setError(null);
    try {
      const res = await startExam(courseId, examLang);
      setSessionToken(res.sessionToken);
      setQuestions(res.questions);
      setPassingScore(res.passingScore);
      setAnswers({});
      setSecondsLeft(res.durationMinutes * 60);
      setPhase('in-progress');
    } catch {
      setError(t('error'));
    } finally {
      setStarting(false);
    }
  };

  const handleSubmitClick = () => {
    if (Object.keys(answers).length < questions.length) {
      if (!window.confirm(t('submitConfirm'))) return;
    }
    finishExam();
  };

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  if (phase === 'loading') {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">{t('loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 md:py-12">
      <Head>
        <title>{`${course ? `${t('startTitle')} — ${course.title}` : t('startTitle')} | CDC Learn`}</title>
      </Head>

      <div className="max-w-3xl mx-auto">
        {courseId && phase !== 'in-progress' && (
          <Link href={`/courses/${courseId}/learn`} className="text-xs text-cyan-400 hover:underline mb-6 inline-block">
            ← {t('back')}
          </Link>
        )}

        {error && <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">{error}</div>}

        {phase === 'blocked' && status && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center">
            {!status.configured && <p className="text-slate-300">{t('notConfigured')}</p>}

            {status.configured && status.passed && (
              <>
                <p className="text-xl font-bold text-emerald-400 mb-4">{t('alreadyPassed')}</p>
                <Link
                  href="/dashboard/certificates"
                  className="inline-block rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm px-6 py-3 shadow-lg hover:shadow-xl transition-all"
                >
                  {t('downloadCert')}
                </Link>
              </>
            )}

            {status.configured && !status.passed && !status.courseComplete && (
              <>
                <p className="text-slate-300 mb-4">{t('notComplete')}</p>
                <Link href={`/courses/${courseId}/learn`} className="text-cyan-400 hover:underline text-sm font-medium">
                  {t('goToLessons')}
                </Link>
              </>
            )}

            {status.configured && !status.passed && status.courseComplete && status.inCooldown && (
              <>
                <p className="text-lg font-bold text-amber-400 mb-2">{t('cooldownTitle')}</p>
                <p className="text-slate-300 mb-4">
                  {t('cooldownBody')} <span className="font-semibold text-white">{status.cooldownEndsAt && formatDateTime(status.cooldownEndsAt)}</span>
                </p>
                {!!status.weakTopics?.length && (
                  <p className="text-sm text-slate-400">
                    {t('weakTopics')} <span className="text-slate-200">{status.weakTopics.join(', ')}</span>
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {phase === 'ready' && status?.configured && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center">
            <h1 className="text-2xl font-black mb-3">{t('startTitle')}</h1>
            <p className="text-slate-300 mb-6">
              {t('startBody', { count: status.questionCount ?? 0, percent: status.passingScore ?? 0 })}
            </p>
            {!!status.weakTopics?.length && (
              <p className="text-sm text-amber-400 mb-6">
                {t('weakTopics')} {status.weakTopics.join(', ')}
              </p>
            )}

            <p className="text-xs font-semibold text-slate-400 mb-3">{t('chooseLang')}</p>
            <div className="flex items-center justify-center gap-3 mb-8">
              {(['ka', 'en'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setExamLang(code)}
                  className={`rounded-xl border px-5 py-2.5 text-sm font-bold transition-colors ${
                    examLang === code
                      ? 'border-cyan-400 bg-cyan-400/10 text-white'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {code === 'ka' ? t('langKa') : t('langEn')}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-bold text-sm px-8 py-3.5 shadow-lg hover:shadow-xl transition-all disabled:opacity-60"
            >
              {starting ? t('starting') : t('startButton')}
            </button>
          </div>
        )}

        {phase === 'in-progress' && (
          <div>
            <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-6 bg-slate-950/95 backdrop-blur border-b border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">
                  {answeredCount}/{questions.length}
                </span>
                <span className={`text-sm font-mono font-bold ${secondsLeft <= 60 ? 'text-red-400' : 'text-cyan-400'}`}>
                  {t('timeLeft')}: {formatCountdown(secondsLeft)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                  style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="space-y-6">
              {questions.map((q, idx) => (
                <div key={q.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                  <p className="text-xs text-cyan-400 font-semibold mb-1">
                    {t('question')} {idx + 1} {t('of')} {questions.length}
                  </p>
                  <p className="text-base font-semibold mb-4">{q.question}</p>
                  <div className="space-y-2">
                    {(['A', 'B', 'C', 'D'] as const).map((letter) => (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: letter }))}
                        className={`w-full text-left flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors cursor-pointer ${
                          answers[q.id] === letter
                            ? 'border-cyan-400 bg-cyan-400/10 text-white'
                            : 'border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <span
                          className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border ${
                            answers[q.id] === letter ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-slate-600 text-slate-400'
                          }`}
                        >
                          {letter}
                        </span>
                        <span>{q.options[letter]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={handleSubmitClick}
                disabled={submitting}
                className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-bold text-sm px-8 py-3.5 shadow-lg hover:shadow-xl transition-all disabled:opacity-60"
              >
                {submitting ? t('submitting') : t('submit')}
              </button>
            </div>
          </div>
        )}

        {phase === 'result' && result && (
          <div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center mb-8">
              <h1 className={`text-2xl font-black mb-3 ${result.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.passed ? t('passedTitle') : t('failedTitle')}
              </h1>
              <p className="text-slate-300 mb-1">{t('yourScore')}</p>
              <p className="text-4xl font-black mb-4">
                {result.score}% <span className="text-base font-normal text-slate-500">/ {result.passingScore}%</span>
              </p>
              <p className="text-sm text-slate-400 mb-6">
                {result.correctCount} / {result.total}
              </p>

              {result.passed ? (
                <Link
                  href="/dashboard/certificates"
                  className="inline-block rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm px-6 py-3 shadow-lg hover:shadow-xl transition-all"
                >
                  {t('downloadCert')}
                </Link>
              ) : (
                <>
                  {result.cooldownEndsAt && (
                    <p className="text-sm text-slate-400 mb-2">
                      {t('retakeAfter')} <span className="font-semibold text-white">{formatDateTime(result.cooldownEndsAt)}</span>
                    </p>
                  )}
                  {!!result.weakTopics.length && (
                    <p className="text-sm text-amber-400">
                      {t('weakTopics')} {result.weakTopics.join(', ')}
                    </p>
                  )}
                </>
              )}
            </div>

            <h2 className="text-sm font-semibold text-slate-400 mb-4">{t('reviewTitle')}</h2>
            <div className="space-y-4">
              {result.review.map((q, idx) => (
                <div
                  key={q.id}
                  className={`rounded-xl border p-5 ${q.correct ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}
                >
                  <p className="text-xs font-semibold mb-1 flex items-center gap-2">
                    <span className={q.correct ? 'text-emerald-400' : 'text-red-400'}>{q.correct ? `✓ ${t('correct')}` : `✕ ${t('incorrect')}`}</span>
                    <span className="text-slate-500">
                      {t('question')} {idx + 1}
                    </span>
                  </p>
                  <p className="text-sm font-medium mb-3">{q.question}</p>
                  <p className="text-xs text-slate-400 mb-1">
                    {t('yourAnswer')}: <span className="text-slate-200">{q.selected ? `${q.selected} — ${q.options[q.selected]}` : t('noAnswer')}</span>
                  </p>
                  {!q.correct && (
                    <p className="text-xs text-slate-400 mb-2">
                      {t('correctAnswer')}: <span className="text-emerald-300">{q.correctAnswer} — {q.options[q.correctAnswer]}</span>
                    </p>
                  )}
                  <p className="text-xs text-slate-500 italic">{q.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExamPage() {
  return (
    <ProtectedRoute>
      <ToolErrorBoundary>
        <ExamContent />
      </ToolErrorBoundary>
    </ProtectedRoute>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['courses'])) },
});
