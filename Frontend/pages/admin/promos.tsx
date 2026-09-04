import { useState, useEffect, useCallback, useMemo, FormEvent } from 'react';
import Head from 'next/head';
import { Plus, Trash2, Tag, Power, ChevronDown } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import {
  getPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  PromoCode,
  PromoApplicableType,
} from '../../src/services/adminPromosService';
import { getCourses } from '../../src/services/courseService';
import { getAdminLiveTrainings } from '../../src/services/adminLiveTrainingService';
import { getAdminProducts } from '../../src/services/productService';

const inputClass = 'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

const TYPE_LABEL: Record<PromoApplicableType, string> = {
  ALL: 'ყველა პროდუქტი',
  COURSE: 'კურსი',
  LIVE_TRAINING: 'ლაივ ტრენინგი',
  DIGITAL_PRODUCT: 'ციფრული პროდუქტი',
  AI_TOOL: 'AI ხელსაწყო',
};

interface TargetOption {
  id: string;
  name: string;
}

// No unified paid AI-tool catalog exists in this codebase (Business AI
// tools are free-access, Educator VIP is a trial+billing subscription, not
// a one-off purchase) — English Tutor is the one flat-price AI-tool
// checkout couponService.ts's resolveTargetPrice actually supports today.
// Extend this list as more AI-tool checkouts gain promo support.
const AI_TOOL_OPTIONS: TargetOption[] = [{ id: 'english-tutor', name: 'IMIAKO — AI English Tutor (1 month)' }];

const emptyForm = {
  code: '',
  discountType: 'percent' as 'percent' | 'amount',
  discountValue: '',
  applicableType: 'ALL' as PromoApplicableType,
  applicableTargetIds: [] as string[],
  expiresAt: '',
  maxUses: '',
};

