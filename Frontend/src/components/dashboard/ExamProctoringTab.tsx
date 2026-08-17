import { useState, useEffect, useCallback, FormEvent } from 'react';
import { ClipboardList, Plus, Trash2, Copy, Check, Lock, Unlock, Users } from 'lucide-react';
import {
  getMyExamSessions,
  createExamSession,
  getExamSession,
  updateExamSessionStatus,
  deleteExamSession,
  ExamSessionSummary,
  ExamSessionDetail,
} from '../../services/examProctoringService';

const dict = {
  ka: {
    title: 'AI გამოცდის პროქტორინგი',
    subtitle: 'შექმენით AI-გენერირებული სკრინინგ-გამოცდები კანდიდატებისთვის — უნიკალური ბმულით.',
    newExam: '+ ახალი გამოცდა',
    noExams: 'ჯერ არცერთი გამოცდა არ შეგიქმნიათ.',
    createFirst: 'შექმენით პირველი გამოცდა',
    examTitle: 'გამოცდის სახელი',
    topic: 'თემა / პოზიცია',
    topicPlaceholder: 'მაგ: Senior React დეველოპერი — hooks, state მართვა, წარმადობა',
    description: 'აღწერა (არასავალდებულო)',
    mcqCount: 'ტესტის კითხვების რაოდენობა',
    duration: 'ხანგრძლივობა (წუთი)',
    create: 'გამოცდის გენერირება',
    creating: 'AI აგენერირებს კითხვებს…',
    cancel: 'გაუქმება',
    active: 'აქტიური',
    closed: 'დახურული',
    close: 'დახურვა',
    reopen: 'ხელახლა გახსნა',
    delete: 'წაშლა',
    deleteConfirm: 'დარწმუნებული ხართ, რომ გსურთ ამ გამოცდის წაშლა?',
    candidateLinkTitle: 'კანდიდატის ბმული',
    candidateLinkHint: 'გაუზიარეთ ეს ბმული კანდიდატებს პირდაპირ.',
    embedTitle: 'ჩაშენების კოდი',
    embedHint: 'ჩასვით ეს კოდი თქვენი კარიერის გვერდზე — გამოჩნდება "შეფასების გავლა" ღილაკი.',
    copy: 'კოპირება',
    copied: 'დაკოპირდა ✓',
    submissionsTitle: 'კანდიდატების შედეგები',
    noSubmissions: 'ჯერ არცერთ კანდიდატს არ ჩაუბარებია.',
    candidate: 'კანდიდატი',
    mcqScore: 'ტესტი',
    practicalScore: 'პრაქტიკული',
    totalScore: 'ჯამური',
    status: 'სტატუსი',
    inProgress: 'მიმდინარეობს',
    completed: 'დასრულებული',
    flagged: 'მონიშნული (დარღვევა)',
    violations: 'დარღვევები',
    aiFeedback: 'AI შეფასება',
    genericError: 'დაფიქსირდა შეცდომა. სცადეთ თავიდან.',
  },
  en: {
    title: 'AI Exam Proctoring',
    subtitle: 'Create AI-generated candidate screening exams — each with a unique link.',
    newExam: '+ New Exam',
    noExams: "You haven't created any exams yet.",
    createFirst: 'Create your first exam',
    examTitle: 'Exam Title',
    topic: 'Topic / Role',
    topicPlaceholder: 'e.g. Senior React Developer — hooks, state management, performance',
    description: 'Description (optional)',
    mcqCount: 'Multiple-choice question count',
    duration: 'Duration (minutes)',
    create: 'Generate Exam',
    creating: 'AI is generating questions…',
    cancel: 'Cancel',
    active: 'Active',
    closed: 'Closed',
    close: 'Close',
    reopen: 'Reopen',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this exam?',
    candidateLinkTitle: 'Candidate Link',
    candidateLinkHint: 'Share this link with candidates directly.',
    embedTitle: 'Embed Script',
    embedHint: 'Paste this on your careers page — renders a "Take Assessment" button.',
    copy: 'Copy',
    copied: 'Copied ✓',
    submissionsTitle: 'Candidate Reports',
    noSubmissions: 'No candidates have taken this exam yet.',
    candidate: 'Candidate',
    mcqScore: 'MCQ',
    practicalScore: 'Practical',
    totalScore: 'Total',
    status: 'Status',
    inProgress: 'In Progress',
    completed: 'Completed',
    flagged: 'Flagged (violation)',
    violations: 'Violations',
    aiFeedback: 'AI Feedback',
    genericError: 'Something went wrong. Please try again.',
  },
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  CLOSED: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30',
};
const SUBMISSION_BADGE: Record<string, string> = {
  IN_PROGRESS: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  COMPLETED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  FLAGGED: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
};

const inputClass =
  'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';
const labelClass = 'block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5';

const emptyForm = { title: '', topic: '', description: '', mcqCount: 5, durationMinutes: 30 };

function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300"
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? copiedLabel : label}
    </button>
  );
}

