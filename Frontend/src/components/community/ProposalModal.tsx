import { useState, useMemo, FormEvent } from 'react';
import { useTranslation } from 'next-i18next';

const PLATFORM_FEE_RATE = 0.1; // 10% — shown live as the freelancer types their bid

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
  const [proposedBudget, setProposedBudget] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
                <span className="text-gray-600" title={t('proposalModal.feeCalculator.tooltip', { rate: 10 }) as string}>
                  {t('proposalModal.feeCalculator.platformFee', { rate: 10 })}
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
