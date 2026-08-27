import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { ShieldAlert, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  getCandidateExamInfo,
  startCandidateExam,
  submitCandidateExam,
  logProctoringEvent,
  CandidateExamInfo,
  ExamQuestionRow,
} from '../../src/services/examProctoringService';
import { resolveLocale } from '@/src/utils/locale';

// Same anti-cheat mechanism as pages/freelancer/exam.tsx's registerStrike —
// tab-switch / window-blur / fullscreen-exit strikes, auto-submitting (here,
// flagging rather than failing, since this is a screening tool for the
// business, not a self-credentialing exam) once the limit is hit.
const MAX_STRIKES = 3;

type Phase = 'landing' | 'starting' | 'in-progress' | 'submitting' | 'done' | 'error';

const dict = {
  ka: {
    loadFailed: 'ეს გამოცდის ბმული აღარ არის აქტიური.',
    name: 'სახელი, გვარი',
    email: 'ელ. ფოსტა',
    start: 'გამოცდის დაწყება',
    starting: 'იწყება…',
    duration: (m: number) => `ხანგრძლივობა: ${m} წუთი`,
    submit: 'დასრულება და გაგზავნა',
    submitting: 'იგზავნება…',
    doneTitle: 'გმადლობთ!',
    doneBody: 'თქვენი პასუხები წარმატებით გაიგზავნა. დამსაქმებელი დაგიკავშირდებათ შედეგების შესახებ.',
    warningNote: (n: number) => `⚠️ დარღვევა შეინიშნა (${n}/${MAX_STRIKES}). კიდევ ერთი და გამოცდა ავტომატურად დასრულდება.`,
    proctoringNotice: `ტაბის გადართვა, ფოკუსის დაკარგვა ან სრულეკრანიანი რეჟიმიდან გამოსვლა ითვლება დარღვევად — ${MAX_STRIKES} დარღვევის შემთხვევაში გამოცდა ავტომატურად წყდება.`,
    practicalPlaceholder: 'დაწერეთ თქვენი პასუხი აქ…',
    codePlaceholder: '// დაწერეთ თქვენი კოდი აქ…',
    errorGeneric: 'დაფიქსირდა შეცდომა. სცადეთ თავიდან.',
  },
  en: {
    loadFailed: 'This exam link is no longer active.',
    name: 'Full Name',
    email: 'Email',
    start: 'Start Exam',
    starting: 'Starting…',
    duration: (m: number) => `Duration: ${m} minutes`,
    submit: 'Finish & Submit',
    submitting: 'Submitting…',
    doneTitle: 'Thank you!',
    doneBody: 'Your answers were submitted successfully. The employer will be in touch about next steps.',
    warningNote: (n: number) => `⚠️ Violation detected (${n}/${MAX_STRIKES}). One more and the exam will auto-submit.`,
    proctoringNotice: `Tab switching, losing window focus, or exiting fullscreen counts as a violation — ${MAX_STRIKES} violations auto-submit and end the exam.`,
    practicalPlaceholder: 'Write your answer here…',
    codePlaceholder: '// Write your code here…',
    errorGeneric: 'Something went wrong. Please try again.',
  },
  de: {
    loadFailed: 'This exam link is no longer active.',
    name: 'Full Name',
    email: 'Email',
    start: 'Start Exam',
    starting: 'Starting…',
    duration: (m: number) => `Duration: ${m} minutes`,
    submit: 'Finish & Submit',
    submitting: 'Submitting…',
    doneTitle: 'Thank you!',
    doneBody: 'Your answers were submitted successfully. The employer will be in touch about next steps.',
    warningNote: (n: number) => `⚠️ Violation detected (${n}/${MAX_STRIKES}). One more and the exam will auto-submit.`,
    proctoringNotice: `Tab switching, losing window focus, or exiting fullscreen counts as a violation — ${MAX_STRIKES} violations auto-submit and end the exam.`,
    practicalPlaceholder: 'Write your answer here…',
    codePlaceholder: '// Write your code here…',
    errorGeneric: 'Something went wrong. Please try again.',
  },
  es: {
    loadFailed: 'This exam link is no longer active.',
    name: 'Full Name',
    email: 'Email',
    start: 'Start Exam',
    starting: 'Starting…',
    duration: (m: number) => `Duration: ${m} minutes`,
    submit: 'Finish & Submit',
    submitting: 'Submitting…',
    doneTitle: 'Thank you!',
    doneBody: 'Your answers were submitted successfully. The employer will be in touch about next steps.',
    warningNote: (n: number) => `⚠️ Violation detected (${n}/${MAX_STRIKES}). One more and the exam will auto-submit.`,
    proctoringNotice: `Tab switching, losing window focus, or exiting fullscreen counts as a violation — ${MAX_STRIKES} violations auto-submit and end the exam.`,
    practicalPlaceholder: 'Write your answer here…',
    codePlaceholder: '// Write your code here…',
    errorGeneric: 'Something went wrong. Please try again.',
  },
  fr: {
    loadFailed: 'This exam link is no longer active.',
    name: 'Full Name',
    email: 'Email',
    start: 'Start Exam',
    starting: 'Starting…',
    duration: (m: number) => `Duration: ${m} minutes`,
    submit: 'Finish & Submit',
    submitting: 'Submitting…',
    doneTitle: 'Thank you!',
    doneBody: 'Your answers were submitted successfully. The employer will be in touch about next steps.',
    warningNote: (n: number) => `⚠️ Violation detected (${n}/${MAX_STRIKES}). One more and the exam will auto-submit.`,
    proctoringNotice: `Tab switching, losing window focus, or exiting fullscreen counts as a violation — ${MAX_STRIKES} violations auto-submit and end the exam.`,
    practicalPlaceholder: 'Write your answer here…',
    codePlaceholder: '// Write your code here…',
    errorGeneric: 'Something went wrong. Please try again.',
  },
  uk: {
    loadFailed: 'This exam link is no longer active.',
    name: 'Full Name',
    email: 'Email',
    start: 'Start Exam',
    starting: 'Starting…',
    duration: (m: number) => `Duration: ${m} minutes`,
    submit: 'Finish & Submit',
    submitting: 'Submitting…',
    doneTitle: 'Thank you!',
    doneBody: 'Your answers were submitted successfully. The employer will be in touch about next steps.',
    warningNote: (n: number) => `⚠️ Violation detected (${n}/${MAX_STRIKES}). One more and the exam will auto-submit.`,
    proctoringNotice: `Tab switching, losing window focus, or exiting fullscreen counts as a violation — ${MAX_STRIKES} violations auto-submit and end the exam.`,
    practicalPlaceholder: 'Write your answer here…',
    codePlaceholder: '// Write your code here…',
    errorGeneric: 'Something went wrong. Please try again.',
  },
};

