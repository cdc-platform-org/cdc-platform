/**
 * AI Course Mentor — one planned lesson: date, kind, objectives, 3-hour flow,
 * practice ideas, homework. The teacher can open it and edit title, summary,
 * objectives and homework (saved via PATCH /lessons/:id).
 */
import { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { ChevronDown, Pencil, Loader2, Save, Briefcase, ClipboardList, Home, Clock } from 'lucide-react';
import { MentorLesson, MentorLessonKind, updateLesson, apiErrorMessage } from '../../../services/courseMentorService';
import { inputClass } from './CourseForm';

export const KIND_TONE: Record<MentorLessonKind, string> = {
  LEARN: 'bg-cdc-primary-soft text-cdc-primary-ink',
  PRACTICE: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300',
  REVIEW: 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300',
  PROJECT: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  ASSESSMENT: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
};

interface Props {
  courseId: string;
  lesson: MentorLesson;
  dateLabel: string;
  onSaved: (lesson: MentorLesson) => void;
}

export default function LessonCard({ courseId, lesson, dateLabel, onSaved }: Props) {
  const { t } = useTranslation('courseMentor');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: lesson.title,
    summary: lesson.plan.summary,
    objectives: lesson.objectives.join('\n'),
    homework: lesson.plan.homework.description,
    deliverable: lesson.plan.homework.deliverable,
  });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const objectives = draft.objectives.split('\n').map((s) => s.trim()).filter(Boolean);
      const saved = await updateLesson(courseId, lesson.id, {
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        objectives,
        homework: { description: draft.homework.trim(), deliverable: draft.deliverable.trim() },
      });
      onSaved(saved);
      setEditing(false);
    } catch (err) {
      setError(apiErrorMessage(err, t('errors.generic')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-xl border border-cdc-border bg-cdc-bg">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="w-full flex items-center gap-3 p-3 text-left bg-transparent border-none cursor-pointer">
        <span className="w-10 shrink-0 text-center text-sm font-extrabold text-cdc-muted">{lesson.position}</span>
        <span className="w-24 shrink-0 text-xs text-cdc-muted">{dateLabel}</span>
        <span className={`hidden sm:inline-block shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${KIND_TONE[lesson.kind]}`}>{t(`kind.${lesson.kind}`)}</span>
        <span className="flex-1 min-w-0 text-sm font-semibold text-cdc-ink truncate">{lesson.title}</span>
        {lesson.teacherEdited && <Pencil className="w-3.5 h-3.5 text-cdc-muted shrink-0" aria-label={t('lesson.edited')} />}
        <ChevronDown className={`w-4 h-4 text-cdc-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 text-sm text-cdc-ink">
          {editing ? (
            <div className="space-y-3">
              <input className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label={t('lesson.title')} />
              <textarea className={inputClass} rows={3} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} aria-label={t('lesson.summary')} />
              <label className="block text-xs font-bold text-cdc-muted">{t('lesson.objectivesOnePerLine')}</label>
              <textarea className={inputClass} rows={4} value={draft.objectives} onChange={(e) => setDraft({ ...draft, objectives: e.target.value })} />
              <label className="block text-xs font-bold text-cdc-muted">{t('lesson.homework')}</label>
              <textarea className={inputClass} rows={3} value={draft.homework} onChange={(e) => setDraft({ ...draft, homework: e.target.value })} />
              <input className={inputClass} value={draft.deliverable} onChange={(e) => setDraft({ ...draft, deliverable: e.target.value })} aria-label={t('lesson.deliverable')} />
              {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={save} disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-cdc-primary px-4 py-2 text-sm font-bold text-white border-none cursor-pointer disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Save className="w-4 h-4" aria-hidden />}{t('actions.save')}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-xl px-4 py-2 text-sm font-bold text-cdc-muted bg-transparent border border-cdc-border cursor-pointer">
                  {t('actions.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-cdc-muted leading-relaxed">{lesson.plan.summary}</p>
              <div>
                <h4 className="font-bold mb-1">{t('lesson.objectives')}</h4>
                <ul className="list-disc pl-5 space-y-0.5">{lesson.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
              </div>
              <div>
                <h4 className="font-bold mb-1 inline-flex items-center gap-1.5"><Clock className="w-4 h-4" aria-hidden />{t('lesson.flow')}</h4>
                <ol className="space-y-0.5">
                  {lesson.plan.flow.map((f, i) => (
                    <li key={i} className="flex gap-2"><span className="w-14 shrink-0 text-cdc-muted">{t('lesson.minutes', { count: f.minutes })}</span><span>{f.step}</span></li>
                  ))}
                </ol>
              </div>
              <div>
                <h4 className="font-bold mb-1 inline-flex items-center gap-1.5"><ClipboardList className="w-4 h-4" aria-hidden />{t('lesson.practice')}</h4>
                <ul className="space-y-1">
                  {lesson.plan.practiceIdeas.map((p, i) => (
                    <li key={i}><span className="font-semibold">{t(`practiceType.${p.type}`, p.type)}</span> · <span className="text-cdc-muted">{t(`difficulty.${p.difficulty}`)}</span> — {p.description}</li>
                  ))}
                </ul>
              </div>
              <p className="inline-flex items-start gap-1.5"><Briefcase className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /><span><span className="font-bold">{t('lesson.realWorld')}:</span> {lesson.plan.realWorldExample}</span></p>
              <p className="inline-flex items-start gap-1.5"><Home className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /><span><span className="font-bold">{t('lesson.homework')}:</span> {lesson.plan.homework.description} <span className="text-cdc-muted">({lesson.plan.homework.deliverable})</span></span></p>
              {lesson.plan.sourceHeadings.length > 0 && (
                <p className="text-xs text-cdc-muted">{t('lesson.sources')}: {lesson.plan.sourceHeadings.join(' · ')}</p>
              )}
              <button type="button" onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-cdc-primary bg-transparent border border-cdc-border cursor-pointer">
                <Pencil className="w-3.5 h-3.5" aria-hidden />{t('actions.edit')}
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}
