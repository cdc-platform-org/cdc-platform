import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import RemoveCardModal from '../../src/components/settings/RemoveCardModal';
import DeleteAccountModal from '../../src/components/settings/DeleteAccountModal';
import { useAuth } from '../../src/context/AuthContext';
import { PaymentMethod } from '../../src/types/billing';
import { getPaymentMethods, removePaymentMethod } from '../../src/services/billingService';
import { deleteAccount } from '../../src/services/authService';

function SettingsContent() {
  const { t } = useTranslation('settings');
  const router = useRouter();
  const { logout } = useAuth();

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [removingCard, setRemovingCard] = useState<PaymentMethod | null>(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  const loadPaymentMethods = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const methods = await getPaymentMethods();
      setPaymentMethods(methods);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  const handleRemoveCard = async (paymentMethodId: string) => {
    await removePaymentMethod(paymentMethodId);
    setPaymentMethods((prev) => prev.filter((pm) => pm.id !== paymentMethodId));
  };

  const handleDeleteAccount = async (payload: { password?: string; confirmText?: string }) => {
    await deleteAccount(payload);
    logout();
    router.push({ pathname: '/', query: { toast: 'account_deleted', toastLang: router.locale ?? 'ka' } });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f19] px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('pageTitle')}</h1>
          <a href="/" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
            {t('backToHome')}
          </a>
        </div>

        {/* --- Saved payment method --- */}
        <section className="bg-white dark:bg-[#0e1422] rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {t('paymentSection.title')}
          </h2>

          {loading ? (
            <p className="text-sm text-gray-400">{t('paymentSection.loading')}</p>
          ) : loadError ? (
            <p className="text-sm text-red-600">{t('paymentSection.removeError')}</p>
          ) : paymentMethods.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">{t('paymentSection.empty')}</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-slate-800">
              {paymentMethods.map((pm) => (
                <li key={pm.id} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {pm.brand}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-slate-400">•••• {pm.last4}</span>
                    <span className="text-sm text-gray-400 dark:text-slate-500">
                      {t('paymentSection.expires')} {String(pm.expiryMonth).padStart(2, '0')}/{pm.expiryYear}
                    </span>
                    {pm.isDefault && (
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full">
                        {t('paymentSection.default')}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemovingCard(pm)}
                    className="text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    {t('paymentSection.deleteButton')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --- Danger zone --- */}
        <section className="bg-red-50/50 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-900/50 p-6">
          <h2 className="text-lg font-medium text-red-700 dark:text-red-400 mb-1.5">
            ⚠️ {t('dangerZone.title')}
          </h2>
          <p className="text-sm text-red-600/80 dark:text-red-400/70 mb-4">{t('dangerZone.description')}</p>
          <button
            type="button"
            onClick={() => setShowDeleteAccount(true)}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
          >
            {t('dangerZone.deleteAccountButton')}
          </button>
        </section>
      </div>

      {removingCard && (
        <RemoveCardModal
          last4={removingCard.last4}
          onClose={() => setRemovingCard(null)}
          onConfirm={() => handleRemoveCard(removingCard.id)}
        />
      )}

      {showDeleteAccount && (
        <DeleteAccountModal onClose={() => setShowDeleteAccount(false)} onConfirm={handleDeleteAccount} />
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common', 'settings'])) },
});
