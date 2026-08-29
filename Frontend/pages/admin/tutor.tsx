import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import {
  TutorAnalytics,
  AdminTutorLessonListItem,
  AdminTutorLesson,
  AdminTutorProgressItem,
  AdminTutorFlag,
  AdminTutorPromptConfig,
  getTutorAnalytics,
  listAdminTutorLessons,
  getAdminTutorLesson,
  updateAdminTutorLesson,
  approveAdminTutorLesson,
  regenerateAdminTutorLesson,
  listAdminTutorAuditLogs,
  listAdminTutorFlags,
  resolveAdminTutorFlag,
  getAdminTutorPromptConfig,
  updateAdminTutorPromptConfig,
} from '../../src/services/adminEnglishTutorService';

const TASK_TYPES = ['READING', 'WRITING', 'GRAMMAR', 'VOCABULARY', 'QUIZ', 'LISTENING', 'DIALOGUE'] as const;
const LEARNING_GOALS = ['TRAVEL', 'TECHNICAL_IT', 'BUSINESS', 'ACADEMIC', 'GENERAL_DAILY', 'INTERVIEW_PREP'] as const;

type Tab = 'analytics' | 'curriculum' | 'audit' | 'flags' | 'prompts';

function formatGel(minorUnits: number): string {
  return `${(minorUnits / 100).toFixed(2)} GEL`;
}
function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function TutorAdminContent() {
  const [tab, setTab] = useState<Tab>('analytics');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-black mb-1 text-gray-900 dark:text-white">IMIAKO — AI English Tutor</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Analytics, curriculum inspection, audit logs, and prompt configuration.</p>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 dark:border-slate-800">
        {(
          [
            ['analytics', 'Analytics'],
            ['curriculum', 'Curriculum Inspector'],
            ['audit', 'Audit Logs'],
            ['flags', 'Flags'],
            ['prompts', 'Prompt Configurator'],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px ${
              tab === value ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 dark:text-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'curriculum' && <CurriculumTab />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'flags' && <FlagsTab />}
      {tab === 'prompts' && <PromptsTab />}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/90 dark:bg-slate-900/70 border border-gray-200 dark:border-white/10 rounded-xl p-4">
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-xl font-black text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function AnalyticsTab() {
  const [data, setData] = useState<TutorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTutorAnalytics()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500 dark:text-slate-400">Loading…</p>;
  if (!data) return <p className="text-sm text-red-500">Failed to load analytics.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active PRO subscribers" value={String(data.activeProSubscribers)} />
        <StatCard label="Trial → Paid conversion" value={pct(data.conversionRate)} />
        <StatCard label="Revenue (all-time)" value={formatGel(data.revenueGel)} />
        <StatCard label="Average score" value={data.averageScoreOverall != null ? `${data.averageScoreOverall}%` : '—'} />
        <StatCard label="Ever started trial" value={String(data.everStartedTrial)} />
        <StatCard label="Total purchases" value={String(data.totalPurchases)} />
        <StatCard label="Price / month" value={formatGel(data.subscriptionPriceGel)} />
        <StatCard label="Total users" value={String(data.totalUsers)} />
      </div>

      <div className="bg-white/90 dark:bg-slate-900/70 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-800/60 text-left text-xs text-gray-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2.5">Learning goal</th>
              <th className="px-4 py-2.5">Total tasks</th>
              <th className="px-4 py-2.5">Completion rate</th>
              <th className="px-4 py-2.5">Average score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {data.goalStats.map((g) => (
              <tr key={g.goal}>
                <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{g.goal}</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-slate-300">{g.totalTasks}</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-slate-300">{pct(g.completionRate)}</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-slate-300">{g.averageScore != null ? `${g.averageScore}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CurriculumTab() {
  const [lessons, setLessons] = useState<AdminTutorLessonListItem[]>([]);
  const [taskType, setTaskType] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminTutorLesson | null>(null);
  const [contentDraft, setContentDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listAdminTutorLessons({ taskType: (taskType || undefined) as any })
      .then((res) => setLessons(res.data))
      .finally(() => setLoading(false));
  }, [taskType]);

  useEffect(() => {
    load();
  }, [load]);

  const openLesson = async (id: string) => {
    setMessage(null);
    const lesson = await getAdminTutorLesson(id);
    setSelected(lesson);
    setContentDraft(JSON.stringify(lesson.content, null, 2));
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    try {
      const parsed = JSON.parse(contentDraft);
      const updated = await updateAdminTutorLesson(selected.id, parsed);
      setSelected(updated);
      setMessage('Saved.');
      load();
    } catch {
      setMessage('Invalid JSON or save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    const updated = await approveAdminTutorLesson(selected.id);
    setSelected(updated);
    load();
  };

  const handleRegenerate = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await regenerateAdminTutorLesson(selected.id);
      setSelected(updated);
      setContentDraft(JSON.stringify(updated.content, null, 2));
      setMessage('Regenerated.');
      load();
    } catch {
      setMessage('Regeneration failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-white/90 dark:bg-slate-900/70 border border-gray-200 dark:border-white/10 rounded-xl p-4">
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value)}
          className="mb-3 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900 px-3 py-1.5 text-sm"
        >
          <option value="">All task types</option>
          {TASK_TYPES.map((tt) => (
            <option key={tt} value={tt}>
              {tt}
            </option>
          ))}
        </select>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">Loading…</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
            {lessons.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => openLesson(l.id)}
                className={`text-left py-2.5 px-1 text-sm hover:text-purple-600 dark:hover:text-purple-400 ${selected?.id === l.id ? 'text-purple-600 dark:text-purple-400' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {l.taskType} · {l.level}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs">
                    {l.adminApproved && <span className="text-emerald-500">✓ approved</span>}
                    {l._count.flags > 0 && <span className="text-red-500">🚩{l._count.flags}</span>}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {l.generatedForUser.name} · {new Date(l.createdAt).toLocaleDateString()}
                </div>
              </button>
            ))}
            {lessons.length === 0 && <p className="text-sm text-gray-400 py-4">No lessons found.</p>}
          </div>
        )}
      </div>

      <div className="bg-white/90 dark:bg-slate-900/70 border border-gray-200 dark:border-white/10 rounded-xl p-4">
        {!selected ? (
          <p className="text-sm text-gray-400">Select a lesson to inspect.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs">
              <button type="button" onClick={handleApprove} disabled={selected.adminApproved} className="rounded-full bg-emerald-500 text-white font-bold px-3 py-1.5 disabled:opacity-50">
                {selected.adminApproved ? 'Approved' : 'Approve'}
              </button>
              <button type="button" onClick={handleRegenerate} disabled={saving} className="rounded-full bg-purple-600 text-white font-bold px-3 py-1.5 disabled:opacity-50">
                Regenerate
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className="rounded-full bg-cyan-600 text-white font-bold px-3 py-1.5 disabled:opacity-50">
                Save edits
              </button>
            </div>
            {message && <p className="text-xs text-gray-500 dark:text-slate-400">{message}</p>}
            <textarea
              value={contentDraft}
              onChange={(e) => setContentDraft(e.target.value)}
              rows={20}
              className="w-full font-mono text-xs rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-950 px-3 py-2"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function AuditTab() {
  const [items, setItems] = useState<AdminTutorProgressItem[]>([]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listAdminTutorAuditLogs({ flagged: flaggedOnly })
      .then((res) => setItems(res.data))
      .finally(() => setLoading(false));
  }, [flaggedOnly]);

  return (
    <div className="bg-white/90 dark:bg-slate-900/70 border border-gray-200 dark:border-white/10 rounded-xl p-4">
      <label className="flex items-center gap-2 text-sm mb-3">
        <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
        Flagged only
      </label>
      {loading ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Loading…</p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-100 dark:divide-slate-800">
          {items.map((item) => (
            <div key={item.id} className="py-3">
              <button type="button" onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="w-full text-left flex items-center justify-between text-sm">
                <span>
                  <strong>{item.user.name}</strong> · {item.tutorLesson.taskType} {item.tutorLesson.level} · {item.status}
                  {item.flags.length > 0 && <span className="ml-2 text-red-500">🚩{item.flags.length}</span>}
                </span>
                <span className="text-xs text-gray-400">{item.score != null ? `${item.score}%` : '—'}</span>
              </button>
              {expanded === item.id && (
                <div className="mt-2 rounded-lg bg-gray-50 dark:bg-slate-800/60 p-3 text-xs">
                  <p className="font-bold mb-1">Submission</p>
                  <pre className="whitespace-pre-wrap break-words mb-2">{JSON.stringify(item.responseData, null, 2)}</pre>
                  <p className="font-bold mb-1">AI feedback</p>
                  <pre className="whitespace-pre-wrap break-words">{JSON.stringify(item.feedback, null, 2)}</pre>
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-gray-400">No records found.</p>}
        </div>
      )}
    </div>
  );
}

function FlagsTab() {
  const [flags, setFlags] = useState<AdminTutorFlag[]>([]);
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED' | 'DISMISSED'>('OPEN');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listAdminTutorFlags(status)
      .then(setFlags)
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const handleResolve = async (id: string, next: 'RESOLVED' | 'DISMISSED') => {
    await resolveAdminTutorFlag(id, next);
    load();
  };

  return (
    <div className="bg-white/90 dark:bg-slate-900/70 border border-gray-200 dark:border-white/10 rounded-xl p-4">
      <div className="flex gap-2 mb-3">
        {(['OPEN', 'RESOLVED', 'DISMISSED'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full ${status === s ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'}`}
          >
            {s}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Loading…</p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-100 dark:divide-slate-800">
          {flags.map((f) => (
            <div key={f.id} className="py-3 flex items-center justify-between gap-3 text-sm">
              <div>
                <p>{f.reason}</p>
                <p className="text-xs text-gray-400">
                  {f.flaggedByUser.name} · {new Date(f.createdAt).toLocaleString()} ·{' '}
                  {f.tutorLesson ? `Lesson ${f.tutorLesson.taskType} ${f.tutorLesson.level}` : 'Progress record'}
                </p>
              </div>
              {status === 'OPEN' && (
                <div className="flex gap-1.5 shrink-0">
                  <button type="button" onClick={() => handleResolve(f.id, 'RESOLVED')} className="text-xs font-bold text-emerald-500">
                    Resolve
                  </button>
                  <button type="button" onClick={() => handleResolve(f.id, 'DISMISSED')} className="text-xs font-bold text-gray-400">
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
          {flags.length === 0 && <p className="text-sm text-gray-400">No flags.</p>}
        </div>
      )}
    </div>
  );
}

function PromptsTab() {
  const [configs, setConfigs] = useState<AdminTutorPromptConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    getAdminTutorPromptConfig()
      .then(setConfigs)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (taskType: (typeof TASK_TYPES)[number], systemPromptOverride: string, temperatureOverride: string) => {
    setSaving(taskType);
    try {
      const updated = await updateAdminTutorPromptConfig(taskType, {
        systemPromptOverride: systemPromptOverride.trim() || null,
        temperatureOverride: temperatureOverride.trim() ? Number(temperatureOverride) : null,
      });
      setConfigs((prev) => prev.map((c) => (c.taskType === taskType ? updated : c)));
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <p className="text-sm text-gray-500 dark:text-slate-400">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      {configs.map((c) => (
        <PromptConfigRow key={c.taskType} config={c} saving={saving === c.taskType} onSave={handleSave} />
      ))}
    </div>
  );
}

function PromptConfigRow({
  config,
  saving,
  onSave,
}: {
  config: AdminTutorPromptConfig;
  saving: boolean;
  onSave: (taskType: (typeof TASK_TYPES)[number], systemPromptOverride: string, temperatureOverride: string) => void;
}) {
  const [override, setOverride] = useState(config.systemPromptOverride ?? '');
  const [temperature, setTemperature] = useState(config.temperatureOverride != null ? String(config.temperatureOverride) : '');

  return (
    <div className="bg-white/90 dark:bg-slate-900/70 border border-gray-200 dark:border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm text-gray-900 dark:text-white">{config.taskType}</h3>
        <button
          type="button"
          onClick={() => onSave(config.taskType, override, temperature)}
          disabled={saving}
          className="text-xs font-bold rounded-full bg-purple-600 text-white px-3 py-1.5 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <textarea
        value={override}
        onChange={(e) => setOverride(e.target.value)}
        placeholder="Additional instructions appended to this taskType's prompt (leave blank for default)…"
        rows={3}
        className="w-full text-sm rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-950 px-3 py-2 mb-2"
      />
      <input
        value={temperature}
        onChange={(e) => setTemperature(e.target.value)}
        placeholder="Temperature override (0-2, blank = default)"
        className="w-64 text-xs rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-950 px-3 py-1.5"
      />
    </div>
  );
}

export default function TutorAdminPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <Head>
          <title>AI English Tutor | Admin</title>
        </Head>
        <TutorAdminContent />
      </AdminLayout>
    </AdminGuard>
  );
}
