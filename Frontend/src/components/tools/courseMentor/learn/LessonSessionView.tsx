/**
 * Personal Mentor (student) — one lesson: the mentor chat (left), practice
 * tasks / homework (right on desktop, below on phones), and the "finish
 * lesson" step that shows the mentor's evaluation.
 */
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import ReactMarkdown from 'react-markdown';
import { Bot, Send, Loader2, ListChecks, Home, Flag, Award } from 'lucide-react';
import {
  LessonSession, MentorTask, sendMentorMessage, requestTasks, finishLesson, apiErrorMessage,
} from '../../../../services/courseMentorService';
import TaskCard from './TaskCard';
import { inputClass } from '../CourseForm';

export default function LessonSessionView({ initial }: { initial: LessonSession }) {
  const { t } = useTranslation('courseMentor');
  const [session, setSession] = useState(initial);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'chat' | 'tasks' | 'homework' | 'finish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const done = session.status === 'COMPLETED';

  useEffect(() => setSession(initial), [initial]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), [session.messages.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const message = text.trim();
    if (!message) return;
    setBusy('chat');
    setError(null);
    const now = new Date().toISOString();
    setSession((s) => ({ ...s, messages: [...s.messages, { id: `tmp-${now}`, role: 'student', content: message, createdAt: now }] }));
    setText('');
    try {
      const { reply } = await sendMentorMessage(session.id, message);
      setSession((s) => ({ ...s, messages: [...s.messages, { id: `m-${Date.now()}`, role: 'mentor', content: reply, createdAt: new Date().toISOString() }] }));
    } catch (err) {
      setError(apiErrorMessage(err, t('errors.generic')));
      setSession((s) => ({ ...s, messages: s.messages.filter((m) => m.createdAt !== now) }));
      setText(message);
    } finally {
      setBusy(null);
    }
  };

  const getTasks = async (homework: boolean) => {
    setBusy(homework ? 'homework' : 'tasks');
    setError(null);
    try {
      const tasks = await requestTasks(session.id, homework);
      setSession((s) => ({ ...s, tasks: [...s.tasks, ...tasks] }));
    } catch (err) {
      setError(apiErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(null);
    }
  };

  const finish = async () => {
    if (!window.confirm(t('learn.confirmFinish'))) return;
    setBusy('finish');
    setError(null);
    try {
      setSession(await finishLesson(session.id));
    } catch (err) {
      setError(apiErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(null);
    }
  };

  const onTaskUpdated = (task: MentorTask) => setSession((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === task.id ? task : x)) }));
  const hasHomework = session.tasks.some((x) => x.isHomework);
  const classTasks = session.tasks.filter((x) => !x.isHomework);
  const homework = session.tasks.filter((x) => x.isHomework);

  return (
    <div className="grid lg:grid-cols-[1fr_420px] gap-6">
      {/* Chat */}
      <section className="rounded-2xl border border-cdc-border bg-cdc-surface flex flex-col min-h-[60vh] max-h-[80vh]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite">
          {session.messages.map((m) => (
            <div key={m.id} className={m.role === 'student' ? 'flex justify-end' : 'flex gap-2'}>
              {m.role === 'mentor' && <Bot className="w-6 h-6 shrink-0 text-cdc-primary mt-1" aria-hidden />}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.role === 'student' ? 'bg-cdc-primary text-white' : 'bg-cdc-bg text-cdc-ink border border-cdc-border'}`}>
                {m.role === 'mentor' ? <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{m.content}</ReactMarkdown></div> : <p className="whitespace-pre-wrap">{m.content}</p>}
              </div>
            </div>
          ))}
          {busy === 'chat' && <p className="inline-flex items-center gap-2 text-sm text-cdc-muted"><Loader2 className="w-4 h-4 animate-spin" aria-hidden />{t('learn.mentorTyping')}</p>}
          <div ref={endRef} />
        </div>
        {!done && (
          <form onSubmit={send} className="border-t border-cdc-border p-3 flex gap-2">
            <textarea className={`${inputClass} resize-none`} rows={2} value={text} placeholder={t('learn.chatPlaceholder')} aria-label={t('learn.chatPlaceholder')}
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }} />
            <button type="submit" disabled={!!busy || !text.trim()} aria-label={t('learn.send')}
              className="shrink-0 rounded-xl bg-cdc-primary px-4 text-white border-none cursor-pointer disabled:opacity-60">
              <Send className="w-4 h-4" aria-hidden />
            </button>
          </form>
        )}
      </section>

      {/* Tasks + finish */}
      <section className="space-y-4">
        {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
        {done && session.evaluation && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4 text-sm text-emerald-950 dark:text-emerald-100 space-y-2">
            <p className="inline-flex items-center gap-2 font-extrabold"><Award className="w-5 h-5" aria-hidden />{t('learn.lessonDone')}{session.score !== null && ` · ${Math.round(session.score)}/100`}</p>
            <p>{session.evaluation.summary}</p>
            {session.evaluation.strengths.length > 0 && <p><span className="font-bold">{t('learn.strengths')}:</span> {session.evaluation.strengths.join('; ')}</p>}
            {session.evaluation.struggles.length > 0 && <p><span className="font-bold">{t('learn.struggles')}:</span> {session.evaluation.struggles.join('; ')}</p>}
            {session.evaluation.nextSteps.length > 0 && <p><span className="font-bold">{t('learn.nextSteps')}:</span> {session.evaluation.nextSteps.join('; ')}</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!done && (
            <button type="button" onClick={() => getTasks(false)} disabled={!!busy}
              className="inline-flex items-center gap-2 rounded-xl bg-cdc-primary px-4 py-2.5 text-sm font-bold text-white border-none cursor-pointer disabled:opacity-60">
              {busy === 'tasks' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <ListChecks className="w-4 h-4" aria-hidden />}{t('learn.getTasks')}
            </button>
          )}
          {!hasHomework && (
            <button type="button" onClick={() => getTasks(true)} disabled={!!busy}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-cdc-ink bg-cdc-surface border border-cdc-border cursor-pointer disabled:opacity-60">
              {busy === 'homework' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Home className="w-4 h-4" aria-hidden />}{t('learn.getHomework')}
            </button>
          )}
          {!done && (
            <button type="button" onClick={finish} disabled={!!busy}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-300 bg-transparent border border-emerald-300 cursor-pointer disabled:opacity-60">
              {busy === 'finish' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Flag className="w-4 h-4" aria-hidden />}{t('learn.finish')}
            </button>
          )}
        </div>

        {classTasks.length > 0 && <ul className="space-y-3">{classTasks.map((task) => <TaskCard key={task.id} task={task} disabled={done} onUpdated={onTaskUpdated} />)}</ul>}
        {homework.length > 0 && (
          <>
            <h3 className="font-extrabold text-cdc-ink pt-2">{t('learn.homework')}</h3>
            <ul className="space-y-3">{homework.map((task) => <TaskCard key={task.id} task={task} disabled={false} onUpdated={onTaskUpdated} />)}</ul>
          </>
        )}
      </section>
    </div>
  );
}
