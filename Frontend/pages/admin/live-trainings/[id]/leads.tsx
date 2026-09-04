import { useState, useEffect, useCallback, useMemo, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { ChevronLeft, Download, UserPlus, GraduationCap, CheckCircle2, Copy, Check, Trash2, Lock, Unlock, ClipboardList } from 'lucide-react';
import AdminGuard from '../../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../../src/components/admin/AdminLayout';
import {
  LiveTraining,
  LiveTrainingLead,
  LiveTrainingLeadStatus,
  LiveTrainingEnrollment,
  LiveTrainingEnrollmentStatus,
  LiveTrainingExamSession,
} from '../../../../src/types/liveTraining';
import { getLiveTraining } from '../../../../src/services/liveTrainingService';
import {
  getLiveTrainingLeads,
  updateLiveTrainingLead,
  exportLiveTrainingLeadsCsv,
  getLiveTrainingEnrollments,
  grantLiveTrainingEnrollment,
  completeLiveTrainingEnrollment,
  completeAllLiveTrainingEnrollments,
  getLiveTrainingExamSessions,
  createLiveTrainingExamSession,
  updateLiveTrainingExamSessionStatus,
  deleteLiveTrainingExamSession,
} from '../../../../src/services/adminLiveTrainingService';

const STATUS_LABEL: Record<LiveTrainingLeadStatus, string> = {
  NOT_CONTACTED: 'დაუკავშირებელი',
  CONTACTED: 'დაკავშირებული',
  SCHEDULED: 'დაგეგმილი',
  DECLINED: 'უარი განაცხადა',
};

const STATUS_BADGE: Record<LiveTrainingLeadStatus, string> = {
  NOT_CONTACTED: 'bg-gray-100 text-gray-600 border-gray-200',
  CONTACTED: 'bg-amber-50 text-amber-700 border-amber-200',
  SCHEDULED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DECLINED: 'bg-red-50 text-red-700 border-red-200',
};

const ENROLLMENT_STATUS_LABEL: Record<LiveTrainingEnrollmentStatus, string> = {
  ACTIVE: 'აქტიური',
  COMPLETED: 'დასრულებული 🎓',
  CANCELLED: 'გაუქმებული',
};

const ENROLLMENT_STATUS_BADGE: Record<LiveTrainingEnrollmentStatus, string> = {
  ACTIVE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
};

const EXAM_MCQ_PRESETS = [
  { label: 'სწრაფი (5)', value: 5 },
  { label: 'სტანდარტული (12)', value: 12 },
  { label: 'ღრმა (20)', value: 20 },
];

function AdminLiveTrainingLeadsDashboard() {
  const router = useRouter();
  const trainingId = typeof router.query.id === 'string' ? router.query.id : null;

  const [training, setTraining] = useState<LiveTraining | null>(null);
  const [leads, setLeads] = useState<LiveTrainingLead[]>([]);
  const [enrollments, setEnrollments] = useState<LiveTrainingEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LiveTrainingLeadStatus | ''>('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantNote, setGrantNote] = useState('');
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completingAll, setCompletingAll] = useState(false);

  const [examSessions, setExamSessions] = useState<LiveTrainingExamSession[]>([]);
  const [showExamForm, setShowExamForm] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [examTopic, setExamTopic] = useState('');
  const [examRawContent, setExamRawContent] = useState('');
  const [examMcqCount, setExamMcqCount] = useState(12);
  const [examDuration, setExamDuration] = useState(30);
  const [examIncludeCode, setExamIncludeCode] = useState(false);
  const [examSubmitting, setExamSubmitting] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [examBusyId, setExamBusyId] = useState<string | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!trainingId) return;
    setLoading(true);
    setError(null);
    try {
      const [t, l, e, exams] = await Promise.all([
        getLiveTraining(trainingId),
        getLiveTrainingLeads(trainingId),
        getLiveTrainingEnrollments(trainingId),
        getLiveTrainingExamSessions(trainingId),
      ]);
      setTraining(t);
      setLeads(l);
      setEnrollments(e.filter((row) => row.status !== 'CANCELLED'));
      setExamSessions(exams);
    } catch {
      setError('მონაცემების ჩატვირთვა ვერ მოხერხდა.');
    } finally {
      setLoading(false);
    }
  }, [trainingId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredLeads = useMemo(() => (statusFilter ? leads.filter((l) => l.status === statusFilter) : leads), [leads, statusFilter]);

  const handleStatusChange = async (leadId: string, status: LiveTrainingLeadStatus) => {
    setBusyId(leadId);
    try {
      const updated = await updateLiveTrainingLead(leadId, { status });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
    } catch {
      setError('სტატუსის განახლება ვერ მოხერხდა.');
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = async () => {
    if (!trainingId) return;
    setExporting(true);
    try {
      const blob = await exportLiveTrainingLeadsCsv(trainingId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${training?.title ?? 'live-training'}-leads.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('CSV ექსპორტი ვერ მოხერხდა.');
    } finally {
      setExporting(false);
    }
  };

  // Manual roster grant — for a student who paid by bank transfer/offline
  // and never went through online checkout or the self-serve free-enroll
  // flow. Upserts straight to ACTIVE server-side, so re-running this for
  // someone already enrolled is harmless.
  const handleGrant = async (e: FormEvent) => {
    e.preventDefault();
    if (!trainingId || !grantEmail.trim()) return;
    setGranting(true);
    setGrantError(null);
    try {
      await grantLiveTrainingEnrollment(trainingId, { userEmail: grantEmail.trim(), note: grantNote.trim() || undefined });
      setGrantEmail('');
      setGrantNote('');
      setShowGrantForm(false);
      await load();
    } catch (err: any) {
      setGrantError(err?.response?.data?.message ?? 'სტუდენტის დამატება ვერ მოხერხდა.');
    } finally {
      setGranting(false);
    }
  };

  // Marks one seat COMPLETED — Backend automatically grants Graduate status
  // (unlimited forum posting) + sends the congrats notification/email as a
  // side effect. See adminLiveTrainings.ts's completeEnrollment.
  const handleComplete = async (enrollmentId: string) => {
    if (!trainingId) return;
    if (!window.confirm('მონიშნოთ ეს სტუდენტი კურსდამთავრებულად? მას ავტომატურად მიენიჭება Graduate სტატუსი და ულიმიტო წვდომა დასაქმების ფორუმზე.')) return;
    setCompletingId(enrollmentId);
    try {
      await completeLiveTrainingEnrollment(trainingId, enrollmentId);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'სტატუსის განახლება ვერ მოხერხდა.');
    } finally {
      setCompletingId(null);
    }
  };

  const handleCompleteAll = async () => {
    if (!trainingId) return;
    if (!window.confirm('მონიშნოთ ყველა აქტიური სტუდენტი კურსდამთავრებულად? ყველას ავტომატურად მიენიჭება Graduate სტატუსი.')) return;
    setCompletingAll(true);
    try {
      await completeAllLiveTrainingEnrollments(trainingId);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'დასრულება ვერ მოხერხდა.');
    } finally {
      setCompletingAll(false);
    }
  };

  // AI-generates the final exam's question set (same generator as the
  // standalone Business exam-proctoring tool) and returns a unique
  // candidate-link token to share with the cohort.
  const handleCreateExam = async (e: FormEvent) => {
    e.preventDefault();
    if (!trainingId || !examTitle.trim() || !examTopic.trim()) return;
    setExamSubmitting(true);
    setExamError(null);
    try {
      await createLiveTrainingExamSession(trainingId, {
        title: examTitle.trim(),
        topic: examTopic.trim(),
        rawContent: examRawContent.trim() || undefined,
        mcqCount: examMcqCount,
        durationMinutes: examDuration,
        includeCodeQuestion: examIncludeCode,
      });
      setExamTitle('');
      setExamTopic('');
      setExamRawContent('');
      setExamMcqCount(12);
      setExamDuration(30);
      setExamIncludeCode(false);
      setShowExamForm(false);
      setExamSessions(await getLiveTrainingExamSessions(trainingId));
    } catch (err: any) {
      setExamError(err?.response?.data?.message ?? 'გამოცდის გენერირება ვერ მოხერხდა.');
    } finally {
      setExamSubmitting(false);
    }
  };

  const handleCopyExamLink = (session: LiveTrainingExamSession) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cdc.org.ge';
    navigator.clipboard.writeText(`${origin}/exam/${session.candidateToken}`);
    setCopiedSessionId(session.id);
    setTimeout(() => setCopiedSessionId(null), 2000);
  };

  const handleToggleExamStatus = async (session: LiveTrainingExamSession) => {
    if (!trainingId) return;
    setExamBusyId(session.id);
    try {
      const updated = await updateLiveTrainingExamSessionStatus(trainingId, session.id, session.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE');
      setExamSessions((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
    } catch {
      setExamError('სტატუსის შეცვლა ვერ მოხერხდა.');
    } finally {
      setExamBusyId(null);
    }
  };

  const handleDeleteExam = async (sessionId: string) => {
    if (!trainingId) return;
    if (!window.confirm('წავშალოთ ეს გამოცდა?')) return;
    setExamBusyId(sessionId);
    try {
      await deleteLiveTrainingExamSession(trainingId, sessionId);
      setExamSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      setExamError('წაშლა ვერ მოხერხდა.');
    } finally {
      setExamBusyId(null);
    }
  };

  return (
    <>
      <Head>
        <title>{training ? `${training.title} — ლიდები` : 'ლიდები'} | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <Link href="/admin/live-trainings" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 mb-4">
          <ChevronLeft className="w-3.5 h-3.5" /> ტრენინგებზე დაბრუნება
        </Link>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="blog-heading-safe text-2xl font-semibold text-gray-900">{training?.title ?? 'ლიდები'}</h1>
            {training && (
              <p className="text-sm text-gray-500 mt-1">
                {new Date(training.scheduledAt).toLocaleString()} · {training.registeredCount} / {training.maxCapacity} რეგისტრირებული ·{' '}
                {training.minThresholdMet
                  ? 'მინ. ჯგუფი შევსებულია'
                  : `მინ. ${training.minCapacity}-კაციან ჯგუფს აკლია ${Math.max(0, training.minCapacity - training.registeredCount)} ადამიანი`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || leads.length === 0}
            className="shrink-0 flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'იტვირთება…' : 'CSV ექსპორტი'}
          </button>
        </div>

        {!loading && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-8">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">ჩარიცხული სტუდენტები — რეალური ანგარიშები ({enrollments.length})</h2>
                <p className="text-xs text-gray-500 mt-0.5">ეს არის კოჰორტის რეალური სია — მათ დაშბორდზე ავტომატურად უჩნდებათ მიერთების ბმული და ჩანაწერი.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {enrollments.some((row) => row.status === 'ACTIVE') && (
                  <button
                    type="button"
                    onClick={handleCompleteAll}
                    disabled={completingAll}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    {completingAll ? 'მუშავდება…' : 'ყველას დასრულება'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowGrantForm((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  სტუდენტის დამატება
                </button>
              </div>
            </div>

            {showGrantForm && (
              <form onSubmit={handleGrant} className="px-4 py-4 border-b border-gray-100 bg-indigo-50/40 space-y-2.5">
                <p className="text-xs text-gray-500">
                  ხელით ჩარიცხვა — ბანკის გადარიცხვით/ონლაინ გადახდის გარეშე გადახდილი სტუდენტისთვის. საჭიროა, რომ სტუდენტს უკვე ჰქონდეს რეგისტრირებული ანგარიში ამ ელფოსტით.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="email"
                    required
                    value={grantEmail}
                    onChange={(e) => setGrantEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    value={grantNote}
                    onChange={(e) => setGrantNote(e.target.value)}
                    placeholder="შენიშვნა (არასავალდებულო) — მაგ. გადარიცხვის ნომერი"
                    className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={granting || !grantEmail.trim()}
                    className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {granting ? 'ემატება…' : 'დამატება'}
                  </button>
                </div>
                {grantError && <p className="text-xs text-red-600">{grantError}</p>}
              </form>
            )}

            {enrollments.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400">ჯერ არცერთი სტუდენტი არ არის ჩარიცხული.</p>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 font-medium">სახელი</th>
                    <th className="px-4 py-3 font-medium">ელ. ფოსტა</th>
                    <th className="px-4 py-3 font-medium">ჩარიცხვის დრო</th>
                    <th className="px-4 py-3 font-medium">სტატუსი</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {enrollments.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{e.user.name}</td>
                      <td className="px-4 py-3 text-gray-600">{e.user.email}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(e.enrolledAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${ENROLLMENT_STATUS_BADGE[e.status]}`}>
                          {ENROLLMENT_STATUS_LABEL[e.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {e.status === 'ACTIVE' && (
                          <button
                            type="button"
                            onClick={() => handleComplete(e.id)}
                            disabled={completingId === e.id}
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-transparent border-none cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {completingId === e.id ? 'მუშავდება…' : 'დასრულება'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}

        {!loading && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-8">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">ფინალური გამოცდა ({examSessions.length})</h2>
                <p className="text-xs text-gray-500 mt-0.5">AI გენერირებს კითხვებს — შედეგად მიღებული ბმული გაუზიარეთ კოჰორტის სტუდენტებს.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowExamForm((v) => !v)}
                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                + ახალი გამოცდა
              </button>
            </div>

            {showExamForm && (
              <form onSubmit={handleCreateExam} className="px-4 py-4 border-b border-gray-100 bg-purple-50/40 space-y-2.5">
                <div className="flex flex-wrap gap-2">
                  <input
                    required
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="გამოცდის სახელი — მაგ. Vibe Coding — ფინალური გამოცდა"
                    className="flex-1 min-w-[240px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <textarea
                  required
                  value={examTopic}
                  onChange={(e) => setExamTopic(e.target.value)}
                  placeholder="თემა — რას მოიცავს კურსი (AI ამის მიხედვით გენერირებს კითხვებს)"
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <textarea
                  value={examRawContent}
                  onChange={(e) => setExamRawContent(e.target.value)}
                  placeholder="დამატებითი წყარო მასალა (არასავალდებულო) — ჩასვით ტექსტი დამატებითი კონტექსტისთვის"
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={examMcqCount}
                    onChange={(e) => setExamMcqCount(Number(e.target.value))}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {EXAM_MCQ_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    ხანგრძლივობა (წთ)
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={examDuration}
                      onChange={(e) => setExamDuration(Number(e.target.value))}
                      className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input type="checkbox" checked={examIncludeCode} onChange={(e) => setExamIncludeCode(e.target.checked)} />
                    კოდის კითხვა
                  </label>
                  <button
                    type="submit"
                    disabled={examSubmitting || !examTitle.trim() || !examTopic.trim()}
                    className="ml-auto shrink-0 text-sm font-medium px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60"
                  >
                    {examSubmitting ? 'AI აგენერირებს…' : 'გენერირება'}
                  </button>
                </div>
                {examError && <p className="text-xs text-red-600">{examError}</p>}
              </form>
            )}

            {examSessions.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400">ჯერ არცერთი ფინალური გამოცდა არ შექმნილა.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {examSessions.map((s) => {
                  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cdc.org.ge';
                  const link = `${origin}/exam/${s.candidateToken}`;
                  return (
                    <div key={s.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                              s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                            }`}
                          >
                            {s.status === 'ACTIVE' ? 'აქტიური' : 'დახურული'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {s.mcqCount} კითხვა · {s.durationMinutes} წთ · {s._count.submissions} ჩაბარებული
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyExamLink(s)}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          {copiedSessionId === s.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedSessionId === s.id ? 'დაკოპირდა' : 'ბმულის კოპირება'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleExamStatus(s)}
                          disabled={examBusyId === s.id}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {s.status === 'ACTIVE' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          {s.status === 'ACTIVE' ? 'დახურვა' : 'გახსნა'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExam(s.id)}
                          disabled={examBusyId === s.id}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="w-full text-[11px] text-gray-400 break-all">{link}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <h2 className="text-sm font-semibold text-gray-900 mb-3">ანონიმური ლიდები — სატელეფონო კონტაქტის რიგი</h2>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(['', 'NOT_CONTACTED', 'CONTACTED', 'SCHEDULED', 'DECLINED'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s === '' ? 'ყველა' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {error && <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : filteredLeads.length === 0 ? (
          <p className="text-sm text-gray-500">ლიდები ვერ მოიძებნა.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 font-medium">სახელი</th>
                    <th className="px-4 py-3 font-medium">კონტაქტი</th>
                    <th className="px-4 py-3 font-medium">რეგისტრაცია</th>
                    <th className="px-4 py-3 font-medium">სტატუსი</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLeads.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{l.name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div>{l.email}</div>
                        <a href={`tel:${l.phone.replace(/\s+/g, '')}`} className="text-indigo-600 hover:underline">
                          {l.phone}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(l.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <select
                          value={l.status}
                          disabled={busyId === l.id}
                          onChange={(e) => handleStatusChange(l.id, e.target.value as LiveTrainingLeadStatus)}
                          className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border cursor-pointer disabled:opacity-60 ${STATUS_BADGE[l.status]}`}
                        >
                          {(Object.keys(STATUS_LABEL) as LiveTrainingLeadStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminLiveTrainingLeadsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminLiveTrainingLeadsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
