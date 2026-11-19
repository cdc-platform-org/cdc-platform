/**
 * AI Course Mentor — the course brief + calendar form (create and edit).
 * Used by pages/dashboard/tools/course-mentor/index.tsx (new course) and
 * [id].tsx (settings). API calls stay in the pages.
 */
import { FormEvent, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { Loader2, Save, CalendarDays } from 'lucide-react';
import { TASK_TYPE_KEYS, type CourseInput } from '../../../services/courseMentorService';

export const SITE_LOCALES = ['ka', 'en', 'de', 'es', 'fr', 'tr', 'uk', 'az', 'hy'] as const;
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

export const inputClass =
  'w-full rounded-xl border border-cdc-border bg-cdc-surface px-3.5 py-2.5 text-sm text-cdc-ink focus:outline-none focus:ring-2 focus:ring-cdc-primary/40';
const labelClass = 'block text-sm font-bold text-cdc-ink mb-1.5';

export function emptyCourseInput(locale: string): CourseInput {
  return {
    title: '',
    audience: '',
    goals: '',
    instructions: '',
    teachingLocale: (SITE_LOCALES as readonly string[]).includes(locale) ? locale : 'ka',
    startDate: '',
    endDate: '',
    weekdays: [1, 2, 3, 4, 5],
    minutesPerLesson: 180,
    excludedDates: [],
    taskTypes: [],
  };
}

interface Props {
  initial: CourseInput;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (input: CourseInput) => void;
}

export default function CourseForm({ initial, submitLabel, busy, error, onSubmit }: Props) {
  const { t } = useTranslation('courseMentor');
  const [form, setForm] = useState<CourseInput>(initial);
  const [excludedText, setExcludedText] = useState(initial.excludedDates.join('\n'));

  const set = <K extends keyof CourseInput>(key: K, value: CourseInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggleType = (k: string) =>
    set('taskTypes', form.taskTypes.includes(k) ? form.taskTypes.filter((x) => x !== k) : [...form.taskTypes, k]);
  const toggleDay = (d: number) =>
    set('weekdays', form.weekdays.includes(d) ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d].sort());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const excludedDates = excludedText
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
    onSubmit({ ...form, instructions: form.instructions?.trim() || null, excludedDates });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className={labelClass} htmlFor="cm-title">{t('form.title')}</label>
        <input id="cm-title" required minLength={3} maxLength={200} className={inputClass} value={form.title}
          placeholder={t('form.titlePlaceholder')} onChange={(e) => set('title', e.target.value)} />
      </div>
      <div>
        <label className={labelClass} htmlFor="cm-audience">{t('form.audience')}</label>
        <textarea id="cm-audience" required minLength={3} rows={2} className={inputClass} value={form.audience}
          placeholder={t('form.audiencePlaceholder')} onChange={(e) => set('audience', e.target.value)} />
      </div>
      <div>
        <label className={labelClass} htmlFor="cm-goals">{t('form.goals')}</label>
        <textarea id="cm-goals" required minLength={3} rows={3} className={inputClass} value={form.goals}
          placeholder={t('form.goalsPlaceholder')} onChange={(e) => set('goals', e.target.value)} />
      </div>
      <div>
        <label className={labelClass} htmlFor="cm-instructions">{t('form.instructions')}</label>
        <textarea id="cm-instructions" rows={3} className={inputClass} value={form.instructions ?? ''}
          placeholder={t('form.instructionsPlaceholder')} onChange={(e) => set('instructions', e.target.value)} />
      </div>

      <div>
        <span className={labelClass}>{t('form.taskTypes')}</span>
        <p className="text-xs text-cdc-muted mb-2">{t('form.taskTypesHint')}</p>
        <div className="flex flex-wrap gap-2">
          {TASK_TYPE_KEYS.map((k) => {
            const on = form.taskTypes.includes(k);
            return (
              <button key={k} type="button" aria-pressed={on} onClick={() => toggleType(k)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${on ? 'bg-cdc-primary text-white border-cdc-primary' : 'bg-cdc-bg text-cdc-muted border-cdc-border'}`}>
                {t(`practiceType.${k}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-cdc-border bg-cdc-surface p-4 md:p-5 space-y-4">
        <div className="flex items-center gap-2 font-bold text-cdc-ink">
          <CalendarDays className="w-5 h-5 text-cdc-primary" aria-hidden /> {t('form.calendar')}
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass} htmlFor="cm-start">{t('form.startDate')}</label>
            <input id="cm-start" type="date" required className={inputClass} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="cm-end">{t('form.endDate')}</label>
            <input id="cm-end" type="date" required className={inputClass} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="cm-minutes">{t('form.minutesPerLesson')}</label>
            <input id="cm-minutes" type="number" min={15} max={480} step={5} required className={inputClass}
              value={form.minutesPerLesson} onChange={(e) => set('minutesPerLesson', Number(e.target.value))} />
          </div>
        </div>
        <div>
          <span className={labelClass}>{t('form.weekdays')}</span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const on = form.weekdays.includes(d);
              return (
                <button key={d} type="button" aria-pressed={on} onClick={() => toggleDay(d)}
                  className={`px-3 py-2 rounded-xl text-sm font-bold border cursor-pointer ${on ? 'bg-cdc-primary text-white border-cdc-primary' : 'bg-cdc-bg text-cdc-muted border-cdc-border'}`}>
                  {t(`weekday.${d}`)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="cm-excluded">{t('form.excludedDates')}</label>
            <textarea id="cm-excluded" rows={3} className={`${inputClass} font-mono`} value={excludedText}
              placeholder="2026-12-31&#10;2027-01-01" onChange={(e) => setExcludedText(e.target.value)} />
            <p className="text-xs text-cdc-muted mt-1">{t('form.excludedHint')}</p>
          </div>
          <div>
            <label className={labelClass} htmlFor="cm-locale">{t('form.teachingLocale')}</label>
            <select id="cm-locale" className={inputClass} value={form.teachingLocale} onChange={(e) => set('teachingLocale', e.target.value)}>
              {SITE_LOCALES.map((l) => <option key={l} value={l}>{t(`locale.${l}`)}</option>)}
            </select>
            <p className="text-xs text-cdc-muted mt-1">{t('form.teachingLocaleHint')}</p>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      <button type="submit" disabled={busy || form.weekdays.length === 0}
        className="inline-flex items-center gap-2 rounded-xl bg-cdc-primary px-5 py-3 text-sm font-bold text-white border-none cursor-pointer disabled:opacity-60">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Save className="w-4 h-4" aria-hidden />}
        {submitLabel}
      </button>
    </form>
  );
}
