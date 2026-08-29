import { useState } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';
import {
  TutorLearningGoal,
  CefrLevel,
  PlacementQuestionClient,
  PlacementQuestionFull,
  getPlacementTest,
  submitPlacementTest,
  setTutorLearningGoal,
} from '../../services/englishTutorService';

interface TutorOnboardingFlowProps {
  lang: 'ka' | 'en';
  // Called once onboarding fully completes — hands back the student's
  // chosen native language, goal, and placement-test-derived starting
  // level so the parent can seed the lesson-generation form with them.
  onComplete: (result: { nativeLang: string; learningGoal: TutorLearningGoal; level: CefrLevel }) => void;
}

const NATIVE_LANG_OPTIONS = [
  { code: 'ka', label: 'ქართული (Georgian)' },
  { code: 'de', label: 'Deutsch (German)' },
  { code: 'es', label: 'Español (Spanish)' },
  { code: 'fr', label: 'Français (French)' },
  { code: 'uk', label: 'Українська (Ukrainian)' },
  { code: 'tr', label: 'Türkçe (Turkish)' },
  { code: 'hy', label: 'Հայերեն (Armenian)' },
  { code: 'az', label: 'Azərbaycan (Azerbaijani)' },
  { code: 'ru', label: 'Русский (Russian)' },
];

const GOAL_OPTIONS: { value: TutorLearningGoal; ka: string; en: string }[] = [
  { value: 'TRAVEL', ka: '✈️ მოგზაურობა', en: '✈️ Travel' },
  { value: 'TECHNICAL_IT', ka: '💻 IT / ტექნიკური', en: '💻 IT / Technical' },
  { value: 'BUSINESS', ka: '💼 ბიზნესი', en: '💼 Business' },
  { value: 'ACADEMIC', ka: '🎓 აკადემიური', en: '🎓 Academic' },
  { value: 'GENERAL_DAILY', ka: '🗣️ ყოველდღიური', en: '🗣️ General Daily' },
  { value: 'INTERVIEW_PREP', ka: '🤝 გასაუბრებისთვის მომზადება', en: '🤝 Interview Prep' },
];

const dict = {
  ka: {
    welcome: 'გამარჯობა! მე ვარ IMIAKO 👋',
    welcomeSubtitle: 'თქვენი პირადი AI ინგლისურის რეპეტიტორი. დავიწყოთ სამი მოკლე ნაბიჯით.',
    step1Title: 'რომელია თქვენი მშობლიური ენა?',
    step2Title: 'რა არის თქვენი მიზანი?',
    step3Title: 'სწრაფი დიაგნოსტიკური ტესტი',
    step3Subtitle: 'პასუხი გაეცით რამდენიმე კითხვას, რომ IMIAKO-მ განსაზღვროს თქვენი დონე (A1-C1).',
    next: 'შემდეგი',
    startTest: 'ტესტის დაწყება',
    loadingTest: 'იტვირთება…',
    finish: 'დასრულება',
    submitting: 'მოწმდება…',
    skip: 'ან გამოტოვე — დავიწყოთ A1-დან',
    resultTitle: 'თქვენი დონეა',
    resultBody: 'IMIAKO ახლა მოამზადებს გაკვეთილებს ზუსტად თქვენი დონისთვის.',
    startLearning: 'სწავლის დაწყება →',
  },
  en: {
    welcome: "Hi! I'm IMIAKO 👋",
    welcomeSubtitle: 'Your personal AI English Tutor. Let\'s get started in three quick steps.',
    step1Title: 'What is your native language?',
    step2Title: 'What is your goal?',
    step3Title: 'Quick diagnostic test',
    step3Subtitle: 'Answer a few questions so IMIAKO can figure out your level (A1-C1).',
    next: 'Next',
    startTest: 'Start Test',
    loadingTest: 'Loading…',
    finish: 'Finish',
    submitting: 'Checking…',
    skip: 'Or skip — start from A1',
    resultTitle: 'Your level is',
    resultBody: 'IMIAKO will now prepare lessons exactly for your level.',
    startLearning: 'Start Learning →',
  },
};

type Step = 'lang' | 'goal' | 'test' | 'result';

