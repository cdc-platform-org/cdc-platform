import { useState, useEffect, useCallback } from 'react';
import { BookOpen, PenLine, SpellCheck, Layers, ListChecks, Headphones, MessagesSquare, Lock, Loader2, Send, Sparkles, Flag, Crown, Clock } from 'lucide-react';
import VIPAudioNarrator from '../ui/VIPAudioNarrator';
import TutorOnboardingFlow from './TutorOnboardingFlow';
import TutorPaywallModal from './TutorPaywallModal';
import VocabWaitingGame from './VocabWaitingGame';
import {
  TutorTaskType,
  CefrLevel,
  TutorLearningGoal,
  TutorLesson,
  TutorLessonListItem,
  TutorState,
  TutorResumeState,
  TutorGradingResult,
  ReadingContent,
  ListeningContent,
  VocabularyContent,
  GrammarContent,
  QuizContent,
  WritingContent,
  DialogueContent,
  getTutorState,
  getTutorLessons,
  getTutorLesson,
  getTutorResumeState,
  saveTutorResumeState,
  setTutorLearningGoal,
  cancelTutorSubscription,
  flagTutorContent,
  generateTutorLesson,
  submitTutorLesson,
  sendDialogueMessage,
} from '../../services/englishTutorService';

interface EnglishTutorPanelProps {
  lang: 'ka' | 'en';
}

const GOAL_OPTIONS: { value: TutorLearningGoal; ka: string; en: string }[] = [
  { value: 'TRAVEL', ka: '✈️ მოგზაურობა', en: '✈️ Travel' },
  { value: 'TECHNICAL_IT', ka: '💻 IT / ტექნიკური', en: '💻 IT / Technical' },
  { value: 'BUSINESS', ka: '💼 ბიზნესი', en: '💼 Business' },
  { value: 'ACADEMIC', ka: '🎓 აკადემიური', en: '🎓 Academic' },
  { value: 'GENERAL_DAILY', ka: '🗣️ ყოველდღიური', en: '🗣️ General Daily' },
  { value: 'INTERVIEW_PREP', ka: '🤝 გასაუბრებისთვის', en: '🤝 Interview Prep' },
];

const TASK_TYPES: { value: TutorTaskType; icon: typeof BookOpen }[] = [
  { value: 'READING', icon: BookOpen },
  { value: 'WRITING', icon: PenLine },
  { value: 'GRAMMAR', icon: SpellCheck },
  { value: 'VOCABULARY', icon: Layers },
  { value: 'QUIZ', icon: ListChecks },
  { value: 'LISTENING', icon: Headphones },
  { value: 'DIALOGUE', icon: MessagesSquare },
];
const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const PRO_LEVELS: CefrLevel[] = ['B2', 'C1', 'C2'];
// A short suggestion list — the actual field is free text (see
// TutorLesson.nativeLang's own comment), this just saves the common case a
// click. Deliberately not next-i18next's SUPPORTED_LOCALES: a learner's
// native/support language for this tool is independent of the site UI
// language, per the RFC.
const NATIVE_LANG_SUGGESTIONS = [
  { code: 'ka', label: 'ქართული' },
  { code: 'az', label: 'Azərbaycan' },
  { code: 'hy', label: 'Հայերեն' },
  { code: 'ru', label: 'Русский' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'uk', label: 'Українська' },
];

