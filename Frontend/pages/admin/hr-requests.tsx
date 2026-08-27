import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../src/context/AuthContext';
import SiteHeader from '../../src/components/layout/SiteHeader';
import { resolveLocale } from '../../src/utils/locale';
import { HRSupportRequest, CandidateEvaluation } from '../../src/types/hrSupport';
import {
  getHRRequestsAssignedToMe,
  getHRSupportRequest,
  updateCandidateEvaluation,
  deliverHRSupportRequest,
  confirmHRSupportRequest,
  UpdateCandidateEvaluationPayload,
} from '../../src/services/hrSupportService';
import { getAllHRSupportRequests, getHRSpecialists, assignHRSpecialist, resolveHRSupportDispute } from '../../src/services/adminHRSupportService';

const EN_STRINGS = {
  title: 'HR Assistance Requests',
  loading: 'Loading…',
  noAccess: "You don't have access to this page.",
  goHome: 'Go to homepage',
  noRequests: 'No HR Assistance requests yet.',
  vacancy: 'Vacancy',
  employer: 'Employer',
  specialist: 'Specialist',
  unassigned: 'Unassigned',
  candidates: (n: number) => `${n} candidate${n !== 1 ? 's' : ''}`,
  price: 'Price',
  status: 'Status',
  assign: 'Assign',
  assignPlaceholder: 'Choose a specialist…',
  matrixTitle: 'Candidate Scoring Matrix',
  hardSkills: 'Hard skills',
  softSkills: 'Soft skills',
  taskScore: 'Task score',
  culturalFit: 'Cultural fit',
  rank: 'Rank',
  notes: 'Notes',
  meetingLink: 'Meeting link',
  interviewAt: 'Interview date/time',
  candidateStatus: 'Stage',
  save: 'Save',
  saved: 'Saved',
  deliverTitle: 'Deliver Final Report',
  reportPlaceholder: 'Summarize the Top-3 candidates, key findings, and your recommendation…',
  markDelivered: 'Mark as Delivered',
  delivering: 'Delivering…',
  confirmDelivery: 'Confirm & Release Payment',
  disputeRaised: 'Dispute raised',
  resolveRelease: 'Resolve: Release to Specialist',
  resolveRefund: 'Resolve: Refund Employer',
  candidateStages: { PENDING: 'Pending', TASK_SENT: 'Task sent', TASK_SUBMITTED: 'Task submitted', INTERVIEWED: 'Interviewed', SCORED: 'Scored' } as Record<string, string>,
  errGeneric: 'Something went wrong. Please try again.',
};

const dict = {
  ka: {
    title: 'HR დახმარების მოთხოვნები',
    loading: 'იტვირთება…',
    noAccess: 'ამ გვერდზე წვდომა არ გაქვთ.',
    goHome: 'მთავარ გვერდზე დაბრუნება',
    noRequests: 'HR დახმარების მოთხოვნები ჯერ არ არის.',
    vacancy: 'ვაკანსია',
    employer: 'დამკვეთი',
    specialist: 'სპეციალისტი',
    unassigned: 'არ არის მინიჭებული',
    candidates: (n: number) => `${n} კანდიდატი`,
    price: 'ფასი',
    status: 'სტატუსი',
    assign: 'მინიჭება',
    assignPlaceholder: 'აირჩიეთ სპეციალისტი…',
    matrixTitle: 'კანდიდატების შეფასების მატრიცა',
    hardSkills: 'ტექნიკური უნარები',
    softSkills: 'რბილი უნარები',
    taskScore: 'დავალების შეფასება',
    culturalFit: 'კულტურული თავსებადობა',
    rank: 'რანგი',
    notes: 'შენიშვნები',
    meetingLink: 'შეხვედრის ბმული',
    interviewAt: 'გასაუბრების თარიღი/დრო',
    candidateStatus: 'ეტაპი',
    save: 'შენახვა',
    saved: 'შენახულია',
    deliverTitle: 'საბოლოო რეპორტის მიწოდება',
    reportPlaceholder: 'შეაჯამეთ TOP-3 კანდიდატი, ძირითადი დასკვნები და თქვენი რეკომენდაცია…',
    markDelivered: 'მიწოდებულად მონიშვნა',
    delivering: 'იგზავნება…',
    confirmDelivery: 'დადასტურება და გადახდის გამოთავისუფლება',
    disputeRaised: 'დავა დაფიქსირდა',
    resolveRelease: 'გადაწყვეტილება: გადახდა სპეციალისტს',
    resolveRefund: 'გადაწყვეტილება: თანხის დაბრუნება დამკვეთს',
    candidateStages: { PENDING: 'მოლოდინში', TASK_SENT: 'დავალება გაგზავნილია', TASK_SUBMITTED: 'დავალება მიღებულია', INTERVIEWED: 'გასაუბრებულია', SCORED: 'შეფასებულია' } as Record<string, string>,
    errGeneric: 'რაღაც შეცდომა მოხდა. სცადეთ თავიდან.',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

function formatGel(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

function scoreInput(
  value: number | null,
  onChange: (v: number | null) => void,
  disabled: boolean
) {
  return (
    <input
      type="number"
      min={0}
      max={100}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Math.min(100, parseInt(e.target.value, 10))))}
      className="w-16 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800 px-2 py-1.5 text-xs text-center disabled:opacity-50"
    />
  );
}

