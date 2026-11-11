import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { Gift, Search, Send, Plus } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getAdminGiftCards, deliverGiftCardNow, formatGel, AdminGiftCard, AdminGiftCardTotals } from '../../src/services/giftCardService';
import IssueGiftCardForm from '../../src/components/giftCards/IssueGiftCardForm';

const STATUS_LABEL: Record<AdminGiftCard['status'], { label: string; cls: string }> = {
  PENDING_PAYMENT: { label: 'გადახდის მოლოდინში', cls: 'bg-amber-100 text-amber-800' },
  SCHEDULED: { label: 'დაგეგმილი', cls: 'bg-indigo-100 text-indigo-800' },
  DELIVERED: { label: 'გაგზავნილი', cls: 'bg-emerald-100 text-emerald-800' },
  CANCELLED: { label: 'გაუქმებული', cls: 'bg-slate-100 text-slate-600' },
};

function AdminGiftCardsDashboard() {
  const [rows, setRows] = useState<AdminGiftCard[] | null>(null);
  const [totals, setTotals] = useState<AdminGiftCardTotals | null>(null);
  const [showIssue, setShowIssue] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getAdminGiftCards();
      setRows(res.data);
      setTotals(res.totals);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'ჩატვირთვა ვერ მოხერხდა.');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!rows || !q) return rows ?? [];
    return rows.filter((r) =>
      [r.code, r.recipientName, r.recipientEmail, r.senderName, r.purchaser.name, r.purchaser.email].some((v) => v?.toLowerCase().includes(q))
    );
  }, [rows, query]);

  const deliverNow = async (id: string) => {
    if (!window.confirm('გავაგზავნოთ ეს ბარათი ახლავე?')) return;
    setBusyId(id);
    try {
      await deliverGiftCardNow(id);
      await load();
    } catch (err: any) {
      window.alert(err?.response?.data?.message ?? 'ვერ გაიგზავნა.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Head>
        <title>სასაჩუქრე ბარათები | CDC Admin</title>
      </Head>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Gift className="h-6 w-6 text-indigo-600" /> სასაჩუქრე ბარათები
          </h1>
          <p className="text-sm text-gray-500">
            ყველა ნაყიდი და უფასოდ გაცემული ბარათი. კოდის გამორთვა ან ვადის შეცვლა შეგიძლია „პრომო კოდების“ გვერდზე (კოდები იწყება GIFT-ით). თანხის დაბრუნება: „ფინანსები“.
          </p>
        </div>
          {!showIssue && (
            <button
              type="button"
              onClick={() => setShowIssue(true)}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> უფასო ბარათის გაცემა
            </button>
          )}
        </div>

        {showIssue && <IssueGiftCardForm onClose={() => setShowIssue(false)} onIssued={load} />}

        {totals && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'გაყიდული ბარათები', value: String(totals.soldCount) },
              { label: 'გაყიდვების ჯამი', value: `${formatGel(totals.soldAmount)} ₾` },
              { label: 'უფასოდ გაცემული', value: `${totals.complimentaryCount ?? 0} · ${formatGel(totals.complimentaryAmount ?? 0)} ₾` },
              { label: 'გამოუყენებელი ნაშთი (ვალდებულება)', value: `${formatGel(totals.outstandingBalance)} ₾` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ძებნა: კოდი, სახელი, ელფოსტა"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {!rows ? (
          <p className="text-sm text-gray-400">იტვირთება…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400">ჯერ არცერთი ბარათი არ გაყიდულა.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">კოდი</th>
                  <th className="px-4 py-3">თანხა / ნაშთი</th>
                  <th className="px-4 py-3">მყიდველი / გამცემი</th>
                  <th className="px-4 py-3">მიმღები</th>
                  <th className="px-4 py-3">სტატუსი</th>
                  <th className="px-4 py-3">თარიღი</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-gray-900">
                      {r.code ?? '—'}
                      {r.isActive === false && <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">გამორთული</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{formatGel(r.amount)} ₾</span>
                      {r.balance != null && <span className="block text-xs text-gray-500">ნაშთი: {formatGel(r.balance)} ₾ · {r.uses}× გამოყენება</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block">
                        {r.purchaser.name}
                        {r.complimentary && <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">უფასო</span>}
                      </span>
                      <span className="block text-xs text-gray-500">{r.purchaser.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block">
                        {r.recipientType === 'ORGANIZATION' ? '🏢 ' : ''}
                        {r.recipientName}
                      </span>
                      <span className="block text-xs text-gray-500">{r.recipientEmail ?? 'დაბეჭდვით'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_LABEL[r.status].cls}`}>{STATUS_LABEL[r.status].label}</span>
                      {r.status === 'SCHEDULED' && <span className="mt-1 block text-xs text-gray-500">{new Date(r.deliverAt).toLocaleDateString('ka-GE')}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.createdAt).toLocaleString('ka-GE')}</td>
                    <td className="px-4 py-3">
                      {r.status === 'SCHEDULED' && (
                        <button
                          onClick={() => deliverNow(r.id)}
                          disabled={busyId === r.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:border-indigo-400 disabled:opacity-60"
                        >
                          <Send className="h-3.5 w-3.5" /> ახლავე გაგზავნა
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminGiftCardsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminGiftCardsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
