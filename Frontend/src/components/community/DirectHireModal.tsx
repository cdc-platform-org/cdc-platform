import { useState, FormEvent } from 'react';
import { useTranslation } from 'next-i18next';
import { Gig } from '../../types/community';
import { CreateDirectOfferPayload } from '../../services/directOfferService';
import ChatBox from './ChatBox';

type ModalStep = 'select' | 'offer' | 'chat';
type OfferSource = 'existing' | 'custom';

interface DirectHireModalProps {
  freelancerId: string;
  freelancerName: string;
  openJobs: Gig[];
  onClose: () => void;
  onSubmit: (payload: CreateDirectOfferPayload) => Promise<void>;
}

export default function DirectHireModal({
  freelancerId,
  freelancerName,
  openJobs,
  onClose,
  onSubmit,
}: DirectHireModalProps) {
  const { t } = useTranslation('proposals');
  const [step, setStep] = useState<ModalStep>('select');
  const [source, setSource] = useState<OfferSource>(openJobs.length > 0 ? 'existing' : 'custom');
  const [selectedGigId, setSelectedGigId] = useState(openJobs[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('GEL');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (message.trim().length < 10) {
      setError(t('directHireModal.validation.message'));
      return;
    }

    let payload: CreateDirectOfferPayload;
    if (source === 'existing') {
      const gig = openJobs.find((g) => g.id === selectedGigId);
      if (!gig) {
        setError(t('directHireModal.validation.job'));
        return;
      }
      payload = {
        freelancerId,
        gigId: gig.id,
        title: gig.title,
        description: gig.description,
        budgetAmount: gig.budgetAmount,
        currency: gig.currency,
        message: message.trim(),
      };
    } else {
      if (title.trim().length < 5) {
        setError(t('directHireModal.validation.title'));
        return;
      }
      if (description.trim().length < 20) {
        setError(t('directHireModal.validation.description'));
        return;
      }
      const budgetMajor = parseFloat(budget);
      if (!budgetMajor || budgetMajor <= 0) {
        setError(t('directHireModal.validation.budget'));
        return;
      }
      payload = {
        freelancerId,
        title: title.trim(),
        description: description.trim(),
        budgetAmount: Math.round(budgetMajor * 100),
        currency,
        message: message.trim(),
      };
    }

    setSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t('directHireModal.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('directHireModal.title', { name: freelancerName })}
        </h2>

        {step === 'select' && (
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => setStep('offer')}
              className="w-full text-left rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              💼 {t('directHireModal.optionOffer')}
            </button>
            <button
              type="button"
              onClick={() => setStep('chat')}
              className="w-full text-left rounded-xl border border-gray-200 px-4 py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              💬 {t('directHireModal.optionChat')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full text-center pt-2 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              {t('directHireModal.cancel')}
            </button>
          </div>
        )}

        {step === 'chat' && (
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => setStep('select')}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              ← {t('directHireModal.cancel')}
            </button>
            <ChatBox otherUserId={freelancerId} otherUserName={freelancerName} />
          </div>
        )}

        {step === 'offer' && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('directHireModal.sourceLabel')}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSource('existing')}
                  disabled={openJobs.length === 0}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
                    source === 'existing'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {t('directHireModal.sourceExisting')}
                </button>
                <button
                  type="button"
                  onClick={() => setSource('custom')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${
                    source === 'custom'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {t('directHireModal.sourceCustom')}
                </button>
              </div>
            </div>

            {source === 'existing' ? (
              openJobs.length === 0 ? (
                <p className="text-sm text-gray-500">{t('directHireModal.noOpenJobs')}</p>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('directHireModal.selectJobLabel')}
                  </label>
                  <select
                    value={selectedGigId}
                    onChange={(e) => setSelectedGigId(e.target.value)}
                    className={inputClass}
                  >
                    {openJobs.map((gig) => (
                      <option key={gig.id} value={gig.id}>
                        {gig.title} — {(gig.budgetAmount / 100).toFixed(2)} {gig.currency}
                      </option>
                    ))}
                  </select>
                </div>
              )
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('directHireModal.titleLabel')}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('directHireModal.descriptionLabel')}
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {t('directHireModal.budgetLabel')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className={inputClass}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
                      <option value="GEL">GEL</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('directHireModal.messageLabel')}
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={inputClass}
                placeholder={t('directHireModal.messagePlaceholder') as string}
              />
            </div>

            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-emerald-800 flex gap-2">
              <span>🔒</span>
              <span>{t('directHireModal.escrowNotice')}</span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t('directHireModal.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting ? t('directHireModal.submitting') : t('directHireModal.submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
