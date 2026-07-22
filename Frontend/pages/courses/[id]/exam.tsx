import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import { Course, ExamStatus, ExamQuestion, ExamSubmitResult, ExamAnswerLetter } from '../../../src/types/lms';
import { getCourse, getExamStatus, startExam, submitExam } from '../../../src/services/courseService';

const dict = {
  ka: {
    loading: 'იტვირთება…',
    back: 'კურსზე დაბრუნება',
    notConfigured: 'ამ კურსს ჯერ არ აქვს სერტიფიცირების გამოცდა.',
    notComplete: 'გამოცდის დასაწყებად საჭიროა კურსის ყველა გაკვეთილის დასრულება.',
    goToLessons: 'გაკვეთილებზე დაბრუნება',
    alreadyPassed: '🎉 თქვენ უკვე ჩააბარეთ ეს გამოცდა!',
    downloadCert: 'სერტიფიკატის ჩამოტვირთვა',
    cooldownTitle: 'ხელახლა ცდა ჯერ არ არის ხელმისაწვდომი',
    cooldownBody: 'თქვენი შემდეგი ცდა შესაძლებელი იქნება:',
    weakTopics: 'გაამყარეთ ცოდნა შემდეგ თემებში:',
    startTitle: '🎓 სერტიფიცირების გამოცდა',
    startBody: (n: number, p: number) => `გამოცდა შედგება ${n} კითხვისგან. გასავლელად საჭიროა მინიმუმ ${p}% სისწორე.`,
    startButton: 'გამოცდის დაწყება',
    starting: 'გენერირდება…',
    timeLeft: 'დარჩენილი დრო',
    question: 'კითხვა',
    of: '/',
    submit: 'პასუხების გაგზავნა',
    submitting: 'მოწმდება…',
    submitConfirm: 'დარწმუნებული ხართ? ყველა კითხვას პასუხი არ გაქვთ გაცემული.',
    passedTitle: '🎉 გილოცავთ, ჩააბარეთ!',
    failedTitle: 'სამწუხაროდ, ვერ ჩააბარეთ',
    yourScore: 'თქვენი შედეგი',
    retakeAfter: 'ხელახლა ცდა შესაძლებელი იქნება:',
    reviewTitle: 'პასუხების მიმოხილვა',
    correct: 'სწორია',
    incorrect: 'არასწორია',
    yourAnswer: 'თქვენი პასუხი',
    correctAnswer: 'სწორი პასუხი',
    noAnswer: '(პასუხგაუცემელი)',
    error: 'დაფიქსირდა შეცდომა. სცადეთ თავიდან.',
  },
  en: {
    loading: 'Loading…',
    back: 'Back to course',
    notConfigured: 'This course does not have a certification exam yet.',
    notComplete: 'Complete every lesson in this course before taking the exam.',
    goToLessons: 'Back to lessons',
    alreadyPassed: '🎉 You have already passed this exam!',
    downloadCert: 'Download Certificate',
    cooldownTitle: 'Retake not available yet',
    cooldownBody: 'You can try again at:',
    weakTopics: 'Brush up on these topics:',
    startTitle: '🎓 Certification Exam',
    startBody: (n: number, p: number) => `This exam has ${n} questions. You need at least ${p}% correct to pass.`,
    startButton: 'Start Exam',
    starting: 'Generating…',
    timeLeft: 'Time left',
    question: 'Question',
    of: 'of',
    submit: 'Submit Answers',
    submitting: 'Grading…',
    submitConfirm: "Are you sure? You haven't answered every question.",
    passedTitle: '🎉 Congratulations, you passed!',
    failedTitle: "You didn't pass this time",
    yourScore: 'Your score',
    retakeAfter: 'You can retake the exam at:',
    reviewTitle: 'Answer Review',
    correct: 'Correct',
    incorrect: 'Incorrect',
    yourAnswer: 'Your answer',
    correctAnswer: 'Correct answer',
    noAnswer: '(not answered)',
    error: 'Something went wrong. Please try again.',
  },
};

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
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const courseId = typeof router.query.id === 'string' ? router.query.id : null;

  const [course, setCourse] = useState<Course | null>(null);
  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

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
      setError(t.error);
      setPhase('blocked');
    }
  }, [courseId, t.error]);

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
      if (res.passed) fireConfetti();
    } catch {
      setError(t.error);
    } finally {
      setSubmitting(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [courseId, t.error]);

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
      const res = await startExam(courseId);
      setSessionToken(res.sessionToken);
      setQuestions(res.questions);
      setPassingScore(res.passingScore);
      setAnswers({});
      setSecondsLeft(res.durationMinutes * 60);
      setPhase('in-progress');
    } catch {
      setError(t.error);
    } finally {
      setStarting(false);
    }
  };

  const handleSubmitClick = () => {
    if (Object.keys(answers).length < questions.length) {
      if (!window.confirm(t.submitConfirm)) return;
    }
    finishExam();
  };

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  if (phase === 'loading') {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">{t.loading}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 md:py-12">
      <Head>
        <title>{course ? `${t.startTitle} — ${course.title}` : t.startTitle} | CDC Learn</title>
      </Head>

      <div className="max-w-3xl mx-auto">
        {courseId && phase !== 'in-progress' && (
          <Link href={`/courses/${courseId}/learn`} className="text-xs text-cyan-400 hover:underline mb-6 inline-block">
            ← {t.back}
          </Link>
        )}

        {error && <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">{error}</div>}

        {phase === 'blocked' && status && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center">
            {!status.configured && <p className="text-slate-300">{t.notConfigured}</p>}

            {status.configured && status.passed && (
              <>
                <p className="text-xl font-bold text-emerald-400 mb-4">{t.alreadyPassed}</p>
                <Link
                  href={`/courses/${courseId}/learn`}
                  className="inline-block rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm px-6 py-3 shadow-lg hover:shadow-xl transition-all"
                >
                  {t.downloadCert}
                </Link>
              </>
            )}

            {status.configured && !status.passed && !status.courseComplete && (
              <>
                <p className="text-slate-300 mb-4">{t.notComplete}</p>
                <Link href={`/courses/${courseId}/learn`} className="text-cyan-400 hover:underline text-sm font-medium">
                  {t.goToLessons}
                </Link>
              </>
            )}

            {status.configured && !status.passed && status.courseComplete && status.inCooldown && (
              <>
                <p className="text-lg font-bold text-amber-400 mb-2">{t.cooldownTitle}</p>
                <p className="text-slate-300 mb-4">
                  {t.cooldownBody} <span className="font-semibold text-white">{status.cooldownEndsAt && formatDateTime(status.cooldownEndsAt)}</span>
                </p>
                {!!status.weakTopics?.length && (
                  <p className="text-sm text-slate-400">
                    {t.weakTopics} <span className="text-slate-200">{status.weakTopics.join(', ')}</span>
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {phase === 'ready' && status?.configured && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center">
            <h1 className="text-2xl font-black mb-3">{t.startTitle}</h1>
            <p className="text-slate-300 mb-6">{t.startBody(status.questionCount ?? 0, status.passingScore ?? 0)}</p>
            {!!status.weakTopics?.length && (
              <p className="text-sm text-amber-400 mb-6">
                {t.weakTopics} {status.weakTopics.join(', ')}
              </p>
            )}
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-bold text-sm px-8 py-3.5 shadow-lg hover:shadow-xl transition-all disabled:opacity-60"
            >
              {starting ? t.starting : t.startButton}
            </button>
          </div>
        )}

        {phase === 'in-progress' && (
          <div>
            <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-6 bg-slate-950/95 backdrop-blur border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {answeredCount}/{questions.length} {t.of === '/' ? '' : ''}
              </span>
              <span className={`text-sm font-mono font-bold ${secondsLeft <= 60 ? 'text-red-400' : 'text-cyan-400'}`}>
                {t.timeLeft}: {formatCountdown(secondsLeft)}
              </span>
            </div>

            <div className="space-y-6">
              {questions.map((q, idx) => (
                <div key={q.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                  <p className="text-xs text-cyan-400 font-semibold mb-1">
                    {t.question} {idx + 1} {t.of} {questions.length}
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
                {submitting ? t.submitting : t.submit}
              </button>
            </div>
          </div>
        )}

        {phase === 'result' && result && (
          <div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center mb-8">
              <h1 className={`text-2xl font-black mb-3 ${result.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.passed ? t.passedTitle : t.failedTitle}
              </h1>
              <p className="text-slate-300 mb-1">{t.yourScore}</p>
              <p className="text-4xl font-black mb-4">
                {result.score}% <span className="text-base font-normal text-slate-500">/ {result.passingScore}%</span>
              </p>
              <p className="text-sm text-slate-400 mb-6">
                {result.correctCount} / {result.total}
              </p>

              {result.passed ? (
                <Link
                  href={`/courses/${courseId}/learn`}
                  className="inline-block rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm px-6 py-3 shadow-lg hover:shadow-xl transition-all"
                >
                  {t.downloadCert}
                </Link>
              ) : (
                <>
                  {result.cooldownEndsAt && (
                    <p className="text-sm text-slate-400 mb-2">
                      {t.retakeAfter} <span className="font-semibold text-white">{formatDateTime(result.cooldownEndsAt)}</span>
                    </p>
                  )}
                  {!!result.weakTopics.length && (
                    <p className="text-sm text-amber-400">
                      {t.weakTopics} {result.weakTopics.join(', ')}
                    </p>
                  )}
                </>
              )}
            </div>

            <h2 className="text-sm font-semibold text-slate-400 mb-4">{t.reviewTitle}</h2>
            <div className="space-y-4">
              {result.review.map((q, idx) => (
                <div
                  key={q.id}
                  className={`rounded-xl border p-5 ${q.correct ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}
                >
                  <p className="text-xs font-semibold mb-1 flex items-center gap-2">
                    <span className={q.correct ? 'text-emerald-400' : 'text-red-400'}>{q.correct ? `✓ ${t.correct}` : `✕ ${t.incorrect}`}</span>
                    <span className="text-slate-500">
                      {t.question} {idx + 1}
                    </span>
                  </p>
                  <p className="text-sm font-medium mb-3">{q.question}</p>
                  <p className="text-xs text-slate-400 mb-1">
                    {t.yourAnswer}: <span className="text-slate-200">{q.selected ? `${q.selected} — ${q.options[q.selected]}` : t.noAnswer}</span>
                  </p>
                  {!q.correct && (
                    <p className="text-xs text-slate-400 mb-2">
                      {t.correctAnswer}: <span className="text-emerald-300">{q.correctAnswer} — {q.options[q.correctAnswer]}</span>
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
      <ExamContent />
    </ProtectedRoute>
  );
}
