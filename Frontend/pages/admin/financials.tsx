import { useState, useEffect, useCallback, FormEvent } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { AdminTransaction, BogSettings } from '../../src/types/adminPanel';
import { getTransactions, getBogSettings, updateBogSettings } from '../../src/services/adminPanelService';

function formatMoney(minorUnits: number, currency: string): string {
  return `${(minorUnits / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

const STATUS_BADGE: Record<string, string> = {
  HELD_IN_ESCROW: 'bg-amber-50 text-amber-700 border-amber-200',
  RELEASED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REFUNDED: 'bg-gray-100 text-gray-600 border-gray-200',
  DISPUTED: 'bg-rose-50 text-rose-700 border-rose-200',
};

function TransactionsSection() {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getTransactions(page, pageSize);
      setTransactions(result.data);
      setTotalCount(result.totalCount);
    } catch {
      setError('Unable to load transactions.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 mb-4">Transactions ({totalCount})</h2>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-gray-500">No transactions yet.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 font-medium">Gig</th>
                  <th className="px-4 py-3 font-medium">Client → Freelancer</th>
                  <th className="px-4 py-3 font-medium text-right">Gross</th>
                  <th className="px-4 py-3 font-medium text-right">Commission</th>
                  <th className="px-4 py-3 font-medium text-right">Net</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate">{tx.gig.title}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {tx.client.name} → {tx.freelancer.name}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatMoney(tx.grossAmount, tx.currency)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {formatMoney(tx.commissionAmount, tx.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-700">
                      {formatMoney(tx.netAmount, tx.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_BADGE[tx.status] ?? ''}`}
                      >
                        {tx.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-4 border-t border-gray-100">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-xs font-medium text-gray-600 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="text-xs font-medium text-gray-600 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function BogSettingsSection() {
  const [settings, setSettings] = useState<BogSettings | null>(null);
  const [clientId, setClientId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getBogSettings()
      .then((data) => {
        if (data) {
          setSettings(data);
          setClientId(data.clientId ?? '');
          setIsLiveMode(data.isLiveMode);
        }
      })
      .catch(() => setError('Unable to load BOG settings.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload: Record<string, string | boolean> = { clientId, isLiveMode };
      if (secretKey.trim()) payload.secretKey = secretKey.trim();
      const updated = await updateBogSettings(payload);
      setSettings(updated);
      setSecretKey('');
      setSuccess(true);
    } catch {
      setError('Unable to save BOG settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono';

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 mb-1">BOG (Bank of Georgia) Settings</h2>
      <p className="text-xs text-gray-500 mb-4">
        OAuth2 Client ID / Secret Key used to authenticate with the live BOG Payment API. These are a fallback —
        if BOG_CLIENT_ID / BOG_SECRET_KEY environment variables are set on the server, those take priority. Secrets
        are masked once saved and never shown in full again.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 max-w-xl">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
              Settings saved.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Client ID</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={inputClass}
              placeholder="BOG-CLIENT-ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Secret Key {settings?.secretKey && <span className="text-gray-400 font-normal">(current: {settings.secretKey})</span>}
            </label>
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className={inputClass}
              placeholder="Leave blank to keep current"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isLiveMode}
              onChange={(e) => setIsLiveMode(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Live mode (real transactions)
          </label>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </form>
      )}
    </section>
  );
}

export default function AdminFinancialsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN']}>
      <AdminLayout>
        <Head>
          <title>Financials & BOG | Admin</title>
        </Head>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Financials & BOG Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">Restricted to SuperAdmin.</p>
        </div>
        <div className="space-y-10">
          <TransactionsSection />
          <BogSettingsSection />
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