export default function TutorOnboardingFlow({ lang, onComplete }: TutorOnboardingFlowProps) {
  const t = dict[lang];
  const [step, setStep] = useState<Step>('lang');
  const [nativeLang, setNativeLang] = useState('');
  const [goal, setGoal] = useState<TutorLearningGoal | null>(null);
  const [questions, setQuestions] = useState<PlacementQuestionClient[]>([]);
  const [rawQuestions, setRawQuestions] = useState<PlacementQuestionFull[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingTest, setLoadingTest] = useState(false);
  const [submittingTest, setSubmittingTest] = useState(false);
  const [resultLevel, setResultLevel] = useState<CefrLevel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const finishWithLevel = async (level: CefrLevel) => {
    if (goal) {
      try {
        await setTutorLearningGoal(goal);
      } catch {
        // Non-fatal — the goal can still be set later from the dashboard.
      }
    }
    setResultLevel(level);
    setStep('result');
  };

  const handleStartTest = async () => {
    setError(null);
    setLoadingTest(true);
    try {
      const { questions: q, raw } = await getPlacementTest(nativeLang);
      setQuestions(q);
      setRawQuestions(raw);
      setStep('test');
    } catch {
      setError(lang === 'ka' ? 'ტესტის ჩატვირთვა ვერ მოხერხდა.' : 'Failed to load the test.');
    } finally {
      setLoadingTest(false);
    }
  };

  const handleSubmitTest = async () => {
    setSubmittingTest(true);
    setError(null);
    try {
      const level = await submitPlacementTest(rawQuestions, answers);
      await finishWithLevel(level);
    } catch {
      setError(lang === 'ka' ? 'ტესტის შემოწმება ვერ მოხერხდა.' : 'Failed to check the test.');
    } finally {
      setSubmittingTest(false);
    }
  };

  const handleSkipTest = () => finishWithLevel('A1');

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
      {step === 'lang' && (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-xl font-black">{t.welcome}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.welcomeSubtitle}</p>
          </div>
          <p className="text-sm font-bold">{t.step1Title}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {NATIVE_LANG_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => setNativeLang(opt.code)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold text-left ${
                  nativeLang === opt.code
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!nativeLang}
            onClick={() => setStep('goal')}
            className="self-end inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 text-white font-bold px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {t.next} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 'goal' && (
        <div className="flex flex-col gap-5">
          <p className="text-sm font-bold">{t.step2Title}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {GOAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGoal(opt.value)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold text-left ${
                  goal === opt.value
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {lang === 'ka' ? opt.ka : opt.en}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="button"
            disabled={!goal || loadingTest}
            onClick={handleStartTest}
            className="self-end inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 text-white font-bold px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {loadingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loadingTest ? t.loadingTest : t.startTest}
          </button>
        </div>
      )}

      {step === 'test' && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-sm font-bold">{t.step3Title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.step3Subtitle}</p>
          </div>
          <div className="flex flex-col gap-4 max-h-[420px] overflow-y-auto pr-1">
            {questions.map((q, i) => (
              <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <p className="text-sm font-semibold mb-2">
                  {i + 1}. {q.question}
                </p>
                <div className="flex flex-col gap-1.5">
                  {(Object.keys(q.options) as Array<'A' | 'B' | 'C' | 'D'>).map((key) => (
                    <label
                      key={key}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${
                        answers[String(i)] === key ? 'border-purple-400 bg-purple-50 dark:bg-purple-500/10' : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`placement-${i}`}
                        checked={answers[String(i)] === key}
                        onChange={() => setAnswers((prev) => ({ ...prev, [String(i)]: key }))}
                      />
                      <span>
                        <strong>{key}.</strong> {q.options[key]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex items-center justify-between">
            <button type="button" onClick={handleSkipTest} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              {t.skip}
            </button>
            <button
              type="button"
              onClick={handleSubmitTest}
              disabled={submittingTest || Object.keys(answers).length < questions.length}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 text-white font-bold px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {submittingTest ? t.submitting : t.finish}
            </button>
          </div>
        </div>
      )}

      {step === 'result' && resultLevel && (
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.resultTitle}</p>
          <p className="text-4xl font-black bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 bg-clip-text text-transparent">{resultLevel}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{t.resultBody}</p>
          <button
            type="button"
            onClick={() => goal && onComplete({ nativeLang, learningGoal: goal, level: resultLevel })}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 text-white font-bold px-6 py-3 text-sm"
          >
            {t.startLearning}
          </button>
        </div>
      )}
    </div>
  );
}
