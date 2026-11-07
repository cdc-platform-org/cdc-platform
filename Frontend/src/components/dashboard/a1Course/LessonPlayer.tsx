import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { X, Volume2, Snail, Mic, Loader2, Lightbulb, Flame, BookOpen, PenLine, Headphones, MessageCircle, Check } from 'lucide-react';
import { CourseLesson, Exercise, EXERCISE_SKILLS, Skill } from './curriculum';
import { checkAnswer, CheckResult, fillName } from './answerCheck';
import { speakEnglish, canSpeak, canRecognize, listenOnce } from './speech';

export interface LessonResult {
  lessonId: string;
  xp: number;
  accuracy: number;
  skills: Record<Skill, number>;
}

interface LessonPlayerProps {
  lesson: CourseLesson;
  lang: 'ka' | 'en';
  nameEn: string;
  nameKa: string;
  onExit: () => void;
  onComplete: (result: LessonResult) => void;
}

const dict = {
  ka: {
    newWord: 'ახალი სიტყვა',
    newPhrase: 'ახალი ფრაზა',
    pickImage: 'აირჩიე სწორი სურათი',
    readPick: 'რას ნიშნავს?',
    build: 'ააწყვე წინადადება ინგლისურად',
    typeDictate: 'გადაწერე ინგლისურად',
    typeTranslate: 'დაწერე ინგლისურად',
    listenType: 'მოუსმინე და ჩაწერე, რაც გაიგე',
    listenPick: 'მოუსმინე და აირჩიე, რა თქვა',
    speak: 'წაიკითხე ხმამაღლა',
    fill: 'შეავსე გამოტოვებული სიტყვა',
    placeholder: 'ჩაწერე აქ…',
    check: 'შემოწმება',
    continue: 'გაგრძელება',
    gotIt: 'გასაგებია',
    hint: 'მინიშნება',
    hintText: (first: string) => `დაიწყე ასე: „${first}…“`,
    correctAnswer: 'სწორი პასუხი:',
    missing: 'გამოგრჩა:',
    extra: 'ზედმეტია:',
    almost: 'თითქმის! ყურადღება მიაქციე მართლწერას:',
    wrong: 'არა უშავს — ვისწავლოთ!',
    capitalI: '„I“ ყოველთვის დიდი ასოთი იწერება.',
    praise: ['ყოჩაღ!', 'შესანიშნავია!', 'ზუსტად ასეა!', 'ძალიან კარგი!', 'მშვენიერია!', 'ასე გააგრძელე!'],
    streak: (n: number) => `🔥 ${n} ზედიზედ!`,
    retryLater: 'ამ დავალებას ბოლოს კიდევ ერთხელ გავიმეორებთ.',
    tapToSpeak: 'დააჭირე და თქვი',
    listening: 'გისმენ…',
    youSaid: 'გავიგე:',
    cantSpeak: 'ახლა ვერ ვლაპარაკობ',
    micUnsupported: 'ამ ბრაუზერში ხმის ამოცნობა არ მუშაობს (სცადე Chrome ან Edge). შეგიძლია გამოტოვო.',
    micDenied: 'მიკროფონზე წვდომა არ არის. ბრაუზერში დაუშვი მიკროფონი ან გამოტოვე.',
    noSpeech: 'ვერაფერი გავიგე. სცადე ხელახლა, ცოტა უფრო ხმამაღლა.',
    listen: 'მოსმენა',
    slow: 'ნელა',
    exit: 'გასვლა',
    doneTitle: 'გაკვეთილი დასრულდა!',
    xp: 'XP',
    accuracy: 'სიზუსტე',
    skillsPracticed: 'რა ივარჯიშე:',
    skills: { reading: 'კითხვა', writing: 'წერა', listening: 'მოსმენა', speaking: 'საუბარი' } as Record<Skill, string>,
    finish: 'დასრულება',
  },
  en: {
    newWord: 'New word',
    newPhrase: 'New phrase',
    pickImage: 'Choose the right picture',
    readPick: 'What does it mean?',
    build: 'Build the sentence in English',
    typeDictate: 'Copy it in English',
    typeTranslate: 'Write it in English',
    listenType: 'Listen and type what you hear',
    listenPick: 'Listen and choose what was said',
    speak: 'Read it aloud',
    fill: 'Fill in the missing word',
    placeholder: 'Type here…',
    check: 'Check',
    continue: 'Continue',
    gotIt: 'Got it',
    hint: 'Hint',
    hintText: (first: string) => `Start with: "${first}…"`,
    correctAnswer: 'Correct answer:',
    missing: 'Missing:',
    extra: 'Not needed:',
    almost: 'Almost! Watch the spelling:',
    wrong: 'No problem — let’s learn it!',
    capitalI: '"I" is always written with a capital letter.',
    praise: ['Great job!', 'Excellent!', 'Exactly right!', 'Very good!', 'Nice!', 'Keep going!'],
    streak: (n: number) => `🔥 ${n} in a row!`,
    retryLater: 'We’ll try this one again at the end.',
    tapToSpeak: 'Tap and speak',
    listening: 'Listening…',
    youSaid: 'I heard:',
    cantSpeak: 'I can’t speak right now',
    micUnsupported: 'Speech recognition doesn’t work in this browser (try Chrome or Edge). You can skip.',
    micDenied: 'No microphone access. Allow the microphone in your browser, or skip.',
    noSpeech: 'I didn’t hear anything. Try again, a bit louder.',
    listen: 'Listen',
    slow: 'Slow',
    exit: 'Exit',
    doneTitle: 'Lesson complete!',
    xp: 'XP',
    accuracy: 'Accuracy',
    skillsPracticed: 'Skills practised:',
    skills: { reading: 'Reading', writing: 'Writing', listening: 'Listening', speaking: 'Speaking' } as Record<Skill, string>,
    finish: 'Finish',
  },
};
type Dict = (typeof dict)['ka'];