export default function ExamProctoringTab({ lang }: { lang: 'ka' | 'en' }) {
  const t = dict[lang];
  const [sessions, setSessions] = useState<ExamSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExamSessionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyExamSessions();
      setSessions(data);
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
    } catch {
      setActionError(t.genericError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    getExamSession(selectedId)
      .then(setDetail)
      .catch(() => setActionError(t.genericError))
      .finally(() => setLoadingDetail(false));
  }, [selectedId, t.genericError]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const session = await createExamSession({
        title: createForm.title,
        topic: createForm.topic,
        description: createForm.description || undefined,
        mcqCount: createForm.mcqCount,
        durationMinutes: createForm.durationMinutes,
      });
      await loadSessions();
      setSelectedId(session.id);
      setShowCreateForm(false);
      setCreateForm(emptyForm);
    } catch (err: any) {
      setCreateError(err?.response?.data?.message ?? 'Unable to create exam.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!detail) return;
    setActionError(null);
    try {
      const nextStatus = detail.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';
      await updateExamSessionStatus(detail.id, nextStatus);
      const fresh = await getExamSession(detail.id);
      setDetail(fresh);
      setSessions((prev) => prev.map((s) => (s.id === fresh.id ? { ...s, status: fresh.status } : s)));
    } catch {
      setActionError(t.genericError);
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    if (!window.confirm(t.deleteConfirm)) return;
    setActionError(null);
    try {
      await deleteExamSession(detail.id);
      setSessions((prev) => prev.filter((s) => s.id !== detail.id));
      setSelectedId(null);
    } catch {
      setActionError(t.genericError);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cdc.org.ge';
  const candidateUrl = detail ? `${origin}/exam/${detail.candidateToken}` : '';
  const embedSnippet = detail
    ? `<script src="${origin}/exam-widget.js" data-exam-token="${detail.candidateToken}" defer></script>`
    : '';

  return (
    <div className="mb-10">
      <div className="mb-4">
        <h2 className="text-lg font-black tracking-wide flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          {t.title}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
      </div>

      {actionError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium px-4 py-2.5 mb-4 flex items-center justify-between gap-3">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="text-red-500/70 hover:text-red-500 font-bold">
            ×
          </button>
        </div>
      )}

      {sessions.length === 0 && !showCreateForm ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-12 text-center">
          <ClipboardList className="w-10 h-10 text-cyan-500 mx-auto mb-4" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t.noExams}</p>
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.createFirst}
          </button>
        </div>
      ) : showCreateForm ? (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none p-6 space-y-4 max-w-lg">
          {createError && <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-600 dark:text-red-300">{createError}</div>}
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className={labelClass}>{t.examTitle}</label>
              <input required className={inputClass} value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>{t.topic}</label>
              <textarea
                required
                rows={2}
                className={inputClass}
                value={createForm.topic}
                onChange={(e) => setCreateForm({ ...createForm, topic: e.target.value })}
                placeholder={t.topicPlaceholder}
              />
            </div>
            <div>
              <label className={labelClass}>{t.description}</label>
              <textarea rows={2} className={inputClass} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t.mcqCount}</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  className={inputClass}
                  value={createForm.mcqCount}
                  onChange={(e) => setCreateForm({ ...createForm, mcqCount: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={labelClass}>{t.duration}</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  required
                  className={inputClass}
                  value={createForm.durationMinutes}
                  onChange={(e) => setCreateForm({ ...createForm, durationMinutes: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300">
                {t.cancel}
              </button>
              <button type="submit" disabled={creating} className="flex-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {creating ? t.creating : t.create}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                    selectedId === s.id ? 'bg-slate-900 dark:bg-cyan-600 text-white border-transparent' : 'bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  {s.title}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" />
              {t.newExam}
            </button>
          </div>

          {loadingDetail ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
          ) : detail ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${STATUS_BADGE[detail.status]}`}>
                  {detail.status === 'ACTIVE' ? t.active : t.closed}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {detail.submissions.length}
                </span>
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  className="ml-auto text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
                >
                  {detail.status === 'ACTIVE' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  {detail.status === 'ACTIVE' ? t.close : t.reopen}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t.delete}
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none p-6 space-y-3">
                <h3 className="text-sm font-black tracking-wide">{t.candidateLinkTitle}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.candidateLinkHint}</p>
                <pre className="rounded-lg bg-slate-950 text-slate-100 p-4 text-xs overflow-x-auto"><code>{candidateUrl}</code></pre>
                <CopyButton text={candidateUrl} label={t.copy} copiedLabel={t.copied} />
              </div>

              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none p-6 space-y-3">
                <h3 className="text-sm font-black tracking-wide">{t.embedTitle}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.embedHint}</p>
                <pre className="rounded-lg bg-slate-950 text-slate-100 p-4 text-xs overflow-x-auto"><code>{embedSnippet}</code></pre>
                <CopyButton text={embedSnippet} label={t.copy} copiedLabel={t.copied} />
              </div>

              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none p-6">
                <h3 className="text-sm font-black tracking-wide mb-4">{t.submissionsTitle}</h3>
                {detail.submissions.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t.noSubmissions}</p>
                ) : (
                  <div className="space-y-3">
                    {detail.submissions.map((sub) => (
                      <div key={sub.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{sub.candidateName}</p>
                            <p className="text-[11px] text-slate-400">{sub.candidateEmail}</p>
                          </div>
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${SUBMISSION_BADGE[sub.status]}`}>
                            {sub.status === 'IN_PROGRESS' ? t.inProgress : sub.status === 'FLAGGED' ? t.flagged : t.completed}
                          </span>
                        </div>
                        {sub.status !== 'IN_PROGRESS' && (
                          <div className="grid grid-cols-4 gap-2 text-center mb-2">
                            <div>
                              <p className="text-[10px] text-slate-400">{t.mcqScore}</p>
                              <p className="text-sm font-black">{sub.mcqScore ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400">{t.practicalScore}</p>
                              <p className="text-sm font-black">{sub.practicalScore ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400">{t.totalScore}</p>
                              <p className="text-sm font-black text-cyan-600 dark:text-cyan-400">{sub.totalScore ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400">{t.violations}</p>
                              <p className="text-sm font-black">{sub.proctoringViolations}</p>
                            </div>
                          </div>
                        )}
                        {sub.aiEvaluation && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                            {t.aiFeedback}: {sub.aiEvaluation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
