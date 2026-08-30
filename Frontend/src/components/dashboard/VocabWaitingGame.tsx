import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Flame, Trophy, Sparkles } from 'lucide-react';

// "Vocab Rush" — a Google-Dino-style waiting mini-game shown while IMIAKO
// generates a lesson (a real Gemini call, a few seconds of genuine dead
// time otherwise spent staring at a spinner). Deliberately English-word ↔
// English-synonym, not a translation quiz: TutorLesson.nativeLang is
// free-text (any language a student types, see its own schema comment),
// so there's no reliable per-nativeLang translation data to draw from —
// synonym-matching tests real English vocabulary without that dependency,
// which also fits this tool's actual purpose better than a translation
// drill would.
interface VocabWaitingGameProps {
  lang: 'ka' | 'en';
  // True while the real lesson-generation request is in flight — the game
  // keeps running. Once this flips false the game freezes on its current
  // question and shows the "ready" banner instead of vanishing mid-round.
  loading: boolean;
  onContinue: () => void;
}

const WORD_BANK: { word: string; synonym: string }[] = [
  { word: 'Happy', synonym: 'Glad' },
  { word: 'Big', synonym: 'Large' },
  { word: 'Fast', synonym: 'Quick' },
  { word: 'Angry', synonym: 'Furious' },
  { word: 'Smart', synonym: 'Intelligent' },
  { word: 'Beautiful', synonym: 'Gorgeous' },
  { word: 'Difficult', synonym: 'Hard' },
  { word: 'Begin', synonym: 'Start' },
  { word: 'End', synonym: 'Finish' },
  { word: 'Buy', synonym: 'Purchase' },
  { word: 'Small', synonym: 'Tiny' },
  { word: 'Strong', synonym: 'Powerful' },
  { word: 'Weak', synonym: 'Feeble' },
  { word: 'Rich', synonym: 'Wealthy' },
  { word: 'Old', synonym: 'Ancient' },
  { word: 'Brave', synonym: 'Courageous' },
  { word: 'Quiet', synonym: 'Silent' },
  { word: 'Funny', synonym: 'Hilarious' },
  { word: 'Sad', synonym: 'Unhappy' },
  { word: 'Tired', synonym: 'Exhausted' },
  { word: 'Important', synonym: 'Significant' },
  { word: 'Easy', synonym: 'Simple' },
  { word: 'Bright', synonym: 'Luminous' },
  { word: 'Calm', synonym: 'Peaceful' },
  { word: 'Honest', synonym: 'Truthful' },
];

const ROUND_MS = 5000;

