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

// Fix D6: draft storage used to be keyed by quizId ALONE — any two visitors
// to the same quiz link on the same browser shared one draft, so a second
// student opening the link after a first student left one unsubmitted
// would silently inherit their in-progress answers. Keys are now scoped by
// quizId + the student's own typed name (normalized), computed once the
// name is submitted on the landing screen (see handleStart) — never read
// or written before that point, so nothing before a name exists can leak
// into whatever gets read after one does.
//
// This is deliberately NOT a real identity/security boundary (there is no
// login, no server-issued attempt token here, and nothing stops two
// different students from typing the exact same name on the same device —
// see the file-level note in Fix Batch 2's report on why a heavier
// mechanism wasn't introduced). It is a local draft-isolation convenience:
// distinct names get distinct drafts, which is the realistic common case.
const normalizeStudentKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

const getQuizStorageKeys = (quizId: string, studentKey: string) => ({
  answers: `quiz-${quizId}-${studentKey}-answers`,
  startTime: `quiz-${quizId}-${studentKey}-start-time`,
  elapsedSeconds: `quiz-${quizId}-${studentKey}-elapsed-seconds`,
});

// Pre-fix key shape (quizId only, no student component) — never read under
// the new scheme (that's the whole point of the fix), only removed
// best-effort so a stale entry doesn't linger in localStorage forever or
// get discovered by some future unrelated code path.
const getLegacyQuizStorageKeys = (quizId: string) => ({
  answers: `quiz-${quizId}-answers`,
  startTime: `quiz-${quizId}-start-time`,
  elapsedSeconds: `quiz-${quizId}-elapsed-seconds`,
});

const sanitizeStoredAnswers = (storageKey: string, validQuestionIds: Set<string>) => {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      localStorage.removeItem(storageKey);
      return {};
    }

    const filtered = Object.entries(parsed).reduce<Record<string, string>>((acc, [questionId, value]) => {
      if (validQuestionIds.has(questionId) && typeof value === 'string') {
        acc[questionId] = value;
      }
      return acc;
    }, {});

    if (Object.keys(filtered).length === 0) {
      localStorage.removeItem(storageKey);
      return {};
    }

    const normalized = JSON.stringify(filtered);
    if (normalized !== raw) {
      localStorage.setItem(storageKey, normalized);
    }
    return filtered;
  } catch {
    localStorage.removeItem(storageKey);
    return {};
  }
};

