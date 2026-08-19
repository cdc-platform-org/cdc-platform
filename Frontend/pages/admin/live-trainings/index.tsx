import { useState, useEffect, useCallback, FormEvent } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Users } from 'lucide-react';
import AdminGuard from '../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../src/components/admin/AdminLayout';
import { LiveTraining } from '../../../src/types/liveTraining';
import {
  getAdminLiveTrainings,
  createLiveTraining,
  updateLiveTraining,
  deleteLiveTraining,
  LiveTrainingPayload,
} from '../../../src/services/adminLiveTrainingService';

// <input type="datetime-local"> gives "YYYY-MM-DDTHH:mm" (local time, no
// timezone) — the backend requires full ISO 8601. Same UTC-anchoring
// reasoning as PostingForm.tsx's toIsoDatetime for a date-only input,
// except this one keeps the picked wall-clock time as UTC rather than
// reinterpreting it, since there's no separate timezone field to ask the
// admin for.
function toIsoDatetime(local: string): string {
  return local ? `${local}:00.000Z` : '';
}
function toLocalInput(iso: string): string {
  return iso ? iso.slice(0, 16) : '';
}

const emptyForm: LiveTrainingPayload & { scheduledAtLocal: string } = {
  title: '',
  description: '',
  category: '',
  scheduledAt: '',
  scheduledAtLocal: '',
  titleEn: '',
  descriptionEn: '',
  price: null,
  thumbnailUrl: '',
  minCapacity: 0,
  maxCapacity: 15,
  published: true,
};

