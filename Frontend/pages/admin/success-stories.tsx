import { useState, useEffect, useCallback, useRef, FormEvent, ChangeEvent } from 'react';
import Head from 'next/head';
import { ExternalLink, Eye, EyeOff } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { SuccessStory } from '../../src/types/successStory';
import { onImageErrorFallback } from '../../src/utils/imageFallback';
import { isImageTooLarge, IMAGE_SIZE_ERROR } from '../../src/utils/imageUpload';
import {
  adminGetSuccessStories,
  createSuccessStory,
  updateSuccessStory,
  deleteSuccessStory,
  uploadSuccessStoryAvatar,
  SuccessStoryPayload,
} from '../../src/services/successStoryService';

const emptyForm: SuccessStoryPayload = {
  studentName: '',
  roleTitle: '',
  courseName: '',
  testimonial: '',
  avatarUrl: '',
  linkedinUrl: '',
  isFeatured: true,
};

function AdminSuccessStoriesDashboard() {
  const [stories, setStories] = useState<SuccessStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SuccessStoryPayload>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStories(await adminGetSuccessStories());
    } catch {
      setError('ისტორიების ჩატვირთვა ვერ მოხერხდა.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startEdit = (story: SuccessStory) => {
    setEditingId(story.id);
    setForm({
      studentName: story.studentName,
      roleTitle: story.roleTitle,
      courseName: story.courseName,
      testimonial: story.testimonial,
      avatarUrl: story.avatarUrl ?? '',
      linkedinUrl: story.linkedinUrl ?? '',
      isFeatured: story.isFeatured,
    });
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isImageTooLarge(file)) {
      setFormError(IMAGE_SIZE_ERROR.ka);
      return;
    }
    setUploading(true);
    setFormError(null);
    try {
      const url = await uploadSuccessStoryAvatar(file);
      setForm((f) => ({ ...f, avatarUrl: url }));
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'ფოტოს ატვირთვა ვერ მოხერხდა.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (form.studentName.trim().length < 2) return setFormError('სახელი ძალიან მოკლეა.');
    if (form.roleTitle.trim().length < 2) return setFormError('პოზიცია სავალდებულოა.');
    if (form.courseName.trim().length < 2) return setFormError('კურსის სახელი სავალდებულოა.');
    if (form.testimonial.trim().length < 10) return setFormError('გამოხმაურება ძალიან მოკლეა.');

    setSubmitting(true);
    try {
      const payload: SuccessStoryPayload = {
        studentName: form.studentName.trim(),
        roleTitle: form.roleTitle.trim(),
        courseName: form.courseName.trim(),
        testimonial: form.testimonial.trim(),
        avatarUrl: form.avatarUrl?.trim() || null,
        linkedinUrl: form.linkedinUrl?.trim() || null,
        isFeatured: form.isFeatured,
      };
      if (editingId) {
        const updated = await updateSuccessStory(editingId, payload);
        setStories((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const created = await createSuccessStory(payload);
        setStories((prev) => [created, ...prev]);
      }
      resetForm();
    } catch {
      setFormError('ისტორიის შენახვა ვერ მოხერხდა. სცადეთ თავიდან.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleFeatured = async (story: SuccessStory) => {
    try {
      const updated = await updateSuccessStory(story.id, { isFeatured: !story.isFeatured });
      setStories((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch {
      setError('სტატუსის შეცვლა ვერ მოხერხდა.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('ნამდვილად გსურთ ისტორიის წაშლა?')) return;
    try {
      await deleteSuccessStory(id);
      setStories((prev) => prev.filter((s) => s.id !== id));
      if (editingId === id) resetForm();
    } catch {
      setError('ისტორიის წაშლა ვერ მოხერხდა.');
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

  return (
    <>
      <Head>
        <title>წარმატების ისტორიები | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">წარმატების ისტორიები</h1>
          <p className="text-sm text-gray-500 mt-1">კურსდამთავრებულთა ისტორიების მართვა, რომლებიც ჩანს მთავარ გვერდსა და კურსების გვერდებზე.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 mb-10">
          <h2 className="text-base font-semibold text-gray-900 mb-6">
            {editingId ? 'ისტორიის რედაქტირება' : 'ახალი ისტორია'}
          </h2>

          {formError && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ფოტო</label>
              <div className="flex items-center gap-4">
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt="გადახედვა" onError={onImageErrorFallback} className="w-16 h-16 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200" />
                )}
                <label className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-50">
                  {uploading ? 'იტვირთება…' : '📁 ატვირთვა'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">სახელი გვარი</label>
                <input
                  type="text"
                  value={form.studentName}
                  onChange={(e) => setForm({ ...form, studentName: e.target.value })}
                  className={inputClass}
                  placeholder="გიორგი გიორგაძე"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">პოზიცია</label>
                <input
                  type="text"
                  value={form.roleTitle}
                  onChange={(e) => setForm({ ...form, roleTitle: e.target.value })}
                  className={inputClass}
                  placeholder="Frontend Developer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">კურსი</label>
                <input
                  type="text"
                  value={form.courseName}
                  onChange={(e) => setForm({ ...form, courseName: e.target.value })}
                  className={inputClass}
                  placeholder="Web Development"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">გამოხმაურება</label>
              <textarea
                rows={4}
                value={form.testimonial}
                onChange={(e) => setForm({ ...form, testimonial: e.target.value })}
                className={inputClass}
                placeholder="სტუდენტის გამოხმაურება კურსის შესახებ..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">LinkedIn URL <span className="text-gray-400 font-normal">(არასავალდებულო)</span></label>
              <input
                type="text"
                value={form.linkedinUrl ?? ''}
                onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                className={inputClass}
                placeholder="https://linkedin.com/in/..."
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.isFeatured ?? true}
                onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              გამოჩნდეს საიტზე (Featured)
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting ? 'ინახება…' : editingId ? 'განახლება' : 'დამატება'}
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
          <h2 className="text-base font-semibold text-gray-900 mb-4">ისტორიები ({stories.length})</h2>
          {error && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : stories.length === 0 ? (
            <p className="text-sm text-gray-500">ისტორიები ჯერ არ არის დამატებული.</p>
          ) : (
            <div className="space-y-3">
              {stories.map((story) => (
                <div key={story.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                  {story.avatarUrl ? (
                    <img src={story.avatarUrl} alt="" onError={onImageErrorFallback} className="w-14 h-14 rounded-full object-cover shrink-0 border border-gray-200" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-100 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">{story.studentName}</h3>
                      {story.linkedinUrl && (
                        <a href={story.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[#0A66C2]">
                          <ExternalLink size={13} />
                        </a>
                      )}
                      {!story.isFeatured && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          დამალული
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{story.roleTitle} · {story.courseName}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{story.testimonial}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleFeatured(story)}
                      title={story.isFeatured ? 'დამალვა' : 'გამოჩენა'}
                      aria-label={story.isFeatured ? 'დამალვა' : 'გამოჩენა'}
                      className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                    >
                      {story.isFeatured ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(story)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50"
                    >
                      რედაქტირება
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(story.id)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50"
                    >
                      წაშლა
                    </button>
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

export default function AdminSuccessStoriesPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminSuccessStoriesDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
