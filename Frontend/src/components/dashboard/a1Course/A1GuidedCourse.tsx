import { useEffect, useState } from 'react';
import { Lock, Check, Flame, Star, Pencil, Sparkles } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { A1_COURSE, ALL_LESSONS, CourseLesson } from './curriculum';
import { latinFirstName } from './answerCheck';
import LessonPlayer, { LessonResult } from './LessonPlayer';

// Step-by-step A1 course (shown when the learner picks A1). Progress is
// kept per user in localStorage: the course content is static, so there
// is nothing for the server to grade or store, and this keeps the feature
// frontend-only.

interface CourseProgress {
  completed: string[];
  xp: number;
  streak: number;
  lastDay: string | null;
  nameEn: string | null;
}

const EMPTY: CourseProgress = { completed: [], xp: 0, streak: 0, lastDay: null, nameEn: null };

function storageKey(userId: string | undefined) {
  return `cdc.a1course.v1.${userId ?? 'anon'}`;
}

function loadProgress(userId: string | undefined): CourseProgress {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function saveProgress(userId: string | undefined, p: CourseProgress) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(p));
  } catch {
    // Private mode / storage blocked — progress just won't persist.
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

const dict = {
  ka: {
    title: 'A1 — ვისწავლოთ ნაბიჯ-ნაბიჯ',
    subtitle: 'მოკლე გაკვეთილები: ახალი სიტყვა → ვარჯიში → შესწორება. კითხვა, წერა, მოსმენა და საუბარი ერთად.',
    yourName: 'შენი სახელი ინგლისურად:',
    namePlaceholder: 'მაგ. Giorgi',
    save: 'შენახვა',
    start: 'დაწყება',
    again: 'გამეორება',
    xp: 'XP',
    streak: (n: number) => `${n} დღე ზედიზედ`,
    lessonsDone: (d: number, total: number) => `${d}/${total} გაკვეთილი`,
    aiLessons: 'ან შექმენი AI გაკვეთილი თავისუფალ თემაზე →',
    unit: 'თავი',
  },
  en: {
    title: 'A1 — Learn step by step',
    subtitle: 'Short lessons: new word → practice → correction. Reading, writing, listening and speaking together.',
    yourName: 'Your name in English:',
    namePlaceholder: 'e.g. Giorgi',
    save: 'Save',
    start: 'Start',
    again: 'Practice again',
    xp: 'XP',
    streak: (n: number) => `${n}-day streak`,
    lessonsDone: (d: number, total: number) => `${d}/${total} lessons`,
    aiLessons: 'or generate an AI lesson on any topic →',
    unit: 'Unit',
  },
};

interface A1GuidedCourseProps {
  lang: 'ka' | 'en';
  onUseAiLessons: () => void;
}

export default function A1GuidedCourse({ lang, onUseAiLessons }: A1GuidedCourseProps) {
  const t = dict[lang];
  const { user } = useAuth();
  const [progress, setProgress] = useState<CourseProgress>(EMPTY);
  const [active, setActive] = useState<CourseLesson | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  useEffect(() => {
    setProgress(loadProgress(user?.id));
  }, [user?.id]);

  const nameKa = (user?.name ?? '').trim().split(/\s+/)[0] ?? '';
  const nameEn = progress.nameEn || latinFirstName(user?.legalFirstNameEn) || latinFirstName(user?.name) || 'Alex';
  // Georgian-script name in Georgian sentences when we have one; otherwise
  // the Latin one everywhere.
  const nameForKa = /[ა-ჿ]/.test(nameKa) ? nameKa : nameEn;

  const update = (p: CourseProgress) => {
    setProgress(p);
    saveProgress(user?.id, p);
  };

  const handleComplete = (r: LessonResult) => {
    const d = today();
    const streak = progress.lastDay === d ? progress.streak : progress.lastDay === yesterday() ? progress.streak + 1 : 1;
    update({
      ...progress,
      xp: progress.xp + r.xp,
      completed: progress.completed.includes(r.lessonId) ? progress.completed : [...progress.completed, r.lessonId],
      streak,
      lastDay: d,
    });
    setActive(null);
  };

  const saveName = () => {
    const clean = nameDraft.trim().split(/\s+/)[0] ?? '';
    if (/^[A-Za-z][A-Za-z'-]{0,30}$/.test(clean)) {
      update({ ...progress, nameEn: clean[0].toUpperCase() + clean.slice(1) });
    }
    setEditingName(false);
  };

  if (active) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
        <LessonPlayer lesson={active} lang={lang} nameEn={nameEn} nameKa={nameForKa} onExit={() => setActive(null)} onComplete={handleComplete} />
      </div>
    );
  }

  // The first not-yet-completed lesson is the one that's open; everything
  // before it can be replayed, everything after stays locked.
  const nextIndex = ALL_LESSONS.findIndex((l) => !progress.completed.includes(l.id));
  const currentId = nextIndex === -1 ? null : ALL_LESSONS[nextIndex].id;
  const isUnlocked = (id: string) => {
    const i = ALL_LESSONS.findIndex((l) => l.id === id);
    return nextIndex === -1 || i <= nextIndex;
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col gap-6" data-testid="a1-guided-course">
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-black flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-500" /> {t.title}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 px-3 py-1 font-bold">
            <Star className="w-4 h-4" /> {progress.xp} {t.xp}
          </span>
          {progress.streak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-300 px-3 py-1 font-bold">
              <Flame className="w-4 h-4" /> {t.streak(progress.streak)}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-3 py-1 font-bold">
            <Check className="w-4 h-4" /> {t.lessonsDone(progress.completed.length, ALL_LESSONS.length)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">{t.yourName}</span>
          {editingName ? (
            <>
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                placeholder={t.namePlaceholder}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 w-36"
              />
              <button type="button" onClick={saveName} className="font-bold text-sky-600 dark:text-sky-400">
                {t.save}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameDraft(nameEn);
                setEditingName(true);
              }}
              className="inline-flex items-center gap-1 font-black"
            >
              {nameEn} <Pencil className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {A1_COURSE.map((unit, ui) => (
        <div key={unit.id}>
          <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-3 mb-4 flex items-center gap-3">
            <span className="text-3xl">{unit.pic}</span>
            <div>
              <p className="text-xs font-bold opacity-80 uppercase tracking-wide">
                {t.unit} {ui + 1}
              </p>
              <p className="font-black">{lang === 'ka' ? unit.titleKa : unit.titleEn}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {unit.lessons.map((l, li) => {
              const done = progress.completed.includes(l.id);
              const unlocked = isUnlocked(l.id);
              const current = l.id === currentId;
              // Gentle zig-zag so the path reads as a path, not a list.
              const offset = ['sm:ml-0', 'sm:ml-16', 'sm:ml-8'][li % 3];
              return (
                <div key={l.id} className={`flex items-center gap-4 ${offset}`}>
                  <button
                    type="button"
                    disabled={!unlocked}
                    onClick={() => setActive(l)}
                    aria-label={lang === 'ka' ? l.titleKa : l.titleEn}
                    className={`shrink-0 w-16 h-16 rounded-full flex items-center justify-center text-3xl transition-transform ${
                      done
                        ? 'bg-amber-400 shadow-[0_5px_0_0_rgb(217,119,6)]'
                        : current
                          ? 'bg-emerald-500 shadow-[0_5px_0_0_rgb(4,120,87)] ring-4 ring-emerald-200 dark:ring-emerald-500/30 animate-[pulse_2.5s_ease-in-out_infinite]'
                          : 'bg-slate-200 dark:bg-slate-700 shadow-[0_5px_0_0_rgb(148,163,184)] dark:shadow-[0_5px_0_0_rgb(30,41,59)]'
                    } ${unlocked ? 'hover:scale-105 active:translate-y-1 active:shadow-none' : 'cursor-not-allowed'}`}
                  >
                    {unlocked ? l.pic : <Lock className="w-6 h-6 text-slate-400" />}
                  </button>
                  <div className="flex flex-col">
                    <span className={`font-bold ${unlocked ? '' : 'text-slate-400'}`}>{lang === 'ka' ? l.titleKa : l.titleEn}</span>
                    {unlocked && (
                      <button
                        type="button"
                        onClick={() => setActive(l)}
                        className={`self-start text-xs font-black uppercase tracking-wide ${done ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}
                      >
                        {done ? `${t.again} ✓` : `${t.start} →`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <button type="button" onClick={onUseAiLessons} className="self-start text-sm font-bold text-purple-600 dark:text-purple-400 hover:underline">
        {t.aiLessons}
      </button>
    </div>
  );
}