// Interactive multi-select: a bordered, scrollable checkbox list rather
// than a native <select multiple> (which needs ctrl/cmd-click knowledge
// most admins won't have) or a text field of raw ids an admin would have
// to look up by hand — titles are what's shown, ids are what's bound.
function TargetMultiSelect({
  options,
  loading,
  selected,
  onChange,
}: {
  options: TargetOption[];
  loading: boolean;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  if (loading) return <p className="text-xs text-gray-400 py-2">იტვირთება…</p>;
  if (options.length === 0) return <p className="text-xs text-gray-400 py-2">ჩამონათვალი ცარიელია.</p>;

  return (
    <div className="rounded-lg border border-gray-300 max-h-44 overflow-y-auto divide-y divide-gray-100">
      {options.map((opt) => (
        <label key={opt.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
          <input type="checkbox" checked={selected.includes(opt.id)} onChange={() => toggle(opt.id)} className="shrink-0" />
          <span className="truncate">{opt.name}</span>
        </label>
      ))}
    </div>
  );
}

function AdminPromosDashboard() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Fetched once, up front — small catalogs (courses/trainings/products),
  // reused both for the create-form picker and to render real titles (not
  // raw ids) in the promo list below.
  const [courseOptions, setCourseOptions] = useState<TargetOption[]>([]);
  const [trainingOptions, setTrainingOptions] = useState<TargetOption[]>([]);
  const [productOptions, setProductOptions] = useState<TargetOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCodes(await getPromoCodes());
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const [courses, trainings, products] = await Promise.all([
        getCourses().catch(() => []),
        getAdminLiveTrainings().catch(() => []),
        getAdminProducts().catch(() => []),
      ]);
      setCourseOptions(courses.map((c) => ({ id: c.id, name: c.title })));
      setTrainingOptions(trainings.map((t) => ({ id: t.id, name: t.title })));
      setProductOptions(products.map((p) => ({ id: p.id, name: p.title })));
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadOptions();
  }, [load, loadOptions]);

  const optionsForType: TargetOption[] = useMemo(() => {
    switch (form.applicableType) {
      case 'COURSE':
        return courseOptions;
      case 'LIVE_TRAINING':
        return trainingOptions;
      case 'DIGITAL_PRODUCT':
        return productOptions;
      case 'AI_TOOL':
        return AI_TOOL_OPTIONS;
      default:
        return [];
    }
  }, [form.applicableType, courseOptions, trainingOptions, productOptions]);

  // One combined id -> name lookup across every catalog, so the promo list
  // below can show a real title regardless of which type a given code
  // targets, without re-fetching per row.
  const targetNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of [...courseOptions, ...trainingOptions, ...productOptions, ...AI_TOOL_OPTIONS]) {
      map.set(opt.id, opt.name);
    }
    return map;
  }, [courseOptions, trainingOptions, productOptions]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await createPromoCode({
        code: form.code,
        discountPercent: form.discountType === 'percent' ? Number(form.discountValue) : null,
        discountAmount: form.discountType === 'amount' ? Math.round(Number(form.discountValue) * 100) : null,
        applicableType: form.applicableType,
        applicableTargetIds: form.applicableType === 'ALL' ? [] : form.applicableTargetIds,
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

  const handleToggleActive = async (code: PromoCode) => {
    setBusyId(code.id);
    setError(null);
    try {
      await updatePromoCode(code.id, { isActive: !code.isActive });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Unable to update this promo code.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this promo code?')) return;
    setBusyId(id);
    setError(null);
    try {
      await deletePromoCode(id);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Unable to delete this promo code.');
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
          <p className="text-sm text-gray-500 mt-1">
            Discount codes — restrict to a specific course/training/product/AI tool, or leave "ყველა პროდუქტი" for a
            site-wide code.
          </p>
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

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">ვის ეხება (Applicable To)</label>
            <div className="relative">
              <select
                className={`${inputClass} appearance-none pr-9`}
                value={form.applicableType}
                onChange={(e) => setForm({ ...form, applicableType: e.target.value as PromoApplicableType, applicableTargetIds: [] })}
              >
                {(Object.keys(TYPE_LABEL) as PromoApplicableType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {form.applicableType !== 'ALL' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-gray-500">
                  სად გამოიყენება — აირჩიეთ ერთი ან მეტი ({form.applicableTargetIds.length} არჩეული)
                </label>
              </div>
              <TargetMultiSelect
                options={optionsForType}
                loading={optionsLoading}
                selected={form.applicableTargetIds}
                onChange={(ids) => setForm({ ...form, applicableTargetIds: ids })}
              />
              {form.applicableTargetIds.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">აირჩიეთ მინიმუმ ერთი — წინააღმდეგ შემთხვევაში კოდი არასდროს გამოყენებადი იქნება.</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={creating || (form.applicableType !== 'ALL' && form.applicableTargetIds.length === 0)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
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
              <div key={c.id} className={`bg-white border rounded-xl p-4 flex items-center justify-between gap-3 ${c.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <Tag className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-gray-900">{c.code}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                        {TYPE_LABEL[c.applicableType]}
                      </span>
                      {!c.isActive && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.discountPercent ? `${c.discountPercent}% off` : `${((c.discountAmount ?? 0) / 100).toFixed(2)} GEL off`}
                      {c.expiresAt ? ` · Expires ${new Date(c.expiresAt).toLocaleDateString()}` : ''}
                      {' · '}
                      {c.currentUses}
                      {c.maxUses ? `/${c.maxUses}` : ''} used
                      {c.applicableType !== 'ALL' && c.applicableTargetIds.length > 0
                        ? ` · Targets: ${c.applicableTargetIds.map((id) => targetNameById.get(id) ?? id).join(', ')}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => handleToggleActive(c)}
                    title={c.isActive ? 'Deactivate' : 'Activate'}
                    className={`p-1.5 rounded-lg bg-transparent border-none cursor-pointer disabled:opacity-60 ${c.isActive ? 'text-emerald-600 hover:text-emerald-700' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => handleDelete(c.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:text-red-600 bg-transparent border-none cursor-pointer disabled:opacity-60"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