export default function CandidateExamPage() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const token = typeof router.query.token === 'string' ? router.query.token : null;

  const [phase, setPhase] = useState<Phase>('landing');
  const [info, setInfo] = useState<CandidateExamInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');

  const [submissionToken, setSubmissionToken] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestionRow[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [copyPasteCount, setCopyPasteCount] = useState(0);
  const [warningToast, setWarningToast] = useState<string | null>(null);

  const phaseRef = useRef<Phase>('landing');
  const strikeGuardRef = useRef(false);
  const answersRef = useRef<Record<string, string>>({});
  const tabSwitchRef = useRef(0);
  const copyPasteRef = useRef(0);
  const submissionTokenRef = useRef<string | null>(null);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (!token) return;
    getCandidateExamInfo(token)
      .then(setInfo)
      .catch(() => setError(t.loadFailed));
  }, [token, t.loadFailed]);

  const handleSubmit = useCallback(async () => {
    if (!submissionTokenRef.current || phaseRef.current === 'submitting' || phaseRef.current === 'done') return;
    setPhase('submitting');
    try {
      // Only answers travel here now — tab-switch/paste counts are recorded
      // server-side in real time by logProctoringEvent below (see
      // registerStrike) and the server recomputes the integrity score from
      // those at submit time, rather than trusting anything this call sends.
      await submitCandidateExam(submissionTokenRef.current, { answers: answersRef.current });
      setPhase('done');
    } catch {
      setError(t.errorGeneric);
      setPhase('error');
    }
  }, [t.errorGeneric]);

  const registerStrike = useCallback(
    (kind: 'tab' | 'copyPaste') => {
      if (phaseRef.current !== 'in-progress' || strikeGuardRef.current) return;
      strikeGuardRef.current = true;
      setTimeout(() => {
        strikeGuardRef.current = false;
      }, 800);

      if (submissionTokenRef.current) {
        // Fire-and-forget — this is the server-authoritative record of the
        // violation; the local strikes/toast state below is only for the
        // candidate's own on-screen warning and the client-side auto-submit
        // at MAX_STRIKES.
        logProctoringEvent(submissionTokenRef.current, kind === 'tab' ? 'TAB_SWITCH' : 'COPY_PASTE').catch(() => {});
      }

      if (kind === 'tab') {
        tabSwitchRef.current += 1;
        setTabSwitchCount(tabSwitchRef.current);
      } else {
        copyPasteRef.current += 1;
        setCopyPasteCount(copyPasteRef.current);
      }

      setStrikes((prev) => {
        const next = prev + 1;
        if (next >= MAX_STRIKES) {
          handleSubmit();
        } else {
          setWarningToast(t.warningNote(next));
        }
        return next;
      });
    },
    [handleSubmit, t]
  );

  useEffect(() => {
    if (phase !== 'in-progress') return;

    const onVisibilityChange = () => {
      if (document.hidden) registerStrike('tab');
    };
    const onBlur = () => registerStrike('tab');
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) registerStrike('tab');
    };
    // Paste is both blocked (preventDefault) AND counted as a proctoring
    // violation — detection alone (per the spec) wouldn't stop a candidate
    // from pasting an AI-generated answer, and blocking alone would give no
    // integrityScore signal to the business.
    const onPaste = (e: Event) => {
      e.preventDefault();
      registerStrike('copyPaste');
    };
    const blockEvent = (e: Event) => e.preventDefault();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('contextmenu', blockEvent);
    document.addEventListener('copy', blockEvent);
    document.addEventListener('paste', onPaste);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('contextmenu', blockEvent);
      document.removeEventListener('copy', blockEvent);
      document.removeEventListener('paste', onPaste);
    };
  }, [phase, registerStrike]);

  useEffect(() => {
    if (!warningToast) return;
    const timeout = setTimeout(() => setWarningToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [warningToast]);

  useEffect(() => {
    if (phase !== 'in-progress' || secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, secondsLeft, handleSubmit]);

  const handleStart = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setPhase('starting');
    setError(null);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Some browsers/contexts block fullscreen — the exam still proceeds,
      // the listeners above just won't catch a fullscreen-exit that never
      // entered fullscreen to begin with.
    }
    try {
      const result = await startCandidateExam(token, { candidateName, candidateEmail });
      setSubmissionToken(result.submissionToken);
      submissionTokenRef.current = result.submissionToken;
      setQuestions(result.questions);
      setSecondsLeft(result.durationMinutes * 60);
      setPhase('in-progress');
    } catch {
      setError(t.errorGeneric);
      setPhase('error');
    }
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <Head>
        <title>{info ? `${info.title} | CDC Exam` : 'CDC Exam'}</title>
      </Head>

      {warningToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-bold text-sm px-5 py-3 rounded-xl shadow-lg">
          {warningToast}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-10 flex-1 w-full">
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300 mb-6">{error}</div>
        )}

        {phase === 'landing' && info && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
            <h1 className="blog-heading-safe text-xl font-black mb-1">{info.title}</h1>
            {info.description && <p className="text-sm text-slate-400 mb-3">{info.description}</p>}
            <p className="text-xs text-cyan-400 font-bold flex items-center gap-1.5 mb-6">
              <Clock className="w-3.5 h-3.5" />
              {t.duration(info.durationMinutes)}
            </p>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3 mb-6">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300">{t.proctoringNotice}</p>
            </div>
            <form onSubmit={handleStart} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">{t.name}</label>
                <input
                  required
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">{t.email}</label>
                <input
                  required
                  type="email"
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3 text-sm font-black text-white"
              >
                {t.start}
              </button>
            </form>
          </div>
        )}

        {phase === 'starting' && <p className="text-sm text-slate-400">{t.starting}</p>}

        {phase === 'in-progress' && (
          <div>
            <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-6 bg-slate-950/95 backdrop-blur border-b border-slate-800 flex items-center justify-between">
              <span className="text-sm font-black flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-400" />
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
              {strikes > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                  <ShieldAlert className="w-3.5 h-3.5" /> {strikes}/{MAX_STRIKES}
                </span>
              )}
            </div>

            <div className="space-y-6">
              {questions.map((q, i) => (
                <div key={q.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                  <p className="text-sm font-bold mb-3">
                    {i + 1}. {q.question}
                  </p>
                  {q.type === 'MCQ' && q.options ? (
                    <div className="space-y-2">
                      {(['A', 'B', 'C', 'D'] as const).map((letter) => (
                        <label key={letter} className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[q.id] === letter}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: letter }))}
                          />
                          <span className="font-bold text-slate-500">{letter}.</span> {q.options![letter]}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      rows={q.type === 'CODE' ? 8 : 4}
                      value={answers[q.id] ?? ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder={q.type === 'CODE' ? t.codePlaceholder : t.practicalPlaceholder}
                      spellCheck={q.type !== 'CODE'}
                      className={`w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        q.type === 'CODE' ? 'font-mono' : ''
                      }`}
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

        {phase === 'done' && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-lg font-black mb-2">{t.doneTitle}</h1>
            <p className="text-sm text-slate-400">{t.doneBody}</p>
          </div>
        )}
      </div>
    </div>
  );
}
