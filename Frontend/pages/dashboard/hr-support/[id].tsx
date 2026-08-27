import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { Users, CheckCircle2, ShieldAlert, FileText, Star } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import VideoTutorialLink from '../../../src/components/shared/VideoTutorialLink';
import { getHRSupportRequest, confirmHRSupportRequest, disputeHRSupportRequest } from '../../../src/services/hrSupportService';
import { HRSupportRequest, HRSupportRequestStatus } from '../../../src/types/hrSupport';
import { resolveLocale } from '../../../src/utils/locale';

const EN_STRINGS = {
  loading: 'Loading…',
  notFound: 'This HR Assistance request could not be found, or you do not have access to it.',
  candidates: (n: number) => `${n} candidate${n !== 1 ? 's' : ''} screened`,
  assignedTo: (name: string) => `Assigned specialist: ${name}`,
  notAssignedYet: 'A specialist has not been assigned yet.',
  reportHeading: 'Specialist report',
  candidatesHeading: 'Candidate evaluations',
  noEvaluations: 'No candidate evaluations recorded yet.',
  rank: (n: number) => `Rank #${n}`,
  status: {
    PENDING_PAYMENT: 'Payment pending',
    AWAITING_ASSIGNMENT: 'Awaiting specialist',
    IN_PROGRESS: 'In progress',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
  } as Record<HRSupportRequestStatus, string>,
  escrowHeldNotice: 'Your payment is held in escrow until you confirm delivery or it auto-releases.',
  confirmDelivery: 'Confirm Delivery / Release Escrow',
  confirming: 'Releasing…',
  confirmWarning: 'This releases payment to the specialist and cannot be undone. Confirm the delivered report meets your expectations before continuing.',
  confirmFailed: 'Could not confirm delivery. Please try again.',
  openDispute: 'Open Dispute',
  disputeHint: 'Tell us what went wrong — an admin will review the delivered work and payment before it is released.',
  disputePlaceholder: 'Describe the issue with this delivery…',
  submitDispute: 'Submit Dispute',
  cancel: 'Cancel',
  disputeFailed: 'Could not submit the dispute. Please try again.',
  disputePending: 'Dispute under review',
  disputeResolved: (resolution: string) => `Dispute resolved: ${resolution === 'REFUND' ? 'refunded' : 'released to specialist'}`,
  escrowReleased: 'Payment has been released to the specialist.',
  escrowRefunded: 'Payment has been refunded to you.',
};

