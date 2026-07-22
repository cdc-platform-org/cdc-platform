import { useState } from 'react';
import { useTranslation } from 'next-i18next';

interface RemoveCardModalProps {
  last4: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function RemoveCardModal({ last4, onClose, onConfirm }: RemoveCardModalProps) {
  const { t } = useTranslation('settings');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch {
      setError(t('paymentSection.removeError'));
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-[#161f30] rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('removeCardModal.title')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-slate-300 mt-2 leading-relaxed">
          {t('removeCardModal.body', { last4 })}
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="flex-1 rounded-lg border border-gray-300 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            {t('removeCardModal.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {confirming ? t('removeCardModal.confirming') : t('removeCardModal.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
