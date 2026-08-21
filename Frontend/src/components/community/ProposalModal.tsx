import { useState, useMemo, useRef, useEffect, FormEvent, ChangeEvent } from 'react';
import { useTranslation } from 'next-i18next';
import { FileText, Upload, ShieldCheck } from 'lucide-react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useAuth } from '../../context/AuthContext';
import { useVerificationDrawer } from '../../context/VerificationDrawerContext';
import { uploadCv } from '../../services/authService';
import { isFreelancerVerified } from '../../types/auth';
import { getFeeSchedule, findRate } from '../../services/commissionsService';

// Fallback only — used until GET /commissions resolves (or if it fails),
// so the calculator never shows 0% while loading. Matches
// platformFeeScheduleService.ts's own FALLBACK_PERCENTAGE on the backend,
// which escrowService.ts itself falls back to under the same condition —
// kept in sync by hand, same posture as that file's "not a shared import"
// comment, since Frontend/Backend can't literally share a TS constant.
const VERIFIED_PLATFORM_FEE_RATE_FALLBACK = 0.2; // 10% bank + 10% CDC
const UNVERIFIED_PLATFORM_FEE_RATE_FALLBACK = 0.25; // 10% bank + 15% CDC

interface ProposalModalProps {
  gigTitle: string;
  clientBudgetAmount: number; // minor units
  currency: string;
  onClose: () => void;
  onSubmit: (data: { proposalNote: string; bidAmount: number; deliveryDays: number }) => Promise<void>;
}

export default function ProposalModal({
  gigTitle,
  clientBudgetAmount,
  currency,
  onClose,
  onSubmit,
}: ProposalModalProps) {
  const { t } = useTranslation('proposals');
  const { user, refreshUser } = useAuth();
  const { openVerificationDrawer } = useVerificationDrawer();
  const verified = !!user && isFreelancerVerified(user);
  const [verifiedRate, setVerifiedRate] = useState(VERIFIED_PLATFORM_FEE_RATE_FALLBACK);
  const [unverifiedRate, setUnverifiedRate] = useState(UNVERIFIED_PLATFORM_FEE_RATE_FALLBACK);
  useEffect(() => {
    getFeeSchedule()
      .then((schedule) => {
        const verifiedPct = findRate(schedule, 'GIG_VERIFIED');
        const unverifiedPct = findRate(schedule, 'GIG_UNVERIFIED');
        if (verifiedPct != null) setVerifiedRate(verifiedPct / 100);
        if (unverifiedPct != null) setUnverifiedRate(unverifiedPct / 100);
      })
      .catch(() => {
        // Fee calculator just keeps showing the fallback rates above — not
        // worth an error banner over a live-rate refresh failing.
      });
  }, []);
  const PLATFORM_FEE_RATE = verified ? verifiedRate : unverifiedRate;
  const [proposedBudget, setProposedBudget] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadingCv, setUploadingCv] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  useEscapeToClose(true, onClose);

  const handleCvChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCv(true);
    setCvError(null);
    try {
      await uploadCv(file);
      await refreshUser();
    } catch (err: any) {
      setCvError(err?.response?.data?.message ?? t('proposalModal.cvUploadError'));
    } finally {
      setUploadingCv(false);
      if (cvInputRef.current) cvInputRef.current.value = '';
    }
  };

  const proposedMajor = parseFloat(proposedBudget) || 0;
  const platformFee = useMemo(() => proposedMajor * PLATFORM_FEE_RATE, [proposedMajor]);
  const netEarnings = useMemo(() => proposedMajor - platformFee, [proposedMajor, platformFee]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (proposedMajor <= 0) {
      setError(t('proposalModal.validation.budget'));
      return;
    }
    const deliveryDaysInt = parseInt(deliveryDays, 10);
    if (!Number.isInteger(deliveryDaysInt) || deliveryDaysInt <= 0) {
      setError(t('proposalModal.validation.delivery'));
      return;
    }
    if (coverLetter.trim().length < 10) {
      setError(t('proposalModal.validation.cover'));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        proposalNote: coverLetter.trim(),
        bidAmount: Math.round(proposedMajor * 100),
        deliveryDays: deliveryDaysInt,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t('proposalModal.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900">{t('proposalModal.title')}</h2>
        <p className="text-sm text-gray-500 mt-1 mb-5">
          {gigTitle} ·{' '}
          <span className="text-gray-400">
            {t('proposalModal.clientBudgetLabel')}: {(clientBudgetAmount / 100).toFixed(2)} {currency}
          </span>
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('proposalModal.proposedBudgetLabel')}
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={proposedBudget}
                onChange={(e) => setProposedBudget(e.target.value)}
                className={inputClass}
                placeholder={t('proposalModal.proposedBudgetPlaceholder') as string}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('proposalModal.deliveryLabel')}
              </label>
              <input
                type="number"
                required
                min="1"
                step="1"
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                className={inputClass}
                placeholder={t('proposalModal.deliveryPlaceholder') as string}
              />
            </div>
          </div>

          {proposedMajor > 0 && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-indigo-900 uppercase tracking-wide">
                {t('proposalModal.feeCalculator.title')}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600" title={t('proposalModal.feeCalculator.tooltip', { rate: PLATFORM_FEE_RATE * 100 }) as string}>
                  {t('proposalModal.feeCalculator.platformFee', { rate: PLATFORM_FEE_RATE * 100 })}
                </span>
                <span className="font-medium text-red-600">
                  -{platformFee.toFixed(2)} {currency}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700 font-medium">{t('proposalModal.feeCalculator.netEarnings')}</span>
                <span className="font-semibold text-emerald-600">
                  {netEarnings.toFixed(2)} {currency}
                </span>
              </div>
              {!verified && (
                <button
                  type="button"
                  onClick={() =>
                    openVerificationDrawer({
                      message: {
                        ka: `გაიარეთ ვერიფიკაცია, რომ პლატფორმის საკომისიო ${unverifiedRate * 100}%-დან ${verifiedRate * 100}%-მდე შემცირდეს.`,
                        en: `Get verified to reduce the platform fee from ${unverifiedRate * 100}% to ${verifiedRate * 100}%.`,
                      },
                    })
                  }
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline bg-transparent border-none p-0 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {t('proposalModal.feeCalculator.verifyLink', { verifiedRate: verifiedRate * 100 })}
                </button>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('proposalModal.coverLetterLabel')}
            </label>
            <textarea
              required
              rows={4}
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              className={inputClass}
              placeholder={t('proposalModal.coverLetterPlaceholder') as string}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('proposalModal.cvLabel')}</label>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50">
                <Upload className="w-4 h-4" />
                {uploadingCv ? t('proposalModal.cvUploading') : user?.cvUrl ? t('proposalModal.cvReplace') : t('proposalModal.cvUpload')}
                <input
                  ref={cvInputRef}
                  type="file"
                  accept="application/pdf,.doc,.docx"
                  onChange={handleCvChange}
                  className="hidden"
                  disabled={uploadingCv}
                />
              </label>
              {user?.cvUrl && (
                <a
                  href={user.cvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {t('proposalModal.cvView')}
                </a>
              )}
            </div>
            {cvError && <p className="text-xs text-red-600 mt-1.5">{cvError}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('proposalModal.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? t('proposalModal.submitting') : t('proposalModal.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
