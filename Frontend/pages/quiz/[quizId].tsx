import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';
import { getPublicQuiz, submitPublicQuiz, PublicQuiz, QuizSubmitResult } from '../../src/services/quizService';
import { resolveLocale } from '../../src/utils/locale';

// No teacher-configurable duration exists on TeacherQuiz (unlike the
// proctored ExamSession) — this is a stopwatch counting up, not a countdown
// with a hard cutoff, kept deliberately simple for a classroom quiz link.
type Phase = 'loading' | 'landing' | 'in-progress' | 'submitting' | 'done' | 'error';

// Same "small inline per-locale dict, ka translated + other locales fall
// back to English" convention as pages/exam/[token].tsx — this page has no
// next-i18next namespace of its own.
const dict = {
  ka: {
    loadFailed: 'ეს ტესტის ბმული აღარ არის აქტიური.',
    name: 'სახელი და გვარი',
    namePlaceholder: 'შეიყვანეთ თქვენი სახელი და გვარი',
    start: 'ტესტის დაწყება',
    submit: 'პასუხების გაგზავნა',
    submitting: 'მოწმდება…',
    errorGeneric: 'დაფიქსირდა შეცდომა. სცადეთ თავიდან.',
    doneTitle: 'თქვენი შედეგი',
    scoreLabel: (correct: number, total: number) => `სწორია ${correct} / ${total} კითხვაზე`,
    perQuestionAnswer: 'თქვენი პასუხი',
    freeTextPlaceholder: 'დაწერეთ თქვენი პასუხი აქ…',
    correct: 'სწორია',
    incorrect: 'არასწორია',
  },
  en: {
    loadFailed: 'This quiz link is no longer active.',
    name: 'Full Name',
    namePlaceholder: 'Enter your full name',
    start: 'Start Quiz',
    submit: 'Submit Answers',
    submitting: 'Grading…',
    errorGeneric: 'Something went wrong. Please try again.',
    doneTitle: 'Your Result',
    scoreLabel: (correct: number, total: number) => `${correct} / ${total} correct`,
    perQuestionAnswer: 'Your answer',
    freeTextPlaceholder: 'Write your answer here…',
    correct: 'Correct',
    incorrect: 'Incorrect',
  },
};