export default function StudentQuizPage() {
  const router = useRouter();
  const lang = resolveLocale(router.locale) === 'ka' ? 'ka' : 'en';
  const t = dict[lang];
  const quizId = typeof router.query.quizId === 'string' && router.query.quizId.trim() ? router.query.quizId : null;

  const [phase, setPhase] = useState<Phase>('loading');
  const [quiz, setQuiz] = useState<PublicQuiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  // Set once (in handleStart) from the name the student actually typed on
  // the landing screen — see the storage-key comment above for why this,
  // not quizId alone, scopes every draft read/write from that point on.
  const [studentKey, setStudentKey] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    setError(null);
    setResult(null);
    setStudentName('');
    setStudentKey(null);
    setAnswers({});
    setElapsedSeconds(0);
    setPhase('loading');

    if (!router.isReady || !quizId) return;

    getPublicQuiz(quizId)
      .then((q) => {
        setQuiz(q);
        setPhase('landing');
      })
      .catch(() => {
        setQuiz(null);
        setError(t.loadFailed);
        setPhase('error');
      });
  }, [router.isReady, quizId, t.loadFailed]);

  // Fix D6: draft restoration intentionally does NOT happen here anymore —
  // this effect used to fire as soon as the quiz loaded, for whatever
  // visitor happened to be looking at the page, before any name was even
  // typed. It now happens inside handleStart below, once we actually know
  // which student is asking (see that function for the restoration logic
  // itself, keyed by quizId + their name).

  useEffect(() => {
    if (phase !== 'in-progress' || !quizId || !studentKey) return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => {
        const newElapsed = s + 1;
        const storageKeys = getQuizStorageKeys(quizId, studentKey);
        localStorage.setItem(storageKeys.startTime, Date.now().toString());
        localStorage.setItem(storageKeys.elapsedSeconds, newElapsed.toString());
        return newElapsed;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, quizId, studentKey]);

  const handleStart = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = studentName.trim();
    if (!trimmedName || !quiz || !quizId) return;

    const key = normalizeStudentKey(trimmedName);
    setStudentKey(key);

    // Best-effort cleanup of the pre-fix, unscoped key shape — never read
    // (see getLegacyQuizStorageKeys' own comment), only removed so it can't
    // linger indefinitely or be picked up by some future code path.
    const legacyKeys = getLegacyQuizStorageKeys(quizId);
    localStorage.removeItem(legacyKeys.answers);
    localStorage.removeItem(legacyKeys.startTime);
    localStorage.removeItem(legacyKeys.elapsedSeconds);

    // Restore THIS student's own draft, if any — sanitizeStoredAnswers
    // already drops anything malformed or referencing a question ID that
    // no longer exists on this quiz.
    const validQuestionIds = new Set(quiz.questions.map((q) => q.id));
    const storageKeys = getQuizStorageKeys(quizId, key);
    setAnswers(sanitizeStoredAnswers(storageKeys.answers, validQuestionIds));

    const savedStartTime = localStorage.getItem(storageKeys.startTime);
    const savedElapsed = localStorage.getItem(storageKeys.elapsedSeconds);
    if (savedStartTime && savedElapsed) {
      const parsedStart = Number.parseInt(savedStartTime, 10);
      const parsedElapsed = Number.parseInt(savedElapsed, 10);
      if (Number.isFinite(parsedStart) && Number.isFinite(parsedElapsed)) {
        setElapsedSeconds(Math.max(0, parsedElapsed + Math.floor((Date.now() - parsedStart) / 1000)));
      } else {
        localStorage.removeItem(storageKeys.startTime);
        localStorage.removeItem(storageKeys.elapsedSeconds);
        setElapsedSeconds(0);
      }
    } else {
      setElapsedSeconds(0);
    }

    setPhase('in-progress');
  };

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (autoSubmit && quizId && studentKey) {
      const storageKeys = getQuizStorageKeys(quizId, studentKey);
      localStorage.removeItem(storageKeys.startTime);
      localStorage.removeItem(storageKeys.answers);
      localStorage.removeItem(storageKeys.elapsedSeconds);
    }
    if (!quizId) return;

    // Check for unanswered questions
    const unansweredQuestions = quiz?.questions.filter((q) => !answers[q.id]);
    if (unansweredQuestions && unansweredQuestions.length > 0) {
      setError(t.errorGeneric);
      // Highlight unanswered questions
      unansweredQuestions.forEach((q) => {
        const questionElement = document.getElementById(`question-${q.id}`);
        if (questionElement) {
          questionElement.classList.add('border-red-500', 'bg-red-100');
          const warning = document.createElement('div');
          warning.className = 'text-red-500 text-sm mb-2';
          warning.textContent = '⚠️ გთხოვთ აუცილებლად აირჩიოთ პასუხი!';
          questionElement.prepend(warning);
        }
      });
      // Scroll to the first unanswered question
      const firstUnanswered = document.getElementById(`question-${unansweredQuestions[0].id}`);
      if (firstUnanswered) {
        firstUnanswered.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setPhase('submitting');
    setError(null);
    try {
      const res = await submitPublicQuiz(quizId, studentName, answers);
      if (studentKey) {
        const storageKeys = getQuizStorageKeys(quizId, studentKey);
        localStorage.removeItem(storageKeys.startTime);
        localStorage.removeItem(storageKeys.answers);
        localStorage.removeItem(storageKeys.elapsedSeconds);
      }
      setResult(res);
      setPhase('done');
    } catch {
      setError(t.errorGeneric);
      setPhase('error');
    }
  }, [quizId, studentKey, studentName, answers, t.errorGeneric, quiz]);

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <Head>
        <title>{quiz ? `${quiz.title} | CDC Quiz` : 'CDC Quiz'}</title>
      </Head>

      <div className="max-w-2xl mx-auto px-4 py-10 flex-1 w-full">
        {error && <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300 mb-6">{error}</div>}

        {phase === 'loading' && <p className="text-sm text-slate-400">…</p>}

        {phase === 'landing' && quiz && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
            <h1 className="text-xl font-black mb-6">{quiz.title}</h1>
            <form onSubmit={handleStart} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">{t.name}</label>
                <input
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <button type="submit" className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3 text-sm font-black text-white">
                {t.start}
              </button>
            </form>
          </div>
        )}

        {phase === 'in-progress' && quiz && (
          <div>
            <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-6 bg-slate-950/95 backdrop-blur border-b border-slate-800">
              <span className="text-sm font-black flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-400" />
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
            </div>

            <div className="space-y-6 overflow-x-auto max-w-full">
              {quiz.questions.map((q, i) => (
                <div
                  key={q.id}
                  id={`question-${q.id}`}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
                >
                  <p className="text-sm font-bold mb-3">
                    {i + 1}. {q.question}
                  </p>
                  {q.type === 'MULTIPLE_CHOICE' && q.options ? (
                    <div className="space-y-2">
                      {Object.entries(q.options).map(([letter, text]) => (
                        <label key={letter} className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[q.id] === letter}
                            onChange={() =>
                              setAnswers((prev) => {
                                const updatedAnswers = { ...prev, [q.id]: letter };
                                if (quizId && studentKey) {
                                  localStorage.setItem(getQuizStorageKeys(quizId, studentKey).answers, JSON.stringify(updatedAnswers));
                                }
                                return updatedAnswers;
                              })
                            }
                          />
                          <span className="font-bold text-slate-500">{letter}.</span> {text}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      rows={4}
                      value={answers[q.id] ?? ''}
                      onChange={(e) =>
                        setAnswers((prev) => {
                          const updatedAnswers = { ...prev, [q.id]: e.target.value };
                          if (quizId && studentKey) {
                            localStorage.setItem(getQuizStorageKeys(quizId, studentKey).answers, JSON.stringify(updatedAnswers));
                          }
                          return updatedAnswers;
                        })
                      }
                      placeholder={t.freeTextPlaceholder}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleSubmit()}
              className="mt-6 w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3 text-sm font-black text-white"
            >
              {t.submit}
            </button>
          </div>
        )}

        {phase === 'submitting' && <p className="text-sm text-slate-400">{t.submitting}</p>}

        {phase === 'done' && quiz && result && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-8 text-center">
              <h1 className="text-lg font-black mb-2">{t.doneTitle}</h1>
              <p className="text-3xl font-black text-cyan-400 mb-1">{result.score}%</p>
              <p className="text-sm text-slate-400">{t.scoreLabel(result.correctCount, result.total)}</p>
            </div>
            {result.results.map((r, i) => {
              const q = quiz.questions[i];
              if (!q) return null;
              return (
                <div key={r.questionId} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm font-bold flex-1">
                      {i + 1}. {q.question}
                    </p>
                    {r.correct ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-1">
                    {t.perQuestionAnswer}: <span className="text-slate-200">{answers[q.id] || '—'}</span>
                  </p>
                  {r.feedback && <p className="text-xs text-slate-400 italic">{r.feedback}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
