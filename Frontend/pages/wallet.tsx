import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import ProtectedRoute from '../src/components/auth/ProtectedRoute';
import { getWalletSummary, createPayoutRequest, getMyPayoutRequests, WalletSummary, PayoutRequestRow } from '../src/services/walletService';

function formatGel(minorUnits: number): string {
  return `${(minorUnits / 100).toFixed(2)} ₾`;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  APPROVED: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  REJECTED: 'bg-red-500/10 text-red-400 border-red-500/30',
  PAID: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

function WalletContent() {
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [requests, setRequests] = useState<PayoutRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [iban, setIban] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [walletData, requestsData] = await Promise.all([getWalletSummary(), getMyPayoutRequests()]);
      setSummary(walletData);
      setRequests(requestsData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const minorAmount = Math.round(Number(amount) * 100);
    if (!minorAmount || minorAmount < 100) {
      setError('Enter a valid amount.');
      return;
    }
    setSubmitting(true);
    try {
      await createPayoutRequest(minorAmount, iban);
      setAmount('');
      setIban('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Unable to submit withdrawal request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
      <Head>
        <title>Wallet | CDC</title>
      </Head>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-black mb-6">💰 Wallet</h1>

        {loading || !summary ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 mb-8">
              <p className="text-xs text-slate-400 mb-1">Available Balance</p>
              <p className="text-3xl font-black text-cyan-300">{formatGel(summary.earningsBalance)}</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 mb-8">
              <h2 className="text-sm font-bold mb-4">Request a Withdrawal</h2>
              {error && <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">{error}</div>}
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Amount (GEL)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <input
                  required
                  placeholder="IBAN"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {submitting ? 'Submitting…' : 'Request Withdrawal'}
                </button>
              </form>
            </div>

            <div>
              <h2 className="text-sm font-bold mb-4">Your Requests</h2>
              {requests.length === 0 ? (
                <p className="text-sm text-slate-500">No withdrawal requests yet.</p>
              ) : (
                <div className="space-y-2">
                  {requests.map((r) => (
                    <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold">{formatGel(r.amount)}</p>
                        <p className="text-xs text-slate-500 font-mono">{r.iban}</p>
                        <p className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function WalletPage() {
  return (
    <ProtectedRoute>
      <WalletContent />
    </ProtectedRoute>
  );
}