interface CandidateRowProps {
  evaluation: CandidateEvaluation;
  requestId: string;
  canEdit: boolean;
  t: typeof EN_STRINGS;
  onSaved: (updated: CandidateEvaluation) => void;
}

function CandidateRow({ evaluation, requestId, canEdit, t, onSaved }: CandidateRowProps) {
  const [form, setForm] = useState<UpdateCandidateEvaluationPayload>({
    hardSkillsScore: evaluation.hardSkillsScore,
    softSkillsScore: evaluation.softSkillsScore,
    taskScore: evaluation.taskScore,
    culturalFitScore: evaluation.culturalFitScore,
    overallRank: evaluation.overallRank,
    hrNotes: evaluation.hrNotes ?? '',
    meetingUrl: evaluation.meetingUrl ?? '',
    interviewAt: evaluation.interviewAt,
    status: evaluation.status,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(false);
    try {
      const updated = await updateCandidateEvaluation(requestId, evaluation.id, form);
      onSaved(updated as CandidateEvaluation);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-t border-gray-100 dark:border-slate-800">
      <td className="px-3 py-3 text-xs">
        <p className="font-bold text-gray-900 dark:text-white">{evaluation.application.applicant.name}</p>
        {evaluation.application.applicant.cvUrl && (
          <a
            href={evaluation.application.applicant.cvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            CV
          </a>
        )}
      </td>
      <td className="px-2 py-3">{scoreInput(form.hardSkillsScore ?? null, (v) => setForm({ ...form, hardSkillsScore: v }), !canEdit)}</td>
      <td className="px-2 py-3">{scoreInput(form.softSkillsScore ?? null, (v) => setForm({ ...form, softSkillsScore: v }), !canEdit)}</td>
      <td className="px-2 py-3">{scoreInput(form.taskScore ?? null, (v) => setForm({ ...form, taskScore: v }), !canEdit)}</td>
      <td className="px-2 py-3">{scoreInput(form.culturalFitScore ?? null, (v) => setForm({ ...form, culturalFitScore: v }), !canEdit)}</td>
      <td className="px-2 py-3">
        <input
          type="number"
          min={1}
          disabled={!canEdit}
          value={form.overallRank ?? ''}
          onChange={(e) => setForm({ ...form, overallRank: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
          className="w-12 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800 px-2 py-1.5 text-xs text-center disabled:opacity-50"
        />
      </td>
      <td className="px-2 py-3">
        <select
          disabled={!canEdit}
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as UpdateCandidateEvaluationPayload['status'] })}
          className="rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800 px-2 py-1.5 text-xs disabled:opacity-50"
        >
          {Object.entries(t.candidateStages).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-3">
        <input
          type="url"
          disabled={!canEdit}
          value={form.meetingUrl ?? ''}
          onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })}
          placeholder="https://meet.google.com/…"
          className="w-36 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800 px-2 py-1.5 text-xs disabled:opacity-50"
        />
      </td>
      <td className="px-2 py-3">
        <textarea
          disabled={!canEdit}
          rows={1}
          value={form.hrNotes ?? ''}
          onChange={(e) => setForm({ ...form, hrNotes: e.target.value })}
          className="w-40 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800 px-2 py-1.5 text-xs disabled:opacity-50"
        />
      </td>
      {canEdit && (
        <td className="px-2 py-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            title={saveError ? 'Save failed — try again' : undefined}
            className={`text-xs font-bold hover:underline disabled:opacity-50 ${
              saveError ? 'text-red-600 dark:text-red-400' : 'text-cyan-600 dark:text-cyan-400'
            }`}
          >
            {saveError ? 'Failed — retry' : saved ? t.saved : saving ? '…' : t.save}
          </button>
        </td>
      )}
    </tr>
  );
}

function RequestDetail({
  request,
  isAdmin,
  t,
  onChange,
}: {
  request: HRSupportRequest;
  isAdmin: boolean;
  t: typeof EN_STRINGS;
  onChange: (updated: HRSupportRequest) => void;
}) {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<CandidateEvaluation[]>(request.candidateEvaluations ?? []);
  const [reportSummary, setReportSummary] = useState(request.reportSummary ?? '');
  const [delivering, setDelivering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specialists, setSpecialists] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    setEvaluations(request.candidateEvaluations ?? []);
    setReportSummary(request.reportSummary ?? '');
  }, [request]);

  useEffect(() => {
    if (isAdmin && request.status === 'AWAITING_ASSIGNMENT') {
      getHRSpecialists().then(setSpecialists).catch(() => setSpecialists([]));
    }
  }, [isAdmin, request.status]);

  const canEditMatrix = isAdmin || request.assignedSpecialist?.id === user?.id;

  const handleAssign = async () => {
    if (!selectedSpecialistId) return;
    setAssigning(true);
    setError(null);
    try {
      const updated = await assignHRSpecialist(request.id, selectedSpecialistId);
      onChange(updated);
    } catch (err: any) {
      setError(err?.response?.data?.message || t.errGeneric);
    } finally {
      setAssigning(false);
    }
  };

  const handleDeliver = async () => {
    setDelivering(true);
    setError(null);
    try {
      const updated = await deliverHRSupportRequest(request.id, reportSummary);
      onChange(updated);
    } catch (err: any) {
      setError(err?.response?.data?.message || t.errGeneric);
    } finally {
      setDelivering(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      const updated = await confirmHRSupportRequest(request.id);
      onChange(updated);
    } catch (err: any) {
      setError(err?.response?.data?.message || t.errGeneric);
    } finally {
      setConfirming(false);
    }
  };

  const handleResolve = async (resolution: 'RELEASE' | 'REFUND') => {
    setResolving(true);
    setError(null);
    try {
      const updated = await resolveHRSupportDispute(request.id, resolution);
      onChange(updated);
    } catch (err: any) {
      setError(err?.response?.data?.message || t.errGeneric);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {isAdmin && request.status === 'AWAITING_ASSIGNMENT' && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedSpecialistId}
            onChange={(e) => setSelectedSpecialistId(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
          >
            <option value="">{t.assignPlaceholder}</option>
            {specialists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAssign}
            disabled={!selectedSpecialistId || assigning}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {t.assign}
          </button>
        </div>
      )}

      {request.disputeRaisedAt && !request.disputeResolvedAt && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-4">
          <p className="flex items-center gap-1.5 text-xs font-black text-amber-800 dark:text-amber-300 mb-1.5">
            <ShieldAlert className="w-4 h-4" /> {t.disputeRaised}
          </p>
          <p className="text-xs text-amber-800/90 dark:text-amber-200/80 mb-3">{request.disputeReason}</p>
          {isAdmin && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleResolve('RELEASE')}
                disabled={resolving}
                className="text-xs font-bold px-3 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-60"
              >
                {t.resolveRelease}
              </button>
              <button
                type="button"
                onClick={() => handleResolve('REFUND')}
                disabled={resolving}
                className="text-xs font-bold px-3 py-2 rounded-lg bg-red-600 text-white disabled:opacity-60"
              >
                {t.resolveRefund}
              </button>
            </div>
          )}
        </div>
      )}

      {evaluations.length > 0 && (
        <div>
          <h3 className="text-sm font-black text-gray-900 dark:text-white mb-3">{t.matrixTitle}</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
            <table className="min-w-full text-left">
              <thead className="bg-gray-50 dark:bg-slate-800/60">
                <tr className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  <th className="px-3 py-2">Candidate</th>
                  <th className="px-2 py-2">{t.hardSkills}</th>
                  <th className="px-2 py-2">{t.softSkills}</th>
                  <th className="px-2 py-2">{t.taskScore}</th>
                  <th className="px-2 py-2">{t.culturalFit}</th>
                  <th className="px-2 py-2">{t.rank}</th>
                  <th className="px-2 py-2">{t.candidateStatus}</th>
                  <th className="px-2 py-2">{t.meetingLink}</th>
                  <th className="px-2 py-2">{t.notes}</th>
                  {canEditMatrix && <th className="px-2 py-2" />}
                </tr>
              </thead>
              <tbody>
                {evaluations.map((ev) => (
                  <CandidateRow
                    key={ev.id}
                    evaluation={ev}
                    requestId={request.id}
                    canEdit={canEditMatrix}
                    t={t}
                    onSaved={(updated) => setEvaluations((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canEditMatrix && request.status === 'IN_PROGRESS' && (
        <div>
          <h3 className="text-sm font-black text-gray-900 dark:text-white mb-2">{t.deliverTitle}</h3>
          <textarea
            rows={4}
            value={reportSummary}
            onChange={(e) => setReportSummary(e.target.value)}
            placeholder={t.reportPlaceholder}
            className="w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800 px-3.5 py-2.5 text-sm mb-3"
          />
          <button
            type="button"
            onClick={handleDeliver}
            disabled={delivering || reportSummary.trim().length < 20}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {delivering ? t.delivering : t.markDelivered}
          </button>
        </div>
      )}

      {!isAdmin && request.status === 'DELIVERED' && request.requestedBy.id === user?.id && (
        <button
          type="button"
          onClick={handleConfirm}
          disabled={confirming}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {t.confirmDelivery}
        </button>
      )}
    </div>
  );
}

function HRRequestsPortal() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const [requests, setRequests] = useState<HRSupportRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = !!user?.adminRole;
  const hasAccess = isAdmin || !!user?.isHrSpecialist;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = isAdmin ? await getAllHRSupportRequests() : await getHRRequestsAssignedToMe();
      setRequests(data);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!authLoading && hasAccess) load();
  }, [authLoading, hasAccess, load]);

  const selected = requests.find((r) => r.id === selectedId) ?? null;

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    // The list view omits candidateEvaluations — fetch the full detail once
    // a request is actually opened.
    const full = await getHRSupportRequest(id);
    setRequests((prev) => prev.map((r) => (r.id === full.id ? full : r)));
  };

  if (authLoading || (hasAccess && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <p className="text-sm text-gray-400">{t.loading}</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-100 dark:bg-slate-950 px-4">
        <p className="text-sm text-gray-500 dark:text-slate-400">{t.noAccess}</p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="text-xs font-bold px-4 py-2.5 rounded-xl bg-cyan-600 text-white"
        >
          {t.goHome}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Head>
        <title>{`${t.title} | CDC`}</title>
      </Head>
      <SiteHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-black mb-6">{t.title}</h1>

        {requests.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">{t.noRequests}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-2">
              {requests.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelect(r.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-colors ${
                    selectedId === r.id
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{r.vacancy.title}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {r.requestedBy.name} · {t.candidates(r.candidateCount)}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">
                      {r.status}
                    </span>
                    <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{formatGel(r.grossAmount)} {r.currency}</span>
                  </div>
                  {r.disputeRaisedAt && !r.disputeResolvedAt && (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-black text-amber-600 dark:text-amber-400">
                      <ShieldAlert className="w-3 h-3" /> {t.disputeRaised}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="lg:col-span-2">
              {selected ? (
                <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">{selected.vacancy.title}</h2>
                    <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                      {formatGel(selected.grossAmount)} {selected.currency}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-6">
                    {t.employer}: {selected.requestedBy.name} ({selected.requestedBy.email}) · {t.specialist}:{' '}
                    {selected.assignedSpecialist?.name ?? t.unassigned}
                  </p>
                  <RequestDetail
                    request={selected}
                    isAdmin={isAdmin}
                    t={t}
                    onChange={(updated) => setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))}
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-400">←</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HRRequestsPage() {
  return <HRRequestsPortal />;
}