const dict = {
  ka: {
    loading: 'იტვირთება…',
    notFound: 'HR დახმარების მოთხოვნა ვერ მოიძებნა, ან არ გაქვთ მასზე წვდომა.',
    candidates: (n: number) => `${n} კანდიდატი გადარჩეული`,
    assignedTo: (name: string) => `დანიშნული სპეციალისტი: ${name}`,
    notAssignedYet: 'სპეციალისტი ჯერ არ არის დანიშნული.',
    reportHeading: 'სპეციალისტის რეპორტი',
    candidatesHeading: 'კანდიდატების შეფასებები',
    noEvaluations: 'კანდიდატების შეფასება ჯერ არ არსებობს.',
    rank: (n: number) => `რანგი #${n}`,
    status: {
      PENDING_PAYMENT: 'გადახდა მიმდინარეობს',
      AWAITING_ASSIGNMENT: 'სპეციალისტის მოლოდინში',
      IN_PROGRESS: 'მიმდინარეობს',
      DELIVERED: 'მზადაა',
      CANCELLED: 'გაუქმებულია',
    } as Record<HRSupportRequestStatus, string>,
    escrowHeldNotice: 'თქვენი გადახდა დაბლოკილია ესქროუში, სანამ არ დაადასტურებთ მიწოდებას ან ავტომატურად არ განთავისუფლდება.',
    confirmDelivery: 'მიწოდების დადასტურება / ესქროუს განთავისუფლება',
    confirming: 'მიმდინარეობს…',
    confirmWarning: 'ეს განთავისუფლებს გადახდას სპეციალისტისთვის და შეუქცევადია. დარწმუნდით, რომ მიწოდებული რეპორტი აკმაყოფილებს თქვენს მოლოდინებს, სანამ გააგრძელებთ.',
    confirmFailed: 'მიწოდების დადასტურება ვერ მოხერხდა. სცადეთ თავიდან.',
    openDispute: 'დავის გახსნა',
    disputeHint: 'გვითხარით რა შეცდომაა — ადმინისტრატორი განიხილავს მიწოდებულ სამუშაოსა და გადახდას მის განთავისუფლებამდე.',
    disputePlaceholder: 'აღწერეთ პრობლემა ამ მიწოდებასთან დაკავშირებით…',
    submitDispute: 'დავის გაგზავნა',
    cancel: 'გაუქმება',
    disputeFailed: 'დავის გაგზავნა ვერ მოხერხდა. სცადეთ თავიდან.',
    disputePending: 'დავა განხილვის პროცესშია',
    disputeResolved: (resolution: string) => `დავა გადაწყვეტილია: ${resolution === 'REFUND' ? 'თანხა დაბრუნებულია' : 'გადახდა განთავისუფლდა სპეციალისტისთვის'}`,
    escrowReleased: 'გადახდა განთავისუფლდა სპეციალისტისთვის.',
    escrowRefunded: 'თანხა დაბრუნებულია თქვენთვის.',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

function formatGel(minorUnits: number, currency: string): string {
  return `${(minorUnits / 100).toFixed(2)} ${currency}`;
}

function HRSupportDetailContent() {
  const router = useRouter();
  const { id } = router.query;
  const lang = resolveLocale(router.locale);
  const t = dict[lang];

  const [request, setRequest] = useState<HRSupportRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [disputing, setDisputing] = useState(false);
  const [disputeReasonInput, setDisputeReasonInput] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (typeof id !== 'string') return;
    setLoading(true);
    try {
      setRequest(await getHRSupportRequest(id));
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirmDelivery = async () => {
    if (!request || !window.confirm(t.confirmWarning)) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const updated = await confirmHRSupportRequest(request.id);
      setRequest(updated);
    } catch (err: any) {
      setConfirmError(err?.response?.data?.message ?? t.confirmFailed);
    } finally {
      setConfirming(false);
    }
  };

  const handleSubmitDispute = async () => {
    if (!request || !disputeReasonInput.trim()) return;
    setSubmittingDispute(true);
    setDisputeError(null);
    try {
      const updated = await disputeHRSupportRequest(request.id, disputeReasonInput.trim());
      setRequest(updated);
      setDisputing(false);
    } catch (err: any) {
      setDisputeError(err?.response?.data?.message ?? t.disputeFailed);
    } finally {
      setSubmittingDispute(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col">
        <SiteHeader />
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-16">{t.loading}</p>
      </div>
    );
  }

  if (notFound || !request) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center gap-4 py-10">
        <SiteHeader />
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.notFound}</p>
        <BackButton fallbackHref="/dashboard/hr-support" />
      </div>
    );
  }

  const disputePending = !!request.disputeRaisedAt && !request.disputeResolvedAt;
  const canActOnEscrow = request.status === 'DELIVERED' && request.escrowStatus === 'HELD_IN_ESCROW' && !request.disputeRaisedAt;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${request.vacancy.title} — HR Assistance | CDC Platform`}</title>
      </Head>
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 w-full">
        <BackButton fallbackHref="/dashboard/hr-support" className="dark:text-slate-400 dark:hover:text-slate-100" />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black tracking-wide flex items-center gap-2">
              <Users className="w-6 h-6 text-cyan-500" />
              {request.vacancy.title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t.candidates(request.candidateCount)} · {formatGel(request.grossAmount, request.currency)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-[11px] font-black uppercase tracking-wide px-3 py-1.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {t.status[request.status]}
            </span>
            <VideoTutorialLink lang={lang} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-6">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {request.assignedSpecialist ? t.assignedTo(request.assignedSpecialist.name) : t.notAssignedYet}
          </p>

          {disputePending && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-3 py-2 text-xs font-bold">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              {t.disputePending}
            </div>
          )}
          {request.disputeResolvedAt && request.disputeResolution && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-2 text-xs font-bold">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              {t.disputeResolved(request.disputeResolution)}
            </div>
          )}
          {!disputePending && !request.disputeResolvedAt && request.escrowStatus === 'HELD_IN_ESCROW' && (
            <p className="mt-3 text-[11px] text-slate-400">{t.escrowHeldNotice}</p>
          )}
          {request.escrowStatus === 'RELEASED' && !request.disputeResolvedAt && (
            <p className="mt-3 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">{t.escrowReleased}</p>
          )}
          {request.escrowStatus === 'REFUNDED' && !request.disputeResolvedAt && (
            <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 font-bold">{t.escrowRefunded}</p>
          )}

          {canActOnEscrow && (
            <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleConfirmDelivery}
                disabled={confirming}
                className="flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-600 text-white border-none cursor-pointer hover:bg-emerald-700 disabled:opacity-60"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {confirming ? t.confirming : t.confirmDelivery}
              </button>
              {!disputing && (
                <button
                  type="button"
                  onClick={() => setDisputing(true)}
                  className="flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl border border-dashed border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 bg-transparent cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {t.openDispute}
                </button>
              )}
            </div>
          )}
          {confirmError && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-2">{confirmError}</p>}

          {disputing && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">{t.disputeHint}</p>
              <textarea
                value={disputeReasonInput}
                onChange={(e) => setDisputeReasonInput(e.target.value)}
                placeholder={t.disputePlaceholder}
                rows={3}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/60 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500/60"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  disabled={submittingDispute || !disputeReasonInput.trim()}
                  onClick={handleSubmitDispute}
                  className="text-xs font-bold text-white bg-amber-600 px-3.5 py-2 rounded-lg border-none cursor-pointer hover:bg-amber-700 disabled:opacity-60"
                >
                  {submittingDispute ? '…' : t.submitDispute}
                </button>
                <button
                  type="button"
                  onClick={() => setDisputing(false)}
                  className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-transparent border-none cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {t.cancel}
                </button>
              </div>
              {disputeError && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1.5">{disputeError}</p>}
            </div>
          )}
        </div>

        {request.reportSummary && (
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-6">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              {t.reportHeading}
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{request.reportSummary}</p>
          </div>
        )}

        <div>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">{t.candidatesHeading}</h2>
          {!request.candidateEvaluations || request.candidateEvaluations.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.noEvaluations}</p>
          ) : (
            <div className="space-y-3">
              {request.candidateEvaluations.map((evaluation) => (
                <div
                  key={evaluation.id}
                  className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-start justify-between gap-4 flex-wrap"
                >
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{evaluation.application.applicant.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{evaluation.application.applicant.email}</p>
                    {evaluation.hrNotes && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{evaluation.hrNotes}</p>}
                  </div>
                  {evaluation.overallRank != null && (
                    <span className="flex items-center gap-1 text-xs font-black text-amber-600 dark:text-amber-400 shrink-0">
                      <Star className="w-3.5 h-3.5" />
                      {t.rank(evaluation.overallRank)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

export default function HRSupportDetailPage() {
  return (
    <ProtectedRoute>
      <HRSupportDetailContent />
    </ProtectedRoute>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common'])) },
});