export default function StudentQuizPage() {
  const router = useRouter();
  const lang = resolveLocale(router.locale) === 'ka' ? 'ka' : 'en';
  const t = dict[lang];
  const quizId = typeof router.query.quizId === 'string' ? router.query.quizId : null;

  const [phase, setPhase] = useState<Phase>('loading');
  const [quiz, setQuiz] = useState<PublicQuiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const savedAnswers = localStorage.getItem(`quiz-${quizId}-answers`);
    return savedAnswers ? JSON.parse(savedAnswers) : {};
  });
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    const savedStartTime = localStorage.getItem(`quiz-${quizId}-start-time`);
    return savedStartTime ? Math.floor((Date.now() - parseInt(savedStartTime, 10)) / 1000) : 0;
  });

  useEffect(() => {
    if (!quizId) return;
    getPublicQuiz(quizId)
      .then((q) => {
        setQuiz(q);
        setPhase('landing');
      })
      .catch(() => {
        setError(t.loadFailed);
        setPhase('error');
      });
  }, [quizId, t.loadFailed]);

  useEffect(() => {
    if (phase !== 'in-progress') return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => {
        const newElapsed = s + 1;
        localStorage.setItem(`quiz-${quizId}-start-time`, Date.now().toString());
        return newElapsed;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const handleStart = (e: FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;
    setPhase('in-progress');
  };

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (autoSubmit) {
      localStorage.removeItem(`quiz-${quizId}-start-time`);
      localStorage.removeItem(`quiz-${quizId}-answers`);
    }
    if (!quizId) return;
    setPhase('submitting');
    setError(null);
    try {
      const res = await submitPublicQuiz(quizId, studentName, answers);
      setResult(res);
      setPhase('done');
    } catch {
      setError(t.errorGeneric);
      setPhase('error');
    }
  }, [quizId, studentName, answers, t.errorGeneric]);

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return (
    <div className="pb-32 min-h-screen bg-slate-950 text-white flex flex-col">
      <Head>
        <title>{quiz ? `${quiz.title} | CDC Quiz` : 'CDC Quiz'}</title>
      </Head>

      <div className="pb-32 max-w-2xl mx-auto px-4 py-10 flex-1 w-full">
        {error && <div className="pb-32 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300 mb-6">{error}</div>}

        {phase === 'loading' && <p className="pb-32 text-sm text-slate-400">…</p>}

        {phase === 'landing' && quiz && (
          <div className="pb-32 rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
            <h1 className="pb-32 text-xl font-black mb-6">{quiz.title}</h1>
            <form onSubmit={handleStart} className="pb-32 space-y-4">
              <div>
                <label className="pb-32 block text-xs font-bold text-slate-400 mb-1.5">{t.name}</label>
                <input
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  className="pb-32 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <button type="submit" className="pb-32 w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3 text-sm font-black text-white">
                {t.start}
              </button>
            </form>
          </div>
        )}

        {phase === 'in-progress' && quiz && (
          <div>
            <div className="pb-32 sticky top-0 z-10 -mx-4 px-4 py-3 mb-6 bg-slate-950/95 backdrop-blur border-b border-slate-800">
              <QuizTimer
                duration={quiz.duration}
                onExpire={() => handleSubmit(true)}
              />
              <span className="pb-32 text-sm font-black flex items-center gap-1.5">
                <Clock className="pb-32 w-4 h-4 text-cyan-400" />
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
            </div>

            <div className="pb-32 space-y-6">
              {quiz.questions.map((q, i) => (
                <div key={q.id} className="pb-32 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                  <p className="pb-32 text-sm font-bold mb-3">
                    {i + 1}. {q.question}
                  </p>
                  {q.type === 'MULTIPLE_CHOICE' && q.options ? (
                    <div className="pb-32 space-y-2">
                      {Object.entries(q.options).map(([letter, text]) => (
                        <label key={letter} className="pb-32 flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[q.id] === letter}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: letter }))}
                          />
                          <span className="pb-32 font-bold text-slate-500">{letter}.</span> {text}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      rows={4}
                      value={answers[q.id] ?? ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder={t.freeTextPlaceholder}
                      className="pb-32 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleSubmit()}
              className="pb-32 mt-6 w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3 text-sm font-black text-white"
            >
              {t.submit}
            </button>
          </div>
        )}

        {phase === 'submitting' && <p className="pb-32 text-sm text-slate-400">{t.submitting}</p>}

        {phase === 'done' && quiz && result && (
          <div className="pb-32 space-y-4">
            <div className="pb-32 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-8 text-center">
              <h1 className="pb-32 text-lg font-black mb-2">{t.doneTitle}</h1>
              <p className="pb-32 text-3xl font-black text-cyan-400 mb-1">{result.score}%</p>
              <p className="pb-32 text-sm text-slate-400">{t.scoreLabel(result.correctCount, result.total)}</p>
            </div>
            {result.results.map((r, i) => {
              const q = quiz.questions[i];
              if (!q) return null;
              return (
                <div key={r.questionId} className="pb-32 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="pb-32 flex items-start justify-between gap-3 mb-2">
                    <p className="pb-32 text-sm font-bold flex-1">
                      {i + 1}. {q.question}
                    </p>
                    {r.correct ? (
                      <CheckCircle2 className="pb-32 w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="pb-32 w-5 h-5 text-rose-400 shrink-0" />
                    )}
                  </div>
                  <p className="pb-32 text-xs text-slate-400 mb-1">
                    {t.perQuestionAnswer}: <span className="pb-32 text-slate-200">{answers[q.id] || '—'}</span>
                  </p>
                  {r.feedback && <p className="pb-32 text-xs text-slate-400 italic">{r.feedback}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
