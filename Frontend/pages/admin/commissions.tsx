import { useState, useEffect, FormEvent } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import {
  getCommissionsSettings,
  updateCommissionPercentage,
  updateDailyPostLimit,
  PlatformFeeServiceType,
  FeeScheduleRow,
} from '../../src/services/adminCommissionsService';

const SERVICE_TYPE_LABEL: Record<PlatformFeeServiceType, string> = {
  GIG_UNVERIFIED: 'შეკვეთა/გიგი — არავერიფიცირებული ფრილანსერი',
  GIG_VERIFIED: 'შეკვეთა/გიგი — ვერიფიცირებული ფრილანსერი',
  MENTORSHIP: 'მენტორობა',
  HR_SUPPORT: 'HR მხარდაჭერა',
  DIGITAL_PRODUCT: 'ციფრული პროდუქტი',
};

// Fixed display order — matches the enum declaration order in schema.prisma.
const SERVICE_TYPE_ORDER: PlatformFeeServiceType[] = [
  'GIG_UNVERIFIED',
  'GIG_VERIFIED',
  'MENTORSHIP',
  'HR_SUPPORT',
  'DIGITAL_PRODUCT',
];

function FeeScheduleRowForm({ row, onSaved }: { row: FeeScheduleRow; onSaved: (row: FeeScheduleRow) => void }) {
  const [value, setValue] = useState(String(row.commissionPercentage));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      setError('მნიშვნელობა უნდა იყოს 0-სა და 100-ს შორის.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCommissionPercentage(row.serviceType, parsed);
      onSaved(updated);
    } catch {
      setError('შენახვა ვერ მოხერხდა.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-slate-800 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{SERVICE_TYPE_LABEL[row.serviceType]}</p>
        {error && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span className="text-sm text-gray-500 dark:text-slate-400">%</span>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="shrink-0 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {saving ? 'ინახება…' : 'შენახვა'}
      </button>
    </form>
  );
}

function DailyPostLimitForm({ value, onSaved }: { value: number; onSaved: (n: number) => void }) {
  const [input, setInput] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(input, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setError('მნიშვნელობა უნდა იყოს დადებითი მთელი რიცხვი.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateDailyPostLimit(parsed);
      onSaved(updated.dailyPostLimit);
    } catch {
      setError('შენახვა ვერ მოხერხდა.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">დღიური ლიმიტი (ვაკანსია + შეკვეთა ერთად)</p>
        {error && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>}
      </div>
      <input
        type="number"
        min="1"
        step="1"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-20 shrink-0 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="submit"
        disabled={saving}
        className="shrink-0 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {saving ? 'ინახება…' : 'შენახვა'}
      </button>
    </form>
  );
}

export default function AdminCommissionsPage() {
  const [feeSchedule, setFeeSchedule] = useState<FeeScheduleRow[] | null>(null);
  const [dailyPostLimit, setDailyPostLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getCommissionsSettings()
      .then((data) => {
        setFeeSchedule(data.feeSchedule);
        setDailyPostLimit(data.dailyPostLimit);
      })
      .catch(() => setLoadError('პარამეტრების ჩატვირთვა ვერ მოხერხდა.'))
      .finally(() => setLoading(false));
  }, []);

  const sortedSchedule =
    feeSchedule && [...feeSchedule].sort((a, b) => SERVICE_TYPE_ORDER.indexOf(a.serviceType) - SERVICE_TYPE_ORDER.indexOf(b.serviceType));

  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN']}>
      <AdminLayout>
        <Head>
          <title>Commissions & Limits | Admin</title>
        </Head>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">საკომისიოები & გამოქვეყნების ლიმიტები</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Restricted to SuperAdmin.</p>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">იტვირთება…</p>
        ) : loadError ? (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 max-w-xl">{loadError}</div>
        ) : (
          <div className="space-y-10 max-w-xl">
            <section>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">საკომისიოს განაკვეთები</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
                ცვლილება ვრცელდება მხოლოდ ცვლილების შემდეგ დაწყებულ (captured) ტრანზაქციებზე — უკვე ესქროუში მყოფ თანხებზე
                გავლენას არ ახდენს.
              </p>
              <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-md shadow-slate-200/40 dark:shadow-none p-6">
                {sortedSchedule?.map((row) => (
                  <FeeScheduleRowForm
                    key={row.serviceType}
                    row={row}
                    onSaved={(updated) =>
                      setFeeSchedule((prev) => prev!.map((r) => (r.serviceType === updated.serviceType ? updated : r)))
                    }
                  />
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">გამოქვეყნების დღიური ლიმიტი</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
                მოქმედებს ყოველ მოძრავ 24-საათიან ფანჯარაზე, ერთ ანგარიშზე. SuperAdmin ანგარიშები გამონაკლისია.
              </p>
              <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-md shadow-slate-200/40 dark:shadow-none p-6">
                {dailyPostLimit != null && <DailyPostLimitForm value={dailyPostLimit} onSaved={setDailyPostLimit} />}
              </div>
            </section>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}