function AdminLiveTrainingsDashboard() {
  const [trainings, setTrainings] = useState<LiveTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeLangTab, setActiveLangTab] = useState<'ka' | 'en'>('ka');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrainings(await getAdminLiveTrainings());
    } catch {
      setError('ტრენინგების ჩატვირთვა ვერ მოხერხდა.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError(null);
    setActiveLangTab('ka');
  };

  const startEdit = (t: LiveTraining) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      description: t.description,
      category: t.category,
      scheduledAt: t.scheduledAt,
      scheduledAtLocal: toLocalInput(t.scheduledAt),
      titleEn: t.titleEn ?? '',
      descriptionEn: t.descriptionEn ?? '',
      price: t.price,
      thumbnailUrl: t.thumbnailUrl ?? '',
      minCapacity: t.minCapacity,
      maxCapacity: t.maxCapacity,
      published: t.published,
    });
    setActiveLangTab('ka');
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (form.title.trim().length < 3) return setFormError('სათაური ძალიან მოკლეა.');
    if (form.description.trim().length < 10) return setFormError('აღწერა ძალიან მოკლეა.');
    if (!form.category.trim()) return setFormError('კატეგორია სავალდებულოა.');
    if (!form.scheduledAtLocal) return setFormError('თარიღი და დრო სავალდებულოა.');
    if (form.maxCapacity < 1) return setFormError('მაქსიმალური ადგილების რაოდენობა უნდა იყოს მინიმუმ 1.');
    if (form.minCapacity && form.minCapacity > form.maxCapacity) {
      return setFormError('მინიმალური ჯგუფი არ შეიძლება იყოს მაქსიმალურზე მეტი.');
    }

    setSubmitting(true);
    try {
      const payload: LiveTrainingPayload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        scheduledAt: toIsoDatetime(form.scheduledAtLocal),
        titleEn: form.titleEn?.trim() || null,
        descriptionEn: form.descriptionEn?.trim() || null,
        price: form.price,
        thumbnailUrl: form.thumbnailUrl?.trim() || undefined,
        minCapacity: form.minCapacity ?? 0,
        maxCapacity: form.maxCapacity,
        published: form.published,
      };
      if (editingId) {
        const updated = await updateLiveTraining(editingId, payload);
        setTrainings((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        const created = await createLiveTraining(payload);
        setTrainings((prev) => [created, ...prev]);
      }
      resetForm();
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'ტრენინგის შენახვა ვერ მოხერხდა. სცადეთ თავიდან.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('ნამდვილად გსურთ ტრენინგის წაშლა? ყველა რეგისტრაცია წაიშლება.')) return;
    try {
      await deleteLiveTraining(id);
      setTrainings((prev) => prev.filter((t) => t.id !== id));
      if (editingId === id) resetForm();
    } catch {
      setError('ტრენინგის წაშლა ვერ მოხერხდა.');
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

  return (
    <>
      <Head>
        <title>ლაივ ტრენინგები | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">ლაივ ტრენინგები / ვორქშოფები</h1>
          <p className="text-sm text-gray-500 mt-1">შექმენით ერთჯერადი ლაივ სესია და მართეთ რეგისტრირებული ლიდები.</p>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200/80 shadow-md shadow-slate-200/40 transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 p-6 md:p-8 mb-10">
          <h2 className="text-base font-semibold text-gray-900 mb-6">{editingId ? 'ტრენინგის რედაქტირება' : 'ახალი ტრენინგი'}</h2>

          {formError && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">კატეგორია</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={inputClass}
                  placeholder="მარკეტინგი, დიზაინი..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">თარიღი და დრო</label>
                <input
                  type="datetime-local"
                  value={form.scheduledAtLocal}
                  onChange={(e) => setForm({ ...form, scheduledAtLocal: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  ფასი <span className="text-gray-400 font-normal">(თეთრი, ცარიელი = უფასო)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.price ?? ''}
                  onChange={(e) => setForm({ ...form, price: e.target.value ? Number(e.target.value) : null })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">მინ. ჯგუფი</label>
                <input
                  type="number"
                  min={0}
                  value={form.minCapacity ?? 0}
                  onChange={(e) => setForm({ ...form, minCapacity: Number(e.target.value) || 0 })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">მაქს. ადგილები</label>
                <input
                  type="number"
                  min={1}
                  value={form.maxCapacity}
                  onChange={(e) => setForm({ ...form, maxCapacity: Number(e.target.value) || 1 })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex gap-1 border-b border-gray-200">
              {(['ka', 'en'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveLangTab(tab)}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors bg-transparent cursor-pointer ${
                    activeLangTab === tab ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {tab === 'ka' ? '🇬🇪 ქართული' : '🇬🇧 English'}
                </button>
              ))}
            </div>

            {activeLangTab === 'ka' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">სათაური (KA)</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">აღწერა (KA)</label>
                  <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Title (EN)</label>
                  <input type="text" value={form.titleEn ?? ''} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (EN)</label>
                  <textarea rows={3} value={form.descriptionEn ?? ''} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} className={inputClass} />
                </div>
              </>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.published ?? true}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              გამოქვეყნებულია
            </label>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                {submitting ? 'ინახება…' : editingId ? 'განახლება' : 'გამოქვეყნება'}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  გაუქმება
                </button>
              )}
            </div>
          </form>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">ტრენინგები ({trainings.length})</h2>
          {error && <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : trainings.length === 0 ? (
            <p className="text-sm text-gray-500">ტრენინგები ჯერ არ არის დამატებული.</p>
          ) : (
            <div className="space-y-3">
              {trainings.map((t) => (
                <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{t.category}</span>
                        {!t.published && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded">დრაფტი</span>
                        )}
                        {t.isFull && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded">სავსეა</span>
                        )}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            t.minThresholdMet ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 bg-gray-100'
                          }`}
                        >
                          {t.minThresholdMet ? 'მინ. ჯგუფი შევსებულია' : `აკლია ${Math.max(0, t.minCapacity - t.registeredCount)} ადამიანი`}
                        </span>
                      </div>
                      <h3 className="font-semibold text-sm text-gray-900 truncate mt-1">{t.title}</h3>
                      <p className="text-xs text-gray-500">
                        {new Date(t.scheduledAt).toLocaleString()} · {t.registeredCount} / {t.maxCapacity} რეგისტრირებული
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Link
                        href={`/admin/live-trainings/${t.id}/leads`}
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                      >
                        <Users size={13} /> ლიდები ({t.registeredCount})
                      </Link>
                      <button type="button" onClick={() => startEdit(t)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50">
                        რედაქტირება
                      </button>
                      <button type="button" onClick={() => handleDelete(t.id)} className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50">
                        წაშლა
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminLiveTrainingsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminLiveTrainingsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
