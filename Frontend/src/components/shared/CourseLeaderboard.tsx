import { useState, useEffect, useCallback } from 'react';
import { Users, Trophy } from 'lucide-react';
import { CourseLeaderboard as CourseLeaderboardData } from '../../types/lms';
import { getCourseLeaderboard } from '../../services/courseService';
import { onImageErrorFallback } from '../../utils/imageFallback';

const dict = {
  ka: {
    students: (n: number) => `👥 ${n} სტუდენტი`,
    title: '🏆 კურსის ლიდერბორდი',
    subtitle: 'ტოპ სტუდენტები დასრულებული გაკვეთილებისა და დავალებების მიხედვით.',
    completed: 'დასრულებული',
    xp: 'XP',
    empty: 'ჯერ არავის დაუწყია პროგრესის მიღწევა — იყავი პირველი!',
  },
  en: {
    students: (n: number) => `👥 ${n} student${n === 1 ? '' : 's'}`,
    title: '🏆 Course Leaderboard',
    subtitle: 'Top students by completed lessons and graded assignments.',
    completed: 'Completed',
    xp: 'XP',
    empty: 'No one has made progress yet — be the first!',
  },
};

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function CourseLeaderboard({ courseId, lang }: { courseId: string; lang: 'ka' | 'en' }) {
  const t = dict[lang];
  const [data, setData] = useState<CourseLeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getCourseLeaderboard(courseId));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) return null;

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-xl font-black flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          {t.title}
        </h2>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
          <Users className="w-3.5 h-3.5" />
          {t.students(data.enrolledCount)}
        </span>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{t.subtitle}</p>

      {data.topStudents.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.empty}</p>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
          {data.topStudents.map((s) => (
            <div key={s.userId} className="flex items-center gap-3 px-4 py-3">
              <span className="w-7 text-center text-sm font-black text-slate-400 dark:text-slate-500 shrink-0">
                {RANK_MEDAL[s.rank] ?? s.rank}
              </span>
              {s.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.avatarUrl}
                  alt={s.name}
                  onError={onImageErrorFallback}
                  className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                  {s.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{s.name}</p>
                <p className="text-[11px] text-slate-400">
                  {t.completed}: {s.completionPercent}%
                </p>
              </div>
              <span className="text-xs font-black text-amber-600 dark:text-amber-400 shrink-0">{s.xp} {t.xp}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
