/**
 * AI Course Mentor — the generated course plan: agent's summary and notes for
 * the teacher, then modules (collapsible) with their dated lessons.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { Layers, ChevronDown, Info } from 'lucide-react';
import { MentorCourseDetail, MentorLesson } from '../../../services/courseMentorService';
import LessonCard from './LessonCard';

interface Props {
  course: MentorCourseDetail;
  locale: string;
  onLessonSaved: (lesson: MentorLesson) => void;
}

export default function PlanView({ course, locale, onLessonSaved }: Props) {
  const { t } = useTranslation('courseMentor');
  const [openModule, setOpenModule] = useState<string | null>(course.modules[0]?.id ?? null);

  const byModule = useMemo(() => {
    const map = new Map<string, MentorLesson[]>();
    for (const l of course.lessons) map.set(l.moduleId, [...(map.get(l.moduleId) ?? []), l]);
    return map;
  }, [course.lessons]);

  const fmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', weekday: 'short', timeZone: 'UTC' }), [locale]);
  const dateLabel = (iso: string) => fmt.format(new Date(`${iso}T00:00:00Z`));

  return (
    <section className="space-y-4">
      {course.planSummary && (
        <div className="rounded-2xl border border-cdc-border bg-cdc-surface p-4 md:p-6 space-y-3">
          <h2 className="text-lg font-extrabold text-cdc-ink">{t('plan.summaryTitle')}</h2>
          <p className="text-sm text-cdc-ink leading-relaxed">{course.planSummary.courseSummary}</p>
          {course.planSummary.notesForTeacher.length > 0 && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3">
              <p className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-800 dark:text-amber-300 mb-1"><Info className="w-4 h-4" aria-hidden />{t('plan.notesTitle')}</p>
              <ul className="list-disc pl-5 text-sm text-amber-900 dark:text-amber-200 space-y-1">
                {course.planSummary.notesForTeacher.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {course.modules.map((m) => {
        const lessons = byModule.get(m.id) ?? [];
        const open = openModule === m.id;
        return (
          <div key={m.id} className="rounded-2xl border border-cdc-border bg-cdc-surface">
            <button type="button" onClick={() => setOpenModule(open ? null : m.id)} aria-expanded={open}
              className="w-full flex items-center gap-3 p-4 md:p-5 text-left bg-transparent border-none cursor-pointer">
              <Layers className="w-5 h-5 text-cdc-primary shrink-0" aria-hidden />
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-cdc-ink">{t('plan.module', { n: m.position })}: {m.title}</p>
                <p className="text-xs text-cdc-muted">
                  {t('plan.lessonsCount', { count: lessons.length })}
                  {lessons.length > 0 && ` · ${dateLabel(lessons[0].date)} – ${dateLabel(lessons[lessons.length - 1].date)}`}
                </p>
              </div>
              <ChevronDown className={`w-5 h-5 text-cdc-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {open && (
              <div className="px-4 md:px-5 pb-5 space-y-3">
                <p className="text-sm text-cdc-muted leading-relaxed">{m.summary}</p>
                <ul className="space-y-2">
                  {lessons.map((l) => (
                    <LessonCard key={l.id} courseId={course.id} lesson={l} dateLabel={dateLabel(l.date)} onSaved={onLessonSaved} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
