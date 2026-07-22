import { useState, FormEvent } from 'react';
import { useTranslation } from 'next-i18next';

interface DeleteAccountModalProps {
  onClose: () => void;
  onConfirm: (payload: { password?: string; confirmText?: string }) => Promise<void>;
}

export default function DeleteAccountModal({ onClose, onConfirm }: DeleteAccountModalProps) {
  const { t } = useTranslation('settings');
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmText.trim();
    if (!trimmedPassword && trimmedConfirm !== 'DELETE') {
      setError(t('deleteAccountModal.validation'));
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm(
        trimmedPassword ? { password: trimmedPassword } : { confirmText: trimmedConfirm }
      );
    } catch (err: any) {
      const status = err?.response?.status;
      setError(status === 401 ? t('deleteAccountModal.wrongPassword') : t('deleteAccountModal.error'));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-[#161f30] rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-red-600">{t('deleteAccountModal.title')}</h2>
        <p className="text-sm text-gray-700 dark:text-slate-300 mt-2 leading-relaxed">
          {t('deleteAccountModal.warning')}
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            {t('deleteAccountModal.confirmMethodLabel')}
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5">
              {t('deleteAccountModal.passwordLabel')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (e.target.value) setConfirmText('');
              }}
              placeholder={t('deleteAccountModal.passwordPlaceholder') as string}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-[#0e1422] dark:text-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
            <span className="text-xs font-medium text-gray-400">{t('deleteAccountModal.orDivider')}</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5">
              {t('deleteAccountModal.confirmTextLabel')}
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                if (e.target.value) setPassword('');
              }}
              placeholder={t('deleteAccountModal.confirmTextPlaceholder') as string}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-[#0e1422] dark:text-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-gray-300 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
            >
              {t('deleteAccountModal.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {submitting ? t('deleteAccountModal.confirming') : t('deleteAccountModal.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
