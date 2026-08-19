import { useState, useEffect, useCallback, FormEvent } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { Tutorial } from '../../src/types/tutorial';
import { getTutorials, createTutorial, updateTutorial, deleteTutorial, getEmbedUrl, TutorialPayload } from '../../src/services/tutorialService';

const emptyForm: TutorialPayload = {
  title: '',
  description: '',
  category: '',
  videoUrl: '',
  titleEn: '',
  descriptionEn: '',
  order: 0,
  published: true,
};

function AdminTutorialsDashboard() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<TutorialPayload>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeLangTab, setActiveLangTab] = useState<'ka' | 'en'>('ka');

  const loadTutorials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTutorials();
      setTutorials(data);
    } catch {
      setError('ტუტორიალების ჩატვირთვა ვერ მოხერხდა.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTutorials();
  }, [loadTutorials]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError(null);
    setActiveLangTab('ka');
  };

  const startEdit = (tutorial: Tutorial) => {
    setEditingId(tutorial.id);
    setForm({
      title: tutorial.title,
      description: tutorial.description,
      category: tutorial.category,
      videoUrl: tutorial.videoUrl,
      titleEn: tutorial.titleEn ?? '',
      descriptionEn: tutorial.descriptionEn ?? '',
      order: tutorial.order,
      published: !!tutorial.publishedAt,
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
    if (!getEmbedUrl(form.videoUrl.trim())) {
      return setFormError('ვიდეოს ბმული უნდა იყოს YouTube, Vimeo ან Loom-ის ბმული.');
    }

    setSubmitting(true);
    try {
      const payload: TutorialPayload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        videoUrl: form.videoUrl.trim(),
        titleEn: form.titleEn?.trim() || null,
        descriptionEn: form.descriptionEn?.trim() || null,
        order: form.order ?? 0,
        published: form.published,
      };
      if (editingId) {
        const updated = await updateTutorial(editingId, payload);
        setTutorials((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        const created = await createTutorial(payload);
        setTutorials((prev) => [created, ...prev]);
      }
      resetForm();
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'ტუტორიალის შენახვა ვერ მოხერხდა. სცადეთ თავიდან.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('ნამდვილად გსურთ ტუტორიალის წაშლა?')) return;
    try {
      await deleteTutorial(id);
      setTutorials((prev) => prev.filter((t) => t.id !== id));
      if (editingId === id) resetForm();
    } catch {
      setError('ტუტორიალის წაშლა ვერ მოხერხდა.');
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

  return (
    <>
      <Head>
        <title>ტუტორიალების მართვა | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">ვიდეო ტუტორიალების მართვა</h1>
          <p className="text-sm text-gray-500 mt-1">დაამატეთ, დაარედაქტირეთ ან წაშალეთ ვიდეო ინსტრუქციები (/tutorials გვერდი).</p>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200/80 shadow-md shadow-slate-200/40 transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 p-6 md:p-8 mb-10">
          <h2 className="text-base font-semibold text-gray-900 mb-6">
            {editingId ? 'ტუტორიალის რედაქტირება' : 'ახალი ტუტორიალი'}
          </h2>

          {formError && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
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
                  placeholder="რეგისტრაცია, ციფრული მაღაზია, მენტორობა..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  ვიდეოს ბმული <span className="text-gray-400 font-normal">(YouTube / Vimeo / Loom)</span>
                </label>
                <input
                  type="text"
                  value={form.videoUrl}
                  onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                  className={inputClass}
                  placeholder="https://youtube.com/watch?v=..."
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
                    activeLangTab === tab
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
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
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className={inputClass}
                    placeholder="მაგ. როგორ დავარეგისტრირდე როგორც ბიზნესი"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">აღწერა (KA)</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className={inputClass}
                    placeholder="მოკლე აღწერა, რომელიც გამოჩნდება ბარათზე..."
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Title (EN)</label>
                  <input
                    type="text"
                    value={form.titleEn ?? ''}
                    onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                    className={inputClass}
                    placeholder="Falls back to Georgian if left blank"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (EN)</label>
                  <textarea
                    rows={2}
                    value={form.descriptionEn ?? ''}
                    onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
                    className={inputClass}
                    placeholder="Falls back to Georgian if left blank"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                თანმიმდევრობა <span className="text-gray-400 font-normal">(კატეგორიაში, ნაკლები = უფრო ადრე)</span>
              </label>
              <input
                type="number"
                min={0}
                value={form.order ?? 0}
                onChange={(e) => setForm({ ...form, order: Number(e.target.value) || 0 })}
                className={`${inputClass} max-w-[160px]`}
              />
            </div>

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
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting ? 'ინახება…' : editingId ? 'განახლება' : 'გამოქვეყნება'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  გაუქმება
                </button>
              )}
            </div>
          </form>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">ტუტორიალები ({tutorials.length})</h2>
          {error && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : tutorials.length === 0 ? (
            <p className="text-sm text-gray-500">ტუტორიალები ჯერ არ არის დამატებული.</p>
          ) : (
            <div className="space-y-3">
              {tutorials.map((tutorial) => (
                <div key={tutorial.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                          {tutorial.category}
                        </span>
                        {!tutorial.publishedAt && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                            დრაფტი
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm text-gray-900 truncate mt-1">{tutorial.title}</h3>
                      <p className="text-xs text-gray-500 truncate">{tutorial.description}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Link
                        href={tutorial.videoUrl}
                        target="_blank"
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                      >
                        <ExternalLink size={13} /> ვიდეო
                      </Link>
                      <button
                        type="button"
                        onClick={() => startEdit(tutorial)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50"
                      >
                        რედაქტირება
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tutorial.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50"
                      >
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

export default function AdminTutorialsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminTutorialsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