const dict = {
  ka: {
    heading: '⚡ IMIAKO ამზადებს თქვენს პერსონალურ გაკვეთილებს…',
    subheading: 'დროის მოსაკლავად, ითამაშეთ Vocab Rush!',
    prompt: 'რომელი სიტყვაა სინონიმი?',
    streak: (n: number) => `🔥 ${n} სწორი პასუხი ზედიზედ!`,
    score: 'ქულა',
    ready: '🎉 თქვენი გაკვეთილი მზადაა!',
    readyBody: (score: number) => `თქვენი Vocab Rush ქულა: ${score}`,
    continueCta: 'გადადი გაკვეთილზე →',
  },
  en: {
    heading: '⚡ IMIAKO is preparing your personal lesson…',
    subheading: 'While you wait, play Vocab Rush!',
    prompt: 'Which word means the same?',
    streak: (n: number) => `🔥 ${n} correct in a row!`,
    score: 'Score',
    ready: '🎉 Your lesson is ready!',
    readyBody: (score: number) => `Your Vocab Rush score: ${score}`,
    continueCta: 'Go to lesson →',
  },
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRound(excludeWord?: string) {
  const pool = WORD_BANK.filter((w) => w.word !== excludeWord);
  const correct = pool[Math.floor(Math.random() * pool.length)];
  const distractorPool = shuffle(WORD_BANK.filter((w) => w.word !== correct.word)).slice(0, 3);
  const options = shuffle([correct.synonym, ...distractorPool.map((d) => d.synonym)]);
  return { word: correct.word, correctAnswer: correct.synonym, options };
}

export default function VocabWaitingGame({ lang, loading, onContinue }: VocabWaitingGameProps) {
  const t = dict[lang];
  const [round, setRound] = useState(() => pickRound());
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nextRound = () => {
    setRound((prev) => pickRound(prev.word));
    setSelected(null);
    setFeedback(null);
  };

  const handleAnswer = (option: string) => {
    if (selected || !loading) return;
    setSelected(option);
    const isCorrect = option === round.correctAnswer;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) {
      setScore((s) => s + 10);
      setStreak((s) => s + 1);
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        confetti({
          particleCount: 24,
          spread: 55,
          startVelocity: 28,
          origin: { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + 20) / window.innerHeight },
        });
      }
    } else {
      setStreak(0);
    }
    advanceTimerRef.current = setTimeout(nextRound, 900);
  };

  // Per-round timer bar — "Google Dino style" fast pace: run out of time
  // and it's scored as a miss, same as a wrong tap.
  const [timerKey, setTimerKey] = useState(0);
  useEffect(() => {
    if (!loading || selected) return;
    const timeout = setTimeout(() => {
      if (!selected) handleAnswer('__timeout__');
    }, ROUND_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, loading, selected]);

  useEffect(() => {
    setTimerKey((k) => k + 1);
  }, [round]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const showReadyBanner = !loading;

  return (
    <div ref={containerRef} className="rounded-2xl border border-purple-200 dark:border-purple-500/30 bg-gradient-to-br from-amber-50 via-purple-50 to-cyan-50 dark:from-slate-900 dark:via-purple-950/30 dark:to-slate-900 p-6 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-purple-500 shrink-0 animate-pulse" />
        <p className="text-sm font-black text-purple-700 dark:text-purple-300">{t.heading}</p>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.subheading}</p>

      <div className="flex items-center gap-4 mb-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-600 dark:text-amber-400">
          <Trophy className="w-3.5 h-3.5" />
          {t.score}: {score}
        </span>
        {streak >= 2 && (
          <span className="inline-flex items-center gap-1 text-xs font-black text-rose-600 dark:text-rose-400">
            <Flame className="w-3.5 h-3.5" />
            {t.streak(streak)}
          </span>
        )}
      </div>

      {!showReadyBanner ? (
        <div className="rounded-xl bg-white/80 dark:bg-slate-900/60 p-4">
          <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-3">
            <div key={timerKey} className="h-full bg-gradient-to-r from-amber-400 to-rose-500 rounded-full vocab-rush-timer" />
          </div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{t.prompt}</p>
          <p className="text-2xl font-black tracking-wide mb-4">{round.word}</p>
          <div className="grid grid-cols-2 gap-2">
            {round.options.map((opt) => {
              const isSelected = selected === opt;
              const isCorrectOpt = opt === round.correctAnswer;
              const showState = !!selected;
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={!!selected}
                  onClick={() => handleAnswer(opt)}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-bold transition-colors disabled:cursor-default ${
                    showState && isCorrectOpt
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : showState && isSelected
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'
                        : 'border-slate-200 dark:border-slate-700 hover:border-purple-400'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {feedback && (
            <p className={`text-xs font-bold mt-3 ${feedback === 'correct' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {feedback === 'correct' ? '✅' : `❌ ${round.correctAnswer}`}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-white/90 dark:bg-slate-900/70 p-6 text-center flex flex-col items-center gap-2">
          <p className="text-lg font-black">{t.ready}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.readyBody(score)}</p>
          <button
            type="button"
            onClick={onContinue}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 text-white font-bold px-6 py-2.5 text-sm"
          >
            {t.continueCta}
          </button>
        </div>
      )}

      <style jsx>{`
        .vocab-rush-timer {
          animation: vocab-rush-shrink ${ROUND_MS}ms linear forwards;
        }
        @keyframes vocab-rush-shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}
