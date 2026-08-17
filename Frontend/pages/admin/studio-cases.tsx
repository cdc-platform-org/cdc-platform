import { useState, useEffect, useCallback, useRef, FormEvent, ChangeEvent } from 'react';
import Head from 'next/head';
import { ArrowUp, ArrowDown, ExternalLink, Star, X } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { StudioCaseStudy } from '../../src/types/studioCaseStudy';
import { onImageErrorFallback } from '../../src/utils/imageFallback';
import { isImageTooLarge, IMAGE_SIZE_ERROR } from '../../src/utils/imageUpload';
import RichTextEditor from '../../src/components/shared/RichTextEditor';
import {
  adminGetStudioCases,
  createStudioCase,
  updateStudioCase,
  deleteStudioCase,
  uploadStudioCaseImage,
  translateStudioCase,
  StudioCasePayload,
} from '../../src/services/studioCaseService';

const emptyForm: StudioCasePayload = {
  title: '',
  clientName: '',
  category: '',
  description: '',
  fullStory: '',
  titleEn: '',
  descriptionEn: '',
  fullStoryEn: '',
  coverImageUrl: '',
  galleryImages: [],
  projectUrl: '',
  videoUrl: '',
  isFeatured: false,
};

function AdminStudioCasesDashboard() {
  const [cases, setCases] = useState<StudioCaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<StudioCasePayload>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeLangTab, setActiveLangTab] = useState<'ka' | 'en'>('ka');
  const [translating, setTranslating] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCases(await adminGetStudioCases());
    } catch {
      setError('ქეისების ჩატვირთვა ვერ მოხერხდა.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError(null);
    setActiveLangTab('ka');
    if (coverInputRef.current) coverInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const startEdit = (item: StudioCaseStudy) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      clientName: item.clientName,
      category: item.category,
      description: item.description,
      fullStory: item.fullStory ?? '',
      titleEn: item.titleEn ?? '',
      descriptionEn: item.descriptionEn ?? '',
      fullStoryEn: item.fullStoryEn ?? '',
      coverImageUrl: item.coverImageUrl ?? '',
      galleryImages: item.galleryImages,
      projectUrl: item.projectUrl ?? '',
      videoUrl: item.videoUrl ?? '',
      isFeatured: item.isFeatured,
    });
    setActiveLangTab('ka');
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAutoTranslate = async () => {
    setFormError(null);
    if (form.title.trim().length < 2 || form.description.trim().length < 5 || !form.fullStory?.trim()) {
      setFormError('თარგმნამდე შეავსეთ ქართული სათაური, აღწერა და სრული ისტორია.');
      return;
    }
    setTranslating(true);
    try {
      const translated = await translateStudioCase({
        title: form.title.trim(),
        description: form.description.trim(),
        fullStory: form.fullStory.trim(),
      });
      setForm((f) => ({ ...f, ...translated }));
      setActiveLangTab('en');
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'თარგმნა ვერ მოხერხდა.');
    } finally {
      setTranslating(false);
    }
  };

  const handleCoverChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isImageTooLarge(file)) {
      setFormError(IMAGE_SIZE_ERROR.ka);
      return;
    }
    setUploadingCover(true);
    setFormError(null);
    try {
      const url = await uploadStudioCaseImage(file);
      setForm((f) => ({ ...f, coverImageUrl: url }));
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'ფოტოს ატვირთვა ვერ მოხერხდა.');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleGalleryChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (Array.from(files).some(isImageTooLarge)) {
      setFormError(IMAGE_SIZE_ERROR.ka);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      return;
    }
    setUploadingGallery(true);
    setFormError(null);
    try {
      const urls = await Promise.all(Array.from(files).map((file) => uploadStudioCaseImage(file)));
      setForm((f) => ({ ...f, galleryImages: [...(f.galleryImages ?? []), ...urls] }));
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'გალერეის ატვირთვა ვერ მოხერხდა.');
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const removeGalleryImage = (url: string) => {
    setForm((f) => ({ ...f, galleryImages: (f.galleryImages ?? []).filter((u) => u !== url) }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (form.title.trim().length < 2) return setFormError('სათაური ძალიან მოკლეა.');
    if (form.clientName.trim().length < 1) return setFormError('კლიენტის სახელი სავალდებულოა.');
    if (form.category.trim().length < 1) return setFormError('კატეგორია სავალდებულოა.');
    if (form.description.trim().length < 5) return setFormError('აღწერა ძალიან მოკლეა.');

    setSubmitting(true);
    try {
      const payload: StudioCasePayload = {
        title: form.title.trim(),
        clientName: form.clientName.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        fullStory: form.fullStory?.trim() || null,
        titleEn: form.titleEn?.trim() || null,
        descriptionEn: form.descriptionEn?.trim() || null,
        fullStoryEn: form.fullStoryEn?.trim() || null,
        coverImageUrl: form.coverImageUrl?.trim() || null,
        galleryImages: form.galleryImages ?? [],
        projectUrl: form.projectUrl?.trim() || null,
        videoUrl: form.videoUrl?.trim() || null,
        isFeatured: form.isFeatured,
      };
      if (editingId) {
        const updated = await updateStudioCase(editingId, payload);
        setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await createStudioCase({ ...payload, order: cases.length });
        setCases((prev) => [...prev, created]);
      }
      resetForm();
    } catch {
      setFormError('შენახვა ვერ მოხერხდა. სცადეთ თავიდან.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleFeatured = async (item: StudioCaseStudy) => {
    try {
      const updated = await updateStudioCase(item.id, { isFeatured: !item.isFeatured });
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch {
      setError('სტატუსის შეცვლა ვერ მოხერხდა.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('ნამდვილად გსურთ ქეისის წაშლა?')) return;
    try {
      await deleteStudioCase(id);
      setCases((prev) => prev.filter((c) => c.id !== id));
      if (editingId === id) resetForm();
    } catch {
      setError('წაშლა ვერ მოხერხდა.');
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= cases.length) return;
    const current = cases[index];
    const target = cases[targetIndex];
    const reordered = [...cases];
    reordered[index] = target;
    reordered[targetIndex] = current;
    setCases(reordered);
    try {
      const [updatedCurrent, updatedTarget] = await Promise.all([
        updateStudioCase(current.id, { order: targetIndex }),
        updateStudioCase(target.id, { order: index }),
      ]);
      setCases((prev) => prev.map((c) => (c.id === updatedCurrent.id ? updatedCurrent : c.id === updatedTarget.id ? updatedTarget : c)));
    } catch {
      setError('თანმიმდევრობის შეცვლა ვერ მოხერხდა.');
      loadCases();
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

  return (
    <>
      <Head>
        <title>CDC Studio ქეისები | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">CDC Studio ქეისები</h1>
          <p className="text-sm text-gray-500 mt-1">მართეთ პორტფოლიოს პროექტები, რომლებიც ჩანან /cases გვერდსა და მთავარ გვერდზე.</p>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200/80 shadow-md shadow-slate-200/40 transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 p-6 md:p-8 mb-10">
          <h2 className="text-base font-semibold text-gray-900 mb-6">
            {editingId ? 'ქეისის რედაქტირება' : 'ახალი ქეისი'}
          </h2>

          {formError && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">გარეკანის ფოტო</label>
              <div className="flex items-center gap-4">
                {form.coverImageUrl ? (
                  <img src={form.coverImageUrl} alt="გადახედვა" onError={onImageErrorFallback} className="w-24 h-16 rounded-lg object-cover border border-gray-200" />
                ) : (
                  <div className="w-24 h-16 rounded-lg bg-gray-100 border border-gray-200" />
                )}
                <label className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-50">
                  {uploadingCover ? 'იტვირთება…' : '📁 ატვირთვა'}
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverChange}
                    className="hidden"
                    disabled={uploadingCover}
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                გალერეის ფოტოები <span className="text-gray-400 font-normal">({(form.galleryImages ?? []).length})</span>
              </label>
              {(form.galleryImages ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {(form.galleryImages ?? []).map((url) => (
                    <div key={url} className="relative">
                      <img src={url} alt="" onError={onImageErrorFallback} className="w-20 h-14 rounded-lg object-cover border border-gray-200" />
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(url)}
                        aria-label="წაშლა"
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center border-none cursor-pointer"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-50">
                {uploadingGallery ? 'იტვირთება…' : '📁 ფოტოების დამატება'}
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleGalleryChange}
                  className="hidden"
                  disabled={uploadingGallery}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">კლიენტი</label>
                <input
                  type="text"
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  className={inputClass}
                  placeholder="შპს მაგალითი"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">კატეგორია</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={inputClass}
                  placeholder="Web Development"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-gray-200">
              <div className="flex gap-1">
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
              <button
                type="button"
                onClick={handleAutoTranslate}
                disabled={translating}
                className="mb-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg disabled:opacity-60"
              >
                {translating ? 'ითარგმნება…' : '✨ Auto-Translate to English'}
              </button>
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
                    placeholder="ონლაინ მაღაზიის დიზაინი"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">მოკლე აღწერა (KA)</label>
                  <RichTextEditor
                    rows={2}
                    value={form.description}
                    onChange={(value) => setForm({ ...form, description: value })}
                    placeholder="მოკლე აღწერა, რომელიც ჩანს ბარათზე..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    სრული ისტორია (KA) <span className="text-gray-400 font-normal">(არასავალდებულო)</span>
                  </label>
                  <RichTextEditor
                    rows={5}
                    value={form.fullStory ?? ''}
                    onChange={(value) => setForm({ ...form, fullStory: value })}
                    placeholder="დეტალური აღწერა პროექტზე, გამოწვევებზე და შედეგებზე..."
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
                    placeholder="Online Store Design"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Short Description (EN)</label>
                  <RichTextEditor
                    rows={2}
                    value={form.descriptionEn ?? ''}
                    onChange={(value) => setForm({ ...form, descriptionEn: value })}
                    placeholder="Short description shown on the card..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Full Story (EN) <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <RichTextEditor
                    rows={5}
                    value={form.fullStoryEn ?? ''}
                    onChange={(value) => setForm({ ...form, fullStoryEn: value })}
                    placeholder="Detailed description of the project, challenges, and results..."
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                ვიდეოს ბმული <span className="text-gray-400 font-normal">(არასავალდებულო — YouTube, Vimeo ან .mp4)</span>
              </label>
              <input
                type="text"
                value={form.videoUrl ?? ''}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                className={inputClass}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">პროექტის ბმული <span className="text-gray-400 font-normal">(არასავალდებულო)</span></label>
              <input
                type="text"
                value={form.projectUrl ?? ''}
                onChange={(e) => setForm({ ...form, projectUrl: e.target.value })}
                className={inputClass}
                placeholder="https://..."
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.isFeatured ?? false}
                onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              გამორჩეული (Featured — ჩანს მთავარ გვერდზე)
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
          <h2 className="text-base font-semibold text-gray-900 mb-4">ქეისები ({cases.length})</h2>
          {error && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : cases.length === 0 ? (
            <p className="text-sm text-gray-500">ქეისები ჯერ არ არის დამატებული.</p>
          ) : (
            <div className="space-y-3">
              {cases.map((item, index) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                  {item.coverImageUrl ? (
                    <img src={item.coverImageUrl} alt="" onError={onImageErrorFallback} className="w-20 h-14 rounded-lg object-cover shrink-0 border border-gray-200" />
                  ) : (
                    <div className="w-20 h-14 rounded-lg bg-gray-100 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">{item.title}</h3>
                      {item.projectUrl && (
                        <a href={item.projectUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600">
                          <ExternalLink size={13} />
                        </a>
                      )}
                      {item.isFeatured && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1">
                          <Star size={10} fill="currentColor" /> Featured
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{item.clientName} · {item.category}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{item.description}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      title="ზემოთ"
                      aria-label="ზემოთ გადატანა"
                      className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === cases.length - 1}
                      title="ქვემოთ"
                      aria-label="ქვემოთ გადატანა"
                      className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFeatured(item)}
                      title={item.isFeatured ? 'გამორჩეულიდან მოხსნა' : 'გამორჩეულად მონიშვნა'}
                      aria-label={item.isFeatured ? 'გამორჩეულიდან მოხსნა' : 'გამორჩეულად მონიშვნა'}
                      className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                    >
                      <Star size={14} fill={item.isFeatured ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50"
                    >
                      რედაქტირება
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
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

export default function AdminStudioCasesPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminStudioCasesDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