const dict = {
  ka: {
    setupTitle: 'ახალი გაკვეთილი',
    taskType: {
      READING: 'კითხვა',
      WRITING: 'წერა',
      GRAMMAR: 'გრამატიკა',
      VOCABULARY: 'ლექსიკა',
      QUIZ: 'ქვიზი',
      LISTENING: 'მოსმენა',
      DIALOGUE: 'დიალოგი',
    } as Record<TutorTaskType, string>,
    level: 'დონე (CEFR)',
    nativeLang: 'თქვენი მშობლიური/დამხმარე ენა',
    nativeLangPlaceholder: 'მაგ. ka, az, hy, ru...',
    topic: 'თემა (არასავალდებულო)',
    topicPlaceholder: 'მაგ. მოგზაურობა, გასაუბრება...',
    generate: 'გაკვეთილის გენერაცია',
    generating: 'გენერირდება…',
    proOnly: 'PRO',
    proLocked: 'ეს დონე ხელმისაწვდომია მხოლოდ PRO გეგმაზე.',
    dailyLimit: (used: number, limit: number) => `დღეს გამოყენებულია ${used}/${limit} უფასო გაკვეთილი.`,
    unlimited: 'შეუზღუდავი გაკვეთილები (PRO)',
    upgrade: 'გადადით PRO-ზე',
    submit: 'შემოწმება',
    submitting: 'იგზავნება…',
    score: 'შედეგი',
    correct: 'სწორია',
    incorrect: 'არასწორია',
    strengths: 'ძლიერი მხარეები',
    corrections: 'შესწორებები',
    yourAnswer: 'თქვენი პასუხი',
    typeMessage: 'დაწერეთ პასუხი...',
    send: 'გაგზავნა',
    finishDialogue: 'დასრულება და შეფასება',
    history: 'თქვენი გაკვეთილები',
    noHistory: 'ჯერ არცერთი გაკვეთილი არ გაქვთ.',
    error: 'დაფიქსირდა შეცდომა. სცადეთ ხელახლა.',
    wordCount: (n: number, target: number) => `${n} სიტყვა (სამიზნე: ~${target})`,
    listenTo: '🔊 მოსმენა',
    imiakoGreeting: 'IMIAKO-სთან ერთად ისწავლეთ ინგლისური თქვენს ტემპში.',
    trialActive: (days: number) => `PRO ტესტ-ვერსია — დარჩენილია ${days} დღე`,
    trialCta: 'დაიწყეთ 5 დღიანი უფასო ტესტი',
    upgradeCta: 'PRO-ზე გადასვლა',
    proActive: 'PRO აქტიურია',
    proUntil: (date: string) => `${date}-მდე`,
    cancelAutoRenew: 'ავტომატური განახლების გაუქმება',
    cancelled: 'ავტომატური განახლება გაუქმებულია — წვდომა შენარჩუნდება პერიოდის ბოლომდე.',
    goalLabel: 'სასწავლო მიზანი',
    resumeTitle: 'გააგრძელეთ სწავლა',
    resumeButton: 'გაგრძელება →',
    flagButton: 'პრობლემის შეტყობინება',
    flagPlaceholder: 'აღწერეთ პრობლემა (მაგ. არასწორი ინფორმაცია)…',
    flagSubmit: 'გაგზავნა',
    flagSent: 'მადლობა! გადავეცით გუნდს.',
  },
  en: {
    setupTitle: 'New Lesson',
    taskType: {
      READING: 'Reading',
      WRITING: 'Writing',
      GRAMMAR: 'Grammar',
      VOCABULARY: 'Vocabulary',
      QUIZ: 'Quiz',
      LISTENING: 'Listening',
      DIALOGUE: 'Dialogue',
    } as Record<TutorTaskType, string>,
    level: 'Level (CEFR)',
    nativeLang: 'Your native/support language',
    nativeLangPlaceholder: 'e.g. ka, az, hy, ru...',
    topic: 'Topic (optional)',
    topicPlaceholder: 'e.g. travel, job interviews...',
    generate: 'Generate Lesson',
    generating: 'Generating…',
    proOnly: 'PRO',
    proLocked: 'This level is available on the Pro plan only.',
    dailyLimit: (used: number, limit: number) => `${used}/${limit} free lessons used today.`,
    unlimited: 'Unlimited lessons (PRO)',
    upgrade: 'Upgrade to PRO',
    submit: 'Check Answers',
    submitting: 'Submitting…',
    score: 'Score',
    correct: 'Correct',
    incorrect: 'Incorrect',
    strengths: 'Strengths',
    corrections: 'Corrections',
    yourAnswer: 'Your answer',
    typeMessage: 'Type your reply...',
    send: 'Send',
    finishDialogue: 'Finish & Get Feedback',
    history: 'Your lessons',
    noHistory: "You haven't taken any lessons yet.",
    error: 'Something went wrong. Please try again.',
    wordCount: (n: number, target: number) => `${n} words (target: ~${target})`,
    listenTo: '🔊 Listen',
    imiakoGreeting: 'Learn English with IMIAKO, at your own pace.',
    trialActive: (days: number) => `PRO trial active — ${days} day${days === 1 ? '' : 's'} left`,
    trialCta: 'Start 5-day free trial',
    upgradeCta: 'Upgrade to PRO',
    proActive: 'PRO active',
    proUntil: (date: string) => `until ${date}`,
    cancelAutoRenew: 'Cancel auto-renew',
    cancelled: 'Auto-renew cancelled — access stays until the end of your period.',
    goalLabel: 'Learning goal',
    resumeTitle: 'Continue learning',
    resumeButton: 'Resume →',
    flagButton: 'Report an issue',
    flagPlaceholder: 'Describe the issue (e.g. incorrect information)…',
    flagSubmit: 'Submit',
    flagSent: 'Thanks! Sent to our team.',
  },
};

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { message?: string } } };
  return anyErr?.response?.data?.message || fallback;
}

