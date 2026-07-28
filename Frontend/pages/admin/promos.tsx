import { useState, useEffect, useCallback, FormEvent } from 'react';
import Head from 'next/head';
import { Plus, Trash2, Tag } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getPromoCodes, createPromoCode, deletePromoCode, PromoCode } from '../../src/services/adminPromosService';

const inputClass = 'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

const emptyForm = { code: '', discountType: 'percent' as 'percent' | 'amount', discountValue: '', expiresAt: '', maxUses: '' };

function AdminPromosDashboard() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCodes(await getPromoCodes());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await createPromoCode({
        code: form.code,
        discountPercent: form.discountType === 'percent' ? Number(form.discountValue) : null,
        discountAmount: form.discountType === 'amount' ? Math.round(Number(form.discountValue) * 100) : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
      });
      setForm(emptyForm);
      load();
    } catch (err: any) {
      const apiErrors = err?.response?.data?.errors;
      setError(Array.isArray(apiErrors) ? apiErrors.map((e: any) => e.message).join(' ') : err?.response?.data?.message ?? 'Unable to create promo code.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this promo code?')) return;
    setBusyId(id);
    try {
      await deletePromoCode(id);
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Promo Codes | Admin</title>
      </Head>
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Promo Codes</h1>
          <p className="text-sm text-gray-500 mt-1">Discount codes for CDC Business AI subscriptions.</p>
        </div>

        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-6 mb-6 space-y-4">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <input required placeholder="CODE2026" className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            <select className={inputClass} value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as 'percent' | 'amount' })}>
              <option value="percent">% Discount</option>
              <option value="amount">Fixed Amount (GEL)</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <input required type="number" min="1" placeholder={form.discountType === 'percent' ? 'e.g. 20' : 'e.g. 10.00'} className={inputClass} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
            <input type="date" className={inputClass} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} placeholder="Expires (optional)" />
            <input type="number" min="1" placeholder="Max uses (optional)" className={inputClass} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
          </div>
          <button type="submit" disabled={creating} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
            <Plus className="w-4 h-4" />
            {creating ? 'Creating…' : 'Create Promo Code'}
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : codes.length === 0 ? (
          <p className="text-sm text-gray-500">No promo codes yet.</p>
        ) : (
          <div className="space-y-2">
            {codes.map((c) => (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  <div>
                    <span className="font-mono font-semibold text-gray-900">{c.code}</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.discountPercent ? `${c.discountPercent}% off` : `${((c.discountAmount ?? 0) / 100).toFixed(2)} GEL off`}
                      {c.expiresAt ? ` · Expires ${new Date(c.expiresAt).toLocaleDateString()}` : ''}
                      {' · '}{c.currentUses}{c.maxUses ? `/${c.maxUses}` : ''} used
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => handleDelete(c.id)}
                  className="text-red-500 hover:text-red-600 bg-transparent border-none cursor-pointer disabled:opacity-60"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminPromosPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminPromosDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
