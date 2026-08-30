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

// Parenthetical level descriptions — same ka/en content-locale boundary as
// every other string in this component (see utils/locale.ts's
// contentLocale: Georgian only for the ka site locale, English for every
// other of the 9 site locales, never a per-string next-i18next namespace
// here). Shown on the new 'level' step below.
const LEVEL_DESCRIPTIONS: Record<CefrLevel, { ka: string; en: string }> = {
  A1: { ka: 'დამწყები — მარტივი სიტყვები და ყოველდღიური ფრაზები', en: 'Beginner — simple words and everyday phrases' },
  A2: { ka: 'ელემენტარული — მარტივი დიალოგი და საბაზისო ტექსტები', en: 'Elementary — simple dialogue and basic texts' },
  B1: { ka: 'საშუალო — თავისუფალი საუბარი ნაცნობ თემებზე', en: 'Intermediate — comfortable conversation on familiar topics' },
  B2: { ka: 'საშუალოზე მაღალი — კომპლექსური დისკუსიები და პროფესიული თემები', en: 'Upper-Intermediate — complex discussions and professional topics' },
  C1: { ka: 'მაღალი / პროფესიონალური — თავისუფალი ენობრივი ფლობა', en: 'Advanced — fluent, professional command of the language' },
  C2: { ka: 'ექსპერტი / მშობლიური ენის დონე — სრული ოსტატობა', en: 'Expert — near-native fluency, full mastery' },
};
const ALL_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const dict = {
  ka: {
    welcome: 'გამარჯობა! მე ვარ IMIAKO 👋',
    welcomeSubtitle: 'თქვენი პირადი AI ინგლისურის რეპეტიტორი. დავიწყოთ სამი მოკლე ნაბიჯით.',
    step1Title: 'რომელია თქვენი მშობლიური ენა?',
    step2Title: 'რა არის თქვენი მიზანი?',
    step3Title: 'აირჩიეთ თქვენი დონე',
    step3Subtitle: 'თუ იცით თქვენი დონე CEFR სკალით, აირჩიეთ პირდაპირ — ან ჩააბარეთ მოკლე ტესტი, თუ არ ხართ დარწმუნებული.',
    testStepTitle: 'სწრაფი დიაგნოსტიკური ტესტი',
    testStepSubtitle: 'პასუხი გაეცით რამდენიმე კითხვას, რომ IMIAKO-მ განსაზღვროს თქვენი დონე (A1-C1).',
    next: 'შემდეგი',
    startTest: 'არ ვიცი — მოკლე ტესტის ჩაბარება',
    loadingTest: 'იტვირთება…',
    finish: 'დასრულება',
    submitting: 'მოწმდება…',
    backToLevels: '← უკან დონის არჩევანთან',
    resultTitle: 'თქვენი დონეა',
    resultBody: 'IMIAKO ახლა მოამზადებს გაკვეთილებს ზუსტად თქვენი დონისთვის.',
    startLearning: 'სწავლის დაწყება →',
  },
  en: {
    welcome: "Hi! I'm IMIAKO 👋",
    welcomeSubtitle: 'Your personal AI English Tutor. Let\'s get started in three quick steps.',
    step1Title: 'What is your native language?',
    step2Title: 'What is your goal?',
    step3Title: 'Choose your level',
    step3Subtitle: "If you already know your CEFR level, pick it directly — or take a short test if you're not sure.",
    testStepTitle: 'Quick diagnostic test',
    testStepSubtitle: 'Answer a few questions so IMIAKO can figure out your level (A1-C1).',
    next: 'Next',
    startTest: "I'm not sure — take a short test",
    loadingTest: 'Loading…',
    finish: 'Finish',
    submitting: 'Checking…',
    backToLevels: '← Back to level selection',
    resultTitle: 'Your level is',
    resultBody: 'IMIAKO will now prepare lessons exactly for your level.',
    startLearning: 'Start Learning →',
  },
};

type Step = 'lang' | 'goal' | 'level' | 'test' | 'result';

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
            disabled={!goal}
            onClick={() => setStep('level')}
            className="self-end inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 text-white font-bold px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {t.next} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 'level' && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-sm font-bold">{t.step3Title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.step3Subtitle}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ALL_LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => finishWithLevel(lvl)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 text-left hover:border-purple-400 dark:hover:border-purple-500 transition-colors"
              >
                <span className="shrink-0 w-11 h-11 rounded-lg bg-gradient-to-tr from-amber-400 via-purple-500 to-cyan-500 flex items-center justify-center text-white font-black text-sm">
                  {lvl}
                </span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-snug">
                  {lang === 'ka' ? LEVEL_DESCRIPTIONS[lvl].ka : LEVEL_DESCRIPTIONS[lvl].en}
                </span>
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="button"
            disabled={loadingTest}
            onClick={handleStartTest}
            className="self-center inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 bg-transparent border-none cursor-pointer hover:underline disabled:opacity-50"
          >
            {loadingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {loadingTest ? t.loadingTest : t.startTest}
          </button>
        </div>
      )}

      {step === 'test' && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-sm font-bold">{t.testStepTitle}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.testStepSubtitle}</p>
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
            <button type="button" onClick={() => setStep('level')} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              {t.backToLevels}
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