export default function EnglishTutorPanel({ lang }: EnglishTutorPanelProps) {
  const t = dict[lang];
  const [tutorState, setTutorState] = useState<TutorState | null>(null);
  const [resumeState, setResumeState] = useState<TutorResumeState | null>(null);
  const [history, setHistory] = useState<TutorLessonListItem[]>([]);
  const [taskType, setTaskType] = useState<TutorTaskType>('READING');
  const [level, setLevel] = useState<CefrLevel>('A2');
  const [nativeLang, setNativeLang] = useState('');
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<TutorLesson | null>(null);
  const [grading, setGrading] = useState<TutorGradingResult | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  // Bridges the real gap between "onboarding UI finished" and "the server
  // actually knows tutorNativeLang" — that field is only ever persisted as
  // a side effect of the student's FIRST real lesson generation (see
  // TutorLesson.nativeLang's schema comment), never by onboarding itself.
  // Without this, handleOnboardingComplete's refresh() re-fetched the same
  // tutorState with tutorNativeLang still null, needsOnboarding stayed
  // true, and the "Start Learning" button appeared to do nothing — it was
  // actually unmounting and remounting a BRAND NEW TutorOnboardingFlow
  // (which resets to step 'lang'), not stalling on a slow request.
  const [onboardingJustCompleted, setOnboardingJustCompleted] = useState(false);
  // Drives the "Vocab Rush" waiting mini-game — separate from `generating`
  // itself so the game can stay mounted long enough to show its own
  // "lesson ready" banner (with the score just earned) after the request
  // finishes, rather than unmounting the instant generating flips false.
  const [showWaitingGame, setShowWaitingGame] = useState(false);

  const refresh = useCallback(() => {
    getTutorState()
      .then((s) => {
        setTutorState(s);
        if (s.tutorNativeLang && !nativeLang) setNativeLang(s.tutorNativeLang);
      })
      .catch(() => {});
    getTutorLessons()
      .then(setHistory)
      .catch(() => {});
    getTutorResumeState()
      .then(setResumeState)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isPro = !!tutorState?.isPro;
  // Onboarding gate — a brand-new student has never set a native language
  // yet (tutorNativeLang stays null server-side until the first lesson
  // generation actually happens). `tutorState === null` is the
  // still-loading case, deliberately not treated as "needs onboarding" to
  // avoid a flash of the onboarding flow before the real state arrives.
  // `!onboardingJustCompleted` is what actually lets the student through to
  // the lesson-generation form right after finishing onboarding, before
  // that first generation has run — see its own declaration above.
  const needsOnboarding = tutorState !== null && !tutorState.tutorNativeLang && !onboardingJustCompleted;

  const handleGenerate = async (overrideTaskType?: TutorTaskType, overrideLevel?: CefrLevel, overrideNativeLang?: string) => {
    const effectiveNativeLang = (overrideNativeLang ?? nativeLang).trim();
    if (!effectiveNativeLang) {
      setError(lang === 'ka' ? 'გთხოვთ მიუთითოთ ენა.' : 'Please specify your native language.');
      return;
    }
    setError(null);
    setGenerating(true);
    setShowWaitingGame(true);
    setGrading(null);
    try {
      const newLesson = await generateTutorLesson({
        taskType: overrideTaskType ?? taskType,
        level: overrideLevel ?? level,
        nativeLang: effectiveNativeLang,
        topic: topic.trim() || undefined,
      });
      setLesson(newLesson);
      saveTutorResumeState({ lastLessonId: newLesson.id, stepIndex: 0 }).catch(() => {});
      refresh();
    } catch (err: any) {
      // No "lesson ready" banner to show on failure — dismiss the game
      // immediately so the error message below is what the student sees.
      setShowWaitingGame(false);
      if (err?.response?.status === 403) {
        setShowPaywall(true);
      } else {
        setError(extractErrorMessage(err, t.error));
      }
    } finally {
      setGenerating(false);
    }
  };

  const openLesson = async (id: string) => {
    setError(null);
    setGrading(null);
    try {
      const loaded = await getTutorLesson(id);
      setLesson(loaded);
      setTaskType(loaded.taskType);
      setLevel(loaded.level);
    } catch (err) {
      setError(extractErrorMessage(err, t.error));
    }
  };

  const handleOnboardingComplete = ({ nativeLang: onboardNativeLang, level: onboardLevel }: { nativeLang: string; learningGoal: TutorLearningGoal; level: CefrLevel }) => {
    setNativeLang(onboardNativeLang);
    setLevel(onboardLevel);
    setOnboardingJustCompleted(true);
    refresh();
  };

  const handleGoalChange = async (goal: TutorLearningGoal) => {
    setSavingGoal(true);
    try {
      await setTutorLearningGoal(goal);
      refresh();
    } catch {
      // Non-fatal — the picker will just show the previous value on next refresh.
    } finally {
      setSavingGoal(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      await cancelTutorSubscription();
      refresh();
    } catch {
      // Non-fatal.
    }
  };

  const handleResume = () => {
    if (resumeState?.lastLessonId) openLesson(resumeState.lastLessonId);
  };

  if (needsOnboarding) {
    return <TutorOnboardingFlow lang={lang} onComplete={handleOnboardingComplete} />;
  }

  const trialDaysLeft = tutorState?.tutorTrialEndDate
    ? Math.max(0, Math.ceil((new Date(tutorState.tutorTrialEndDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  return (
    <div className="flex flex-col gap-8">
      {showPaywall && tutorState && (
        <TutorPaywallModal
          lang={lang}
          trialAvailable={tutorState.trialAvailable}
          onClose={() => setShowPaywall(false)}
          onTrialStarted={() => {
            setShowPaywall(false);
            refresh();
          }}
        />
      )}

      <div className="rounded-2xl border border-white/10 backdrop-blur-md bg-gradient-to-r from-amber-400/10 via-purple-500/10 to-cyan-500/10 px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2 shadow-lg shadow-purple-500/20">
        <p className="text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">{t.imiakoGreeting}</p>
        {tutorState && (
          <div className="flex items-center gap-2">
            {isPro ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Crown className="w-3.5 h-3.5" />
                {tutorState.trialActive ? t.trialActive(trialDaysLeft) : t.proActive}
                {!tutorState.trialActive && tutorState.subscriptionPeriodEnd && (
                  <span className="text-slate-400 font-normal">{t.proUntil(new Date(tutorState.subscriptionPeriodEnd).toLocaleDateString())}</span>
                )}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowPaywall(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 text-white px-3.5 py-1.5"
              >
                <Crown className="w-3.5 h-3.5" />
                {tutorState.trialAvailable ? t.trialCta : t.upgradeCta}
              </button>
            )}
            {isPro && !tutorState.trialActive && tutorState.subscriptionAutoRenew && (
              <button type="button" onClick={handleCancelSubscription} className="text-[11px] text-slate-400 hover:text-red-500 underline">
                {t.cancelAutoRenew}
              </button>
            )}
          </div>
        )}
      </div>
      {isPro && tutorState && !tutorState.subscriptionAutoRenew && !tutorState.trialActive && (
        <p className="text-xs text-amber-600 dark:text-amber-400 -mt-5">{t.cancelled}</p>
      )}

      {resumeState?.lastLessonId && !lesson && (
        <button
          type="button"
          onClick={handleResume}
          className="flex items-center justify-between rounded-2xl border border-cyan-300 dark:border-cyan-500/30 bg-cyan-50 dark:bg-cyan-500/10 px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-cyan-700 dark:text-cyan-300">
            <Clock className="w-4 h-4" /> {t.resumeTitle}
          </span>
          <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">{t.resumeButton}</span>
        </button>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" /> {t.setupTitle}
          </h2>
          {tutorState && (
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isPro || tutorState.dailyGenerationLimit === null ? t.unlimited : t.dailyLimit(tutorState.dailyGenerationUsed, tutorState.dailyGenerationLimit)}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-4 mb-5">
          {TASK_TYPES.map(({ value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTaskType(value)}
              className={`flex flex-col items-center gap-2 rounded-xl border border-white/10 backdrop-blur-md bg-gradient-to-br from-purple-500/10 to-cyan-500/10 px-3 py-4 text-xs font-bold transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/30 ${
                taskType === value
                  ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                  : 'text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5 text-purple-400" />
              {t.taskType[value]}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{t.level}</label>
            <div className="flex flex-wrap gap-1.5">
              {LEVELS.map((lvl) => {
                const locked = PRO_LEVELS.includes(lvl) && !isPro;
                return (
                  <button
                    key={lvl}
                    type="button"
                    // Was selectable regardless of `locked` — the backend
                    // correctly rejects a non-PRO generate-lesson request
                    // for a PRO level (403, routes/englishTutor.ts), so this
                    // was never an actual authorization gap, but the button
                    // itself let a free student "select" B2-C2, see it
                    // highlighted as chosen, then only discover it was
                    // locked after clicking Generate and hitting the
                    // paywall modal. Now the paywall opens immediately.
                    onClick={() => (locked ? setShowPaywall(true) : setLevel(lvl))}
                    title={locked ? t.proLocked : undefined}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
                      level === lvl
                        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    } ${locked ? 'opacity-60' : ''}`}
                  >
                    {lvl}
                    {locked && <Lock className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{t.nativeLang}</label>
            <input
              value={nativeLang}
              onChange={(e) => setNativeLang(e.target.value)}
              placeholder={t.nativeLangPlaceholder}
              list="tutor-native-lang-suggestions"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-1.5 text-sm"
            />
            <datalist id="tutor-native-lang-suggestions">
              {NATIVE_LANG_SUGGESTIONS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </datalist>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{t.goalLabel}</label>
          <div className="flex flex-wrap gap-1.5">
            {GOAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={savingGoal}
                onClick={() => handleGoalChange(opt.value)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold disabled:opacity-60 ${
                  tutorState?.tutorLearningGoal === opt.value
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {lang === 'ka' ? opt.ka : opt.en}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{t.topic}</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t.topicPlaceholder}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-1.5 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <button
          type="button"
          onClick={() => handleGenerate()}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 text-white font-bold px-5 py-2.5 text-sm disabled:opacity-60"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? t.generating : t.generate}
        </button>

        {showWaitingGame && (
          <div className="mt-4">
            <VocabWaitingGame lang={lang} loading={generating} onContinue={() => setShowWaitingGame(false)} />
          </div>
        )}
      </div>

      {lesson && (
        <LessonView
          lesson={lesson}
          lang={lang}
          t={t}
          grading={grading}
          onGraded={(g) => {
            setGrading(g);
            refresh();
          }}
        />
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
        <h2 className="text-lg font-bold mb-3">{t.history}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.noHistory}</p>
        ) : (
          <div className="flex flex-col gap-6">
            {history.map((item) => {
              const latest = item.progress[0];
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-4"
                >
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500"></div>
                  <div className="flex-1 p-4 rounded-xl border border-white/10 backdrop-blur-md bg-gradient-to-br from-slate-800/50 to-slate-900/50 shadow-lg">
                    <p className="text-sm font-bold text-slate-200">
                      {t.taskType[item.taskType]} · {item.level}
                      {item.topic ? ` · ${item.topic}` : ''}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {latest ? `${latest.status === 'COMPLETED' ? `${latest.score ?? '—'}%` : 'In Progress'}` : 'Not Started'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Lesson content dispatch ----

interface LessonViewProps {
  lesson: TutorLesson;
  lang: 'ka' | 'en';
  t: (typeof dict)['ka'];
  grading: TutorGradingResult | null;
  onGraded: (g: TutorGradingResult) => void;
}

function LessonView({ lesson, lang, t, grading, onGraded }: LessonViewProps) {
  switch (lesson.taskType) {
    case 'READING':
    case 'LISTENING':
    case 'VOCABULARY':
    case 'GRAMMAR':
    case 'QUIZ':
      return <QuestionsTaskView lesson={lesson} lang={lang} t={t} grading={grading} onGraded={onGraded} />;
    case 'WRITING':
      return <WritingTaskView lesson={lesson} lang={lang} t={t} grading={grading} onGraded={onGraded} />;
    case 'DIALOGUE':
      return <DialogueTaskView lesson={lesson} lang={lang} t={t} grading={grading} onGraded={onGraded} />;
  }
}

// Every lesson's actual reading/listening/dialogue content is always
// English regardless of the student's nativeLang (which only picks the
// EXPLANATION language, not the practice-content language — see
// TutorLesson.nativeLang's own comment) — so the narrator voice is
// unconditionally en-US, same as the raw 'en-US' literal DialogueTaskView
// passes VIPAudioNarrator directly below.
function speechLangFor(): string {
  return 'en-US';
}

function QuestionsTaskView({ lesson, lang, t, grading, onGraded }: LessonViewProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const content = lesson.content as ReadingContent | ListeningContent | VocabularyContent | GrammarContent | QuizContent;
  const questions = content.questions;

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitTutorLesson(lesson.id, { answers });
      onGraded({ score: result.score, feedback: result.feedback });
    } catch (err) {
      setSubmitError(extractErrorMessage(err, t.error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col gap-5">
      <FlagButton lessonId={lesson.id} t={t} />
      {'passage' in content && (
        <div>
          <p className="whitespace-pre-wrap leading-relaxed">{content.passage}</p>
        </div>
      )}
      {'script' in content && (
        <div className="flex flex-col gap-2">
          <VIPAudioNarrator text={content.script} speechLang={speechLangFor()} lang={lang} label={t.listenTo} />
          <p className="whitespace-pre-wrap text-sm text-slate-500 dark:text-slate-400">{content.script}</p>
        </div>
      )}
      {'vocabulary' in content && content.vocabulary.length > 0 && (
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          {content.vocabulary.map((v, i) => (
            <li key={i} className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
              <strong>{v.word}</strong> — {v.definition}
            </li>
          ))}
        </ul>
      )}
      {'words' in content && (
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          {content.words.map((w, i) => (
            <li key={i} className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
              <strong>{w.word}</strong> <span className="text-slate-400">({w.partOfSpeech})</span> — {w.translation}
              <div className="text-slate-500 dark:text-slate-400 italic">{w.exampleSentence}</div>
            </li>
          ))}
        </ul>
      )}
      {'explanation' in content && (
        <div>
          <p className="whitespace-pre-wrap mb-2">{content.explanation}</p>
          <ul className="list-disc list-inside text-sm text-slate-500 dark:text-slate-400">
            {content.examples.map((ex, i) => (
              <li key={i}>{ex}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {questions.map((q, i) => {
          const perQuestion = grading?.feedback.perQuestion?.[i];
          return (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="font-semibold mb-2">
                {i + 1}. {q.question}
              </p>
              <div className="flex flex-col gap-1.5">
                {(Object.keys(q.options) as Array<'A' | 'B' | 'C' | 'D'>).map((key) => {
                  const selected = answers[String(i)] === key;
                  const showResult = !!perQuestion;
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${
                        selected ? 'border-purple-400 bg-purple-50 dark:bg-purple-500/10' : 'border-slate-200 dark:border-slate-800'
                      } ${showResult ? 'pointer-events-none opacity-90' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`q-${i}`}
                        checked={selected}
                        onChange={() => {
                          setAnswers((prev) => {
                            const next = { ...prev, [String(i)]: key };
                            saveTutorResumeState({ lastLessonId: lesson.id, stepIndex: Object.keys(next).length }).catch(() => {});
                            return next;
                          });
                        }}
                        disabled={!!grading}
                      />
                      <span>
                        <strong>{key}.</strong> {q.options[key]}
                      </span>
                    </label>
                  );
                })}
              </div>
              {perQuestion && (
                <p className={`text-xs mt-2 font-semibold ${perQuestion.correct ? 'text-emerald-500' : 'text-red-500'}`}>
                  {perQuestion.correct ? t.correct : t.incorrect} — {perQuestion.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {submitError && <p className="text-sm text-red-500">{submitError}</p>}

      {!grading && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || Object.keys(answers).length < questions.length}
          className="self-start rounded-full bg-purple-600 text-white font-bold px-5 py-2 text-sm disabled:opacity-50"
        >
          {submitting ? t.submitting : t.submit}
        </button>
      )}

      {grading && (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm font-bold">
          {t.score}: {grading.score}% — {grading.feedback.summary}
        </div>
      )}
    </div>
  );
}

function WritingTaskView({ lesson, t, grading, onGraded }: LessonViewProps) {
  const content = lesson.content as WritingContent;
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  // Debounced autosave — "persist on every user action" without firing a
  // request per keystroke. stepIndex here is the word count so far, a
  // rough-but-honest measure of progress through a free-text task (there
  // is no natural discrete step to count the way there is for a
  // question-based lesson).
  useEffect(() => {
    if (!text.trim()) return;
    const handle = setTimeout(() => {
      saveTutorResumeState({ lastLessonId: lesson.id, stepIndex: wordCount }).catch(() => {});
    }, 1500);
    return () => clearTimeout(handle);
  }, [text, lesson.id, wordCount]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitTutorLesson(lesson.id, { text });
      onGraded({ score: result.score, feedback: result.feedback });
    } catch (err) {
      setSubmitError(extractErrorMessage(err, t.error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col gap-4">
      <p className="font-semibold">{content.prompt}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{content.guidance}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!!grading}
        rows={8}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2 text-sm"
      />
      <p className="text-xs text-slate-400">{t.wordCount(wordCount, content.targetWordCount)}</p>
      <FlagButton lessonId={lesson.id} t={t} />

      {submitError && <p className="text-sm text-red-500">{submitError}</p>}

      {!grading && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
          className="self-start rounded-full bg-purple-600 text-white font-bold px-5 py-2 text-sm disabled:opacity-50"
        >
          {submitting ? t.submitting : t.submit}
        </button>
      )}

      {grading && <GradingSummary grading={grading} t={t} />}
    </div>
  );
}

function DialogueTaskView({ lesson, lang, t, grading, onGraded }: LessonViewProps) {
  const content = lesson.content as DialogueContent;
  const [turns, setTurns] = useState<{ role: 'student' | 'tutor'; text: string }[]>([{ role: 'tutor', text: content.openingLine }]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    const nextTurns = [...turns, { role: 'student' as const, text: trimmed }];
    setTurns(nextTurns);
    setMessage('');
    saveTutorResumeState({ lastLessonId: lesson.id, stepIndex: nextTurns.length }).catch(() => {});
    try {
      const reply = await sendDialogueMessage(lesson.id, turns, trimmed);
      setTurns([...nextTurns, { role: 'tutor', text: reply }]);
    } catch (err) {
      setError(extractErrorMessage(err, t.error));
    } finally {
      setSending(false);
    }
  };

  const handleFinish = async () => {
    setFinishing(true);
    setError(null);
    try {
      const result = await submitTutorLesson(lesson.id, { turns });
      onGraded({ score: result.score, feedback: result.feedback });
    } catch (err) {
      setError(extractErrorMessage(err, t.error));
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">{content.scenario}</p>
        <FlagButton lessonId={lesson.id} t={t} />
      </div>

      <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
        {turns.map((turn, i) => (
          <div key={i} className={`flex flex-col ${turn.role === 'student' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-lg ${
                turn.role === 'student'
                  ? 'bg-gradient-to-br from-purple-600 to-purple-800 text-white'
                  : 'bg-gradient-to-br from-slate-800/50 to-slate-900/50 text-slate-200'
              }`}
            >
              {turn.text}
            </div>
            {turn.role === 'tutor' && (
              <div className="mt-1">
                <VIPAudioNarrator text={turn.text} speechLang="en-US" lang={lang} compact />
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!grading && (
        <div className="flex gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t.typeMessage}
            disabled={sending || finishing}
            className="flex-1 rounded-full border border-slate-200 dark:border-slate-800 bg-transparent px-4 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || finishing || !message.trim()}
            className="rounded-full bg-purple-600 text-white p-2.5 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}

      {!grading && (
        <button
          type="button"
          onClick={handleFinish}
          disabled={finishing || turns.filter((t2) => t2.role === 'student').length === 0}
          className="self-start text-sm font-bold text-purple-600 dark:text-purple-400 disabled:opacity-50"
        >
          {finishing ? t.submitting : t.finishDialogue}
        </button>
      )}

      {grading && <GradingSummary grading={grading} t={t} />}
    </div>
  );
}

function FlagButton({ lessonId, t }: { lessonId: string; t: (typeof dict)['ka'] }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) return <p className="text-xs text-emerald-500">{t.flagSent}</p>;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-end inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-500">
        <Flag className="w-3 h-3" /> {t.flagButton}
      </button>
    );
  }

  const handleSubmit = async () => {
    if (reason.trim().length < 5) return;
    setSending(true);
    try {
      await flagTutorContent({ lessonId, reason: reason.trim() });
      setSent(true);
    } catch {
      // Non-fatal.
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="self-end flex items-center gap-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t.flagPlaceholder}
        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent px-2.5 py-1 text-xs w-56"
      />
      <button type="button" onClick={handleSubmit} disabled={sending || reason.trim().length < 5} className="text-xs font-bold text-red-500 disabled:opacity-50">
        {t.flagSubmit}
      </button>
    </div>
  );
}

function GradingSummary({ grading, t }: { grading: TutorGradingResult; t: (typeof dict)['ka'] }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm flex flex-col gap-2">
      <p className="font-bold">
        {t.score}: {grading.score}%
      </p>
      <p>{grading.feedback.summary}</p>
      {!!grading.feedback.strengths?.length && (
        <div>
          <p className="font-semibold text-emerald-600 dark:text-emerald-400">{t.strengths}</p>
          <ul className="list-disc list-inside">
            {grading.feedback.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {!!grading.feedback.corrections?.length && (
        <div>
          <p className="font-semibold text-amber-600 dark:text-amber-400">{t.corrections}</p>
          <ul className="list-disc list-inside">
            {grading.feedback.corrections.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
