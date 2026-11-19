/**
 * Personal Mentor (student) — one practice task / test / homework item:
 * shows the instructions, takes the answer (option, text, code or a file),
 * submits it and shows the score + feedback from the mentor.
 */
import { useState } from 'react';
import { useTranslation } from 'next-i18next';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, XCircle, Loader2, Send, Paperclip, Home } from 'lucide-react';
import { MentorTask, submitMentorTask, apiErrorMessage } from '../../../../services/courseMentorService';
import { inputClass } from '../CourseForm';

const FILE_TYPES = new Set(['DESIGN', 'PROJECT', 'PRACTICAL']);
const CODE_TYPES = new Set(['CODING', 'DEBUGGING']);

export default function TaskCard({ task, disabled, onUpdated }: { task: MentorTask; disabled: boolean; onUpdated: (t: MentorTask) => void }) {
  const { t } = useTranslation('courseMentor');
  const [answer, setAnswer] = useState(task.answer ?? task.content.starterCode ?? '');
  const [choice, setChoice] = useState<number | null>(task.answer !== null && task.type === 'QUIZ' ? Number(task.answer) : null);
  const [file, setFile] = useState<File | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const graded = task.gradedAt !== null;
  const locked = disabled || (graded && task.type === 'QUIZ');

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      onUpdated(await submitMentorTask(task.id, task.type === 'QUIZ' ? String(choice) : answer, file));
    } catch (err) {
      setError(apiErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = task.type === 'QUIZ' ? choice !== null : answer.trim().length > 0 || !!file;

  return (
    <li className="rounded-xl border border-cdc-border bg-cdc-bg p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {task.isHomework && <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300"><Home className="w-3 h-3" aria-hidden />{t('learn.homework')}</span>}
        <span className="rounded-md bg-cdc-primary-soft px-2 py-0.5 text-[11px] font-bold text-cdc-primary-ink">{t(`practiceType.${task.type}`)}</span>
        <span className="text-[11px] text-cdc-muted">{t(`difficulty.${task.difficulty}`)}</span>
        {graded && task.score !== null && (
          <span className={`ml-auto inline-flex items-center gap-1 text-sm font-extrabold ${task.score >= 60 ? 'text-emerald-600' : 'text-red-600'}`}>
            {task.score >= 60 ? <CheckCircle2 className="w-4 h-4" aria-hidden /> : <XCircle className="w-4 h-4" aria-hidden />}
            {Math.round(task.score)}/100
          </span>
        )}
      </div>
      <h4 className="font-bold text-cdc-ink">{task.content.title}</h4>
      <div className="prose prose-sm max-w-none text-cdc-ink dark:prose-invert"><ReactMarkdown>{task.content.instructions}</ReactMarkdown></div>

      {task.type === 'QUIZ' && task.content.options ? (
        <div className="grid gap-2" role="radiogroup">
          {task.content.options.map((o, i) => (
            <label key={i} className={`flex items-start gap-2 rounded-lg border p-2.5 text-sm cursor-pointer ${choice === i ? 'border-cdc-primary bg-cdc-primary-soft' : 'border-cdc-border bg-cdc-surface'}`}>
              <input type="radio" name={`q-${task.id}`} checked={choice === i} disabled={locked} onChange={() => setChoice(i)} className="mt-0.5" />
              <span>{o}</span>
            </label>
          ))}
        </div>
      ) : (
        <textarea className={`${inputClass} ${CODE_TYPES.has(task.type) ? 'font-mono text-xs' : ''}`} rows={CODE_TYPES.has(task.type) ? 10 : 5}
          value={answer} disabled={disabled} onChange={(e) => setAnswer(e.target.value)} placeholder={t('learn.answerPlaceholder')} aria-label={t('learn.answerPlaceholder')} spellCheck={!CODE_TYPES.has(task.type)} />
      )}

      {FILE_TYPES.has(task.type) && !disabled && (
        <label className="inline-flex items-center gap-2 text-sm text-cdc-muted cursor-pointer">
          <Paperclip className="w-4 h-4" aria-hidden />
          <span>{file ? file.name : t('learn.attachFile')}</span>
          <input type="file" accept="image/*,.pdf,.zip,.txt" className="hidden" onChange={(e) => setFile(e.target.files?.[0])} />
        </label>
      )}

      {task.feedback && (
        <div className="rounded-lg bg-cdc-surface border border-cdc-border p-3 text-sm text-cdc-ink">
          <p className="font-bold mb-1">{t('learn.feedback')}</p>
          <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{task.feedback}</ReactMarkdown></div>
        </div>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      {!locked && (
        <button type="button" onClick={submit} disabled={busy || !canSubmit}
          className="inline-flex items-center gap-2 rounded-xl bg-cdc-primary px-4 py-2 text-sm font-bold text-white border-none cursor-pointer disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
          {graded ? t('learn.resubmit') : t('learn.submit')}
        </button>
      )}
    </li>
  );
}
