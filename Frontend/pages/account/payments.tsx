import { useState, useEffect, useCallback } from 'react';
import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import { PaymentMethod, Invoice } from '../../src/types/billing';
import {
  getPaymentMethods,
  removePaymentMethod,
  getBillingHistory,
  getInvoiceDownloadUrl,
} from '../../src/services/billingService';

function PaymentsPageContent() {
  const { t } = useTranslation('billing');

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [methods, history] = await Promise.all([
        getPaymentMethods(),
        getBillingHistory(),
      ]);
      setPaymentMethods(methods);
      setInvoices(history.invoices);
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      await removePaymentMethod(id);
      setPaymentMethods((prev) => prev.filter((pm) => pm.id !== id));
    } catch {
      setError(t('removeError'));
    } finally {
      setRemovingId(null);
      setConfirmingRemoveId(null);
    }
  };

  const handleDownload = async (invoiceId: string) => {
    try {
      const url = await getInvoiceDownloadUrl(invoiceId);
      window.open(url, '_blank');
    } catch {
      setError(t('downloadError'));
    }
  };

  const statusBadgeClass = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'refunded':
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">{t('pageTitle')}</h1>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* --- Saved payment methods --- */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('savedCards.title')}</h2>

          {loading ? (
            <p className="text-sm text-gray-400">{t('loading')}</p>
          ) : paymentMethods.length === 0 ? (
            <p className="text-sm text-gray-500">{t('savedCards.empty')}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {paymentMethods.map((pm) => (
                <li key={pm.id} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900 capitalize">{pm.brand}</span>
                    <span className="text-sm text-gray-500">•••• {pm.last4}</span>
                    <span className="text-sm text-gray-400">
                      {String(pm.expiryMonth).padStart(2, '0')}/{pm.expiryYear}
                    </span>
                    {pm.isDefault && (
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                        {t('savedCards.default')}
                      </span>
                    )}
                  </div>

                  {confirmingRemoveId === pm.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">{t('savedCards.confirmRemove')}</span>
                      <button
                        onClick={() => handleRemove(pm.id)}
                        disabled={removingId === pm.id}
                        className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {removingId === pm.id ? t('savedCards.removing') : t('savedCards.confirmYes')}
                      </button>
                      <button
                        onClick={() => setConfirmingRemoveId(null)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        {t('savedCards.confirmNo')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingRemoveId(pm.id)}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      {t('savedCards.remove')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --- Billing history --- */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('billingHistory.title')}</h2>

          {loading ? (
            <p className="text-sm text-gray-400">{t('loading')}</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-gray-500">{t('billingHistory.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-3 font-medium">{t('billingHistory.columns.invoice')}</th>
                    <th className="pb-3 font-medium">{t('billingHistory.columns.description')}</th>
                    <th className="pb-3 font-medium">{t('billingHistory.columns.amount')}</th>
                    <th className="pb-3 font-medium">{t('billingHistory.columns.status')}</th>
                    <th className="pb-3 font-medium">{t('billingHistory.columns.date')}</th>
                    <th className="pb-3 font-medium text-right">{t('billingHistory.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-3 text-gray-900">{inv.invoiceNumber}</td>
                      <td className="py-3 text-gray-600">{inv.description}</td>
                      <td className="py-3 text-gray-900">
                        {inv.amount} {inv.currency}
                      </td>
                      <td className="py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusBadgeClass(inv.status)}`}
                        >
                          {t(`billingHistory.status.${inv.status}`)}
                        </span>
                      </td>
                      <td className="py-3 text-gray-500">
                        {new Date(inv.issuedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleDownload(inv.id)}
                          disabled={!inv.pdfDownloadUrl}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {t('billingHistory.download')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <ProtectedRoute>
      <PaymentsPageContent />
    </ProtectedRoute>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['billing'])) },
});