const SKILL_ICONS: Record<Skill, typeof BookOpen> = { reading: BookOpen, writing: PenLine, listening: Headphones, speaking: MessageCircle };

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function displayWord(w: string): string {
  return w === 'i' ? 'I' : w;
}

interface Feedback {
  status: 'correct' | 'typo' | 'wrong' | 'skipped';
  result?: CheckResult;
  expected?: string;
  heard?: string;
  tip?: string;
}

export default function LessonPlayer({ lesson, lang, nameEn, nameKa, onExit, onComplete }: LessonPlayerProps) {
  const t = dict[lang];
  const [queue, setQueue] = useState<Exercise[]>(lesson.exercises);
  const [pos, setPos] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [streak, setStreak] = useState(0);
  const [stats, setStats] = useState({ checked: 0, firstTryCorrect: 0 });
  const [skills, setSkills] = useState<Record<Skill, number>>({ reading: 0, writing: 0, listening: 0, speaking: 0 });
  const [retried, setRetried] = useState<Set<number>>(new Set());
  const [praise, setPraise] = useState('');
  const [done, setDone] = useState(false);

  const ex = queue[pos];
  const en = (s: string) => fillName(s, nameEn);
  const ka = (s: string) => fillName(s, nameKa || nameEn);

  // Auto-play audio when an exercise that is about hearing English appears.
  useEffect(() => {
    if (!ex || done) return;
    const auto =
      ex.kind === 'teach' ? ex.en : ex.kind === 'listen_type' ? ex.answer : ex.kind === 'listen_pick' ? ex.en : ex.kind === 'pick_image' ? ex.en : null;
    if (auto) {
      const h = setTimeout(() => speakEnglish(en(auto)), 250);
      return () => clearTimeout(h);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, done]);

  const evaluate = (): Feedback => {
    switch (ex.kind) {
      case 'pick_image':
        return { status: answer === ex.en ? 'correct' : 'wrong', expected: ex.en };
      case 'read_pick':
        return { status: answer === ex.answer ? 'correct' : 'wrong', expected: ka(ex.answer) };
      case 'listen_pick':
        return { status: answer === ex.en ? 'correct' : 'wrong', expected: en(ex.en) };
      case 'fill':
        return { status: answer === ex.answer ? 'correct' : 'wrong', expected: `${en(ex.before)} ${ex.answer} ${en(ex.after)}`, tip: ex.tip };
      case 'build':
      case 'type':
      case 'listen_type': {
        const result = checkAnswer(answer, [ex.answer, ...(ex.alt ?? [])], nameEn, false, ex.kind !== 'build');
        return { status: result.status, result, expected: result.expected, tip: ex.tip };
      }
      case 'speak': {
        const heard = answer.split('\n');
        let best: CheckResult | null = null;
        for (const h of heard) {
          const r = checkAnswer(h, [ex.en], nameEn, true);
          if (!best || r.status === 'correct' || (r.status === 'typo' && best.status === 'wrong')) best = r;
          if (r.status === 'correct') break;
        }
        return { status: best && best.status !== 'wrong' ? 'correct' : 'wrong', result: best ?? undefined, expected: en(ex.en), heard: heard[0] };
      }
      default:
        return { status: 'correct' };
    }
  };

  const handleCheck = () => {
    if (!ex || feedback) return;
    if (ex.kind === 'teach') {
      advance();
      return;
    }
    if (!answer.trim()) return;
    const fb = evaluate();
    setFeedback(fb);
    const ok = fb.status !== 'wrong';
    const firstTry = !retried.has(pos);
    setStats((s) => ({ checked: s.checked + (firstTry ? 1 : 0), firstTryCorrect: s.firstTryCorrect + (ok && firstTry ? 1 : 0) }));
    if (ok) {
      setStreak((n) => n + 1);
      setPraise(t.praise[Math.floor(Math.random() * t.praise.length)]);
      setSkills((prev) => {
        const next = { ...prev };
        for (const s of EXERCISE_SKILLS[ex.kind]) next[s] += 1;
        return next;
      });
      if (ex.kind !== 'listen_type' && ex.kind !== 'speak') {
        const say = ex.kind === 'read_pick' || ex.kind === 'pick_image' || ex.kind === 'listen_pick' ? null : fb.expected;
        if (say) speakEnglish(say);
      }
    } else {
      setStreak(0);
      // Duolingo-style: a missed exercise comes back once at the end.
      setQueue((q) => [...q, ex]);
      setRetried((r) => new Set(r).add(queue.length));
    }
  };

  const handleSkipSpeaking = () => {
    setFeedback({ status: 'skipped' });
  };

  const advance = () => {
    setFeedback(null);
    setAnswer('');
    if (pos + 1 >= queue.length) {
      finish();
    } else {
      setPos((p) => p + 1);
    }
  };

  const finish = () => {
    setDone(true);
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
  };

  const accuracy = stats.checked ? Math.round((stats.firstTryCorrect / stats.checked) * 100) : 100;
  const xp = 10 + stats.firstTryCorrect;

  // Enter = check / continue.
  const keyRef = useRef<() => void>(() => {});
  keyRef.current = () => {
    if (done) return;
    if (feedback) advance();
    else handleCheck();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        keyRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (done) {
    return (
      <div className="flex flex-col items-center text-center gap-5 py-6" data-testid="a1-lesson-done">
        <div className="text-6xl">🏆</div>
        <h3 className="text-2xl font-black">{t.doneTitle}</h3>
        <div className="flex gap-3">
          <div className="rounded-2xl border-2 border-amber-400 px-5 py-3">
            <div className="text-xs font-bold text-amber-500">{t.xp}</div>
            <div className="text-2xl font-black">+{xp}</div>
          </div>
          <div className="rounded-2xl border-2 border-emerald-400 px-5 py-3">
            <div className="text-xs font-bold text-emerald-500">{t.accuracy}</div>
            <div className="text-2xl font-black">{accuracy}%</div>
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">{t.skillsPracticed}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {(Object.keys(SKILL_ICONS) as Skill[]).map((s) => {
              const Icon = SKILL_ICONS[s];
              const practised = skills[s] > 0;
              return (
                <span
                  key={s}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                    practised ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {t.skills[s]} {practised && <Check className="w-3.5 h-3.5" />}
                </span>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onComplete({ lessonId: lesson.id, xp, accuracy, skills })}
          className="rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black px-8 py-3 shadow-[0_4px_0_0_rgb(4,120,87)] active:translate-y-0.5 active:shadow-none"
        >
          {t.finish}
        </button>
      </div>
    );
  }

  const progress = Math.round((pos / queue.length) * 100);
  const canCheck = ex.kind === 'teach' || !!answer.trim();

  return (
    <div className="flex flex-col gap-5" data-testid="a1-lesson-player">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onExit} aria-label={t.exit} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <X className="w-6 h-6" />
        </button>
        <div className="flex-1 h-4 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500" style={{ width: `${Math.max(progress, 3)}%` }} />
        </div>
        {streak >= 2 && (
          <span className="inline-flex items-center gap-1 text-sm font-black text-orange-500">
            <Flame className="w-4 h-4" /> {streak}
          </span>
        )}
      </div>

      <div className="min-h-[300px]" key={pos}>
        <ExerciseView ex={ex} t={t} en={en} ka={ka} nameEn={nameEn} answer={answer} setAnswer={setAnswer} locked={!!feedback} onSkipSpeaking={handleSkipSpeaking} />
      </div>

      {feedback ? (
        <FeedbackBar feedback={feedback} t={t} praise={praise} streak={streak} onContinue={advance} />
      ) : (
        <div className="flex justify-end border-t border-slate-200 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={handleCheck}
            disabled={!canCheck}
            className="rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black px-8 py-3 shadow-[0_4px_0_0_rgb(4,120,87)] active:translate-y-0.5 active:shadow-none disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-700 disabled:cursor-not-allowed"
          >
            {ex.kind === 'teach' ? t.gotIt : t.check}
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Feedback ----

function FeedbackBar({ feedback, t, praise, streak, onContinue }: { feedback: Feedback; t: Dict; praise: string; streak: number; onContinue: () => void }) {
  const ok = feedback.status === 'correct' || feedback.status === 'typo' || feedback.status === 'skipped';
  const r = feedback.result;
  return (
    <div
      data-testid="a1-feedback"
      className={`rounded-2xl px-4 py-4 flex flex-col sm:flex-row sm:items-end gap-3 ${
        ok ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200'
      }`}
    >
      <div className="flex-1 flex flex-col gap-1.5 text-sm">
        {feedback.status === 'correct' && (
          <p className="text-lg font-black">
            ✅ {praise} {streak >= 3 && streak % 1 === 0 && <span className="text-orange-500 text-sm ml-1">{t.streak(streak)}</span>}
          </p>
        )}
        {feedback.status === 'skipped' && <p className="font-bold">👌</p>}
        {feedback.status === 'typo' && (
          <>
            <p className="text-lg font-black">✅ {t.almost}</p>
            <p className="font-bold text-base">{feedback.expected}</p>
          </>
        )}
        {feedback.status === 'wrong' && (
          <>
            <p className="text-lg font-black">💡 {t.wrong}</p>
            <p>
              {t.correctAnswer} <span className="font-black text-base">{feedback.expected}</span>
            </p>
            {feedback.heard && (
              <p className="opacity-80">
                {t.youSaid} „{feedback.heard}“
              </p>
            )}
            {r && r.missing.length > 0 && !feedback.heard && (
              <p>
                {t.missing} <strong>{r.missing.map(displayWord).join(', ')}</strong>
              </p>
            )}
            {r && r.extra.length > 0 && !feedback.heard && (
              <p>
                {t.extra} <strong className="line-through">{r.extra.map(displayWord).join(', ')}</strong>
              </p>
            )}
            {feedback.tip && <p className="italic">💬 {feedback.tip}</p>}
            <p className="text-xs opacity-70">{t.retryLater}</p>
          </>
        )}
        {ok && r?.lowercaseI && !feedback.heard && <p className="text-xs">✍️ {t.capitalI}</p>}
      </div>
      <button
        type="button"
        onClick={onContinue}
        autoFocus
        className={`rounded-2xl text-white font-black px-8 py-3 active:translate-y-0.5 active:shadow-none ${
          ok ? 'bg-emerald-500 hover:bg-emerald-600 shadow-[0_4px_0_0_rgb(4,120,87)]' : 'bg-rose-500 hover:bg-rose-600 shadow-[0_4px_0_0_rgb(159,18,57)]'
        }`}
      >
        {t.continue}
      </button>
    </div>
  );
}

// ---- Exercise views ----

interface ExerciseViewProps {
  ex: Exercise;
  t: Dict;
  en: (s: string) => string;
  ka: (s: string) => string;
  nameEn: string;
  answer: string;
  setAnswer: (v: string) => void;
  locked: boolean;
  onSkipSpeaking: () => void;
}

function AudioButtons({ text, t, big }: { text: string; t: Dict; big?: boolean }) {
  if (!canSpeak()) return null;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => speakEnglish(text)}
        aria-label={t.listen}
        className={`inline-flex items-center justify-center rounded-2xl bg-sky-500 hover:bg-sky-600 text-white shadow-[0_4px_0_0_rgb(3,105,161)] active:translate-y-0.5 active:shadow-none ${
          big ? 'w-20 h-20' : 'w-11 h-11'
        }`}
      >
        <Volume2 className={big ? 'w-9 h-9' : 'w-5 h-5'} />
      </button>
      <button
        type="button"
        onClick={() => speakEnglish(text, true)}
        aria-label={t.slow}
        title={t.slow}
        className={`inline-flex items-center justify-center rounded-2xl border-2 border-sky-300 text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-500/10 ${big ? 'w-14 h-14' : 'w-11 h-11'}`}
      >
        <Snail className="w-5 h-5" />
      </button>
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xl sm:text-2xl font-black mb-4">{children}</h3>;
}

function Picture({ pic, size = 'text-7xl' }: { pic?: string; size?: string }) {
  if (!pic) return null;
  return (
    <div className={`${size} leading-none select-none`} aria-hidden>
      {pic}
    </div>
  );
}

function OptionButton({ selected, onClick, disabled, children }: { selected: boolean; onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border-2 px-4 py-3 text-left font-bold transition-colors ${
        selected
          ? 'border-sky-400 bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-200 shadow-[0_3px_0_0_rgb(56,189,248)]'
          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-[0_3px_0_0_rgb(226,232,240)] dark:shadow-[0_3px_0_0_rgb(51,65,85)]'
      }`}
    >
      {children}
    </button>
  );
}

function TextAnswer({ t, answer, setAnswer, locked }: { t: Dict; answer: string; setAnswer: (v: string) => void; locked: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <textarea
      ref={ref}
      value={answer}
      onChange={(e) => setAnswer(e.target.value)}
      disabled={locked}
      rows={2}
      autoCapitalize="sentences"
      autoCorrect="off"
      spellCheck={false}
      placeholder={t.placeholder}
      data-testid="a1-text-answer"
      className="w-full rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-lg focus:outline-none focus:border-sky-400"
    />
  );
}

function ExerciseView(props: ExerciseViewProps) {
  const { ex, t, en, ka, answer, setAnswer, locked } = props;

  switch (ex.kind) {
    case 'teach': {
      const isPhrase = ex.en.trim().includes(' ');
      return (
        <div className="flex flex-col items-center text-center gap-4">
          <span className="text-xs font-black uppercase tracking-wider text-purple-500">✨ {isPhrase ? t.newPhrase : t.newWord}</span>
          <Picture pic={ex.pic} size="text-8xl" />
          <div className="flex items-center gap-3">
            <p className="text-3xl sm:text-4xl font-black">{en(ex.en)}</p>
          </div>
          <p className="text-lg text-slate-500 dark:text-slate-400">{ka(ex.ka)}</p>
          <AudioButtons text={en(ex.en)} t={t} />
          {ex.note && (
            <div className="max-w-md rounded-2xl bg-purple-50 dark:bg-purple-500/10 text-purple-800 dark:text-purple-200 px-4 py-3 text-sm text-left">
              <span className="font-black">IMIAKO: </span>
              {ka(ex.note)}
            </div>
          )}
        </div>
      );
    }

    case 'pick_image':
      return (
        <div>
          <Title>{t.pickImage}</Title>
          <div className="flex items-center gap-3 mb-5">
            <AudioButtons text={ex.en} t={t} />
            <span className="text-2xl font-black">{ex.en}</span>
          </div>
          <div className={`grid gap-3 ${ex.options.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
            {ex.options.map((o) => (
              <button
                key={o.en}
                type="button"
                disabled={locked}
                onClick={() => setAnswer(o.en)}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-colors ${
                  answer === o.en
                    ? 'border-sky-400 bg-sky-50 dark:bg-sky-500/15 shadow-[0_3px_0_0_rgb(56,189,248)]'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-[0_3px_0_0_rgb(226,232,240)] dark:shadow-[0_3px_0_0_rgb(51,65,85)]'
                }`}
              >
                <span className="text-5xl sm:text-6xl leading-none">{o.pic}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{o.ka}</span>
              </button>
            ))}
          </div>
        </div>
      );

    case 'read_pick':
      return (
        <div>
          <Title>{t.readPick}</Title>
          <div className="flex items-start gap-4 mb-5">
            <Picture pic={ex.pic} size="text-6xl" />
            <div className="flex flex-col gap-2">
              <p className="text-2xl font-black whitespace-pre-line">{en(ex.en)}</p>
              <AudioButtons text={en(ex.en)} t={t} />
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {ex.options.map((o) => (
              <OptionButton key={o} selected={answer === o} disabled={locked} onClick={() => setAnswer(o)}>
                {ka(o)}
              </OptionButton>
            ))}
          </div>
        </div>
      );

    case 'listen_pick':
      return (
        <div>
          <Title>{t.listenPick}</Title>
          <div className="mb-5">
            <AudioButtons text={en(ex.en)} t={t} big />
          </div>
          <div className="flex flex-col gap-2.5">
            {ex.options.map((o) => (
              <OptionButton key={o} selected={answer === o} disabled={locked} onClick={() => setAnswer(o)}>
                {en(o)}
              </OptionButton>
            ))}
          </div>
        </div>
      );

    case 'fill':
      return (
        <div>
          <Title>{t.fill}</Title>
          <p className="text-slate-500 dark:text-slate-400 mb-3">{ka(ex.ka)}</p>
          <p className="text-2xl sm:text-3xl font-black mb-6 flex flex-wrap items-center gap-2">
            <span>{en(ex.before)}</span>
            <span className={`inline-block min-w-[80px] border-b-4 text-center ${answer ? 'border-sky-400 text-sky-600 dark:text-sky-300' : 'border-slate-300 dark:border-slate-600'}`}>
              {answer || ' '}
            </span>
            <span>{en(ex.after)}</span>
          </p>
          <div className="flex flex-wrap gap-2.5">
            {ex.options.map((o) => (
              <OptionButton key={o} selected={answer === o} disabled={locked} onClick={() => setAnswer(o)}>
                {o}
              </OptionButton>
            ))}
          </div>
        </div>
      );

    case 'build':
      return <BuildExercise {...props} ex={ex} />;

    case 'type': {
      return <TypeExercise {...props} ex={ex} />;
    }

    case 'listen_type':
      return (
        <div>
          <Title>{t.listenType}</Title>
          <div className="mb-5">
            <AudioButtons text={en(ex.answer)} t={t} big />
          </div>
          <TextAnswer t={t} answer={answer} setAnswer={setAnswer} locked={locked} />
        </div>
      );

    case 'speak':
      return <SpeakExercise {...props} ex={ex} />;
  }
}

function TypeExercise({ ex, t, en, ka, answer, setAnswer, locked }: ExerciseViewProps & { ex: Extract<Exercise, { kind: 'type' }> }) {
  const [showHint, setShowHint] = useState(false);
  const firstWords = en(ex.answer).split(' ').slice(0, 2).join(' ');
  return (
    <div>
      <Title>{ex.dictate ? t.typeDictate : t.typeTranslate}</Title>
      <div className="flex items-center gap-4 mb-4">
        <Picture pic={ex.pic} size="text-6xl" />
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 px-4 py-3">
          <p className="text-lg font-bold">{ka(ex.ka)}</p>
          {ex.dictate && (
            <p className="mt-1 text-2xl font-black text-sky-600 dark:text-sky-300 flex items-center gap-2">
              {en(ex.answer)} <AudioButtons text={en(ex.answer)} t={t} />
            </p>
          )}
        </div>
      </div>
      <TextAnswer t={t} answer={answer} setAnswer={setAnswer} locked={locked} />
      {!ex.dictate && !locked && (
        <div className="mt-2">
          {showHint ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">💡 {t.hintText(firstWords)}</p>
          ) : (
            <button type="button" onClick={() => setShowHint(true)} className="inline-flex items-center gap-1 text-sm font-bold text-amber-600 dark:text-amber-400">
              <Lightbulb className="w-4 h-4" /> {t.hint}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function BuildExercise({ ex, t, ka, nameEn, setAnswer, locked }: ExerciseViewProps & { ex: Extract<Exercise, { kind: 'build' }> }) {
  const tiles = useMemo(() => {
    const words = fillName(ex.answer, nameEn)
      .replace(/[.,!?]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    return shuffle([...words, ...ex.extra]).map((w, i) => ({ id: i, w }));
  }, [ex, nameEn]);
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => {
    setAnswer(picked.map((id) => tiles.find((x) => x.id === id)!.w).join(' '));
  }, [picked, tiles, setAnswer]);

  return (
    <div>
      <Title>{t.build}</Title>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-4xl">💬</span>
        <p className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 px-4 py-3 text-lg font-bold">{ka(ex.ka)}</p>
      </div>
      <div className="min-h-[64px] border-b-2 border-t-2 border-slate-200 dark:border-slate-700 py-3 flex flex-wrap gap-2 mb-5" data-testid="a1-build-answer">
        {picked.map((id) => {
          const tile = tiles.find((x) => x.id === id)!;
          return (
            <button
              key={id}
              type="button"
              disabled={locked}
              onClick={() => setPicked((p) => p.filter((x) => x !== id))}
              className="rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 font-bold shadow-[0_3px_0_0_rgb(226,232,240)] dark:shadow-[0_3px_0_0_rgb(51,65,85)]"
            >
              {tile.w}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {tiles.map((tile) => {
          const used = picked.includes(tile.id);
          return (
            <button
              key={tile.id}
              type="button"
              disabled={locked || used}
              onClick={() => {
                setPicked((p) => [...p, tile.id]);
                speakEnglish(tile.w);
              }}
              className={`rounded-xl border-2 px-3 py-2 font-bold ${
                used
                  ? 'border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-700 text-transparent'
                  : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-[0_3px_0_0_rgb(226,232,240)] dark:shadow-[0_3px_0_0_rgb(51,65,85)] hover:bg-slate-50'
              }`}
            >
              {tile.w}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SpeakExercise({ ex, t, en, ka, setAnswer, locked, onSkipSpeaking }: ExerciseViewProps & { ex: Extract<Exercise, { kind: 'speak' }> }) {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState<string | null>(canRecognize() ? null : t.micUnsupported);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => () => stopRef.current(), []);

  const start = () => {
    setError(null);
    setListening(true);
    const { promise, stop } = listenOnce();
    stopRef.current = stop;
    promise
      .then((alts) => {
        setHeard(alts[0] ?? '');
        setAnswer(alts.join('\n'));
      })
      .catch((err: Error) => {
        setError(err.message === 'not-allowed' || err.message === 'service-not-allowed' ? t.micDenied : err.message === 'unsupported' ? t.micUnsupported : t.noSpeech);
      })
      .finally(() => setListening(false));
  };

  return (
    <div>
      <Title>{t.speak}</Title>
      <div className="flex items-center gap-3 mb-2">
        <AudioButtons text={en(ex.en)} t={t} />
        <p className="text-2xl font-black">{en(ex.en)}</p>
      </div>
      <p className="text-slate-500 dark:text-slate-400 mb-6">{ka(ex.ka)}</p>
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={start}
          disabled={locked || listening || !canRecognize()}
          className={`w-full max-w-sm inline-flex items-center justify-center gap-2 rounded-2xl border-2 px-5 py-4 font-black text-sky-600 dark:text-sky-300 border-sky-300 shadow-[0_4px_0_0_rgb(125,211,252)] disabled:opacity-60 ${
            listening ? 'animate-pulse bg-sky-50 dark:bg-sky-500/10' : 'hover:bg-sky-50 dark:hover:bg-sky-500/10'
          }`}
        >
          {listening ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
          {listening ? t.listening : t.tapToSpeak}
        </button>
        {heard && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.youSaid} „{heard}“
          </p>
        )}
        {error && <p className="text-sm text-amber-600 dark:text-amber-400 text-center max-w-sm">{error}</p>}
        {!locked && (
          <button type="button" onClick={onSkipSpeaking} className="text-sm font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wide">
            {t.cantSpeak}
          </button>
        )}
      </div>
    </div>
  );
}
