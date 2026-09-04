import { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { ChevronLeft, UploadCloud, Sparkles, X, GripVertical } from 'lucide-react';
import AdminGuard from '../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../src/components/admin/AdminLayout';
import { parseProjectFromPhotos, createProject, AiProjectDraft } from '../../../src/services/adminProjectsService';

const inputClass = 'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function AiProjectBuilder() {
  const router = useRouter();
  const [photos, setPhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AiProjectDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const handlePhotosChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setPhotos((prev) => [...prev, ...files]);
    setPreviewUrls((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (photos.length === 0) return;
    setError(null);
    setGenerating(true);
    try {
      const result = await parseProjectFromPhotos(photos, notes);
      setDraft(result);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'AI-ს ვერ დაუმუშავებია ფოტოები/ჩანაწერები. სცადეთ თავიდან.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const project = await createProject({
        title: draft.title,
        date: new Date(draft.date).toISOString(),
        location: draft.location,
        shortDescription: draft.shortDescription,
        fullContent: draft.fullContent,
        coverImage: draft.coverImage,
        galleryImages: draft.galleryImages,
        status,
      });
      router.push(`/admin/projects?saved=${project.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'შენახვა ვერ მოხერხდა.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>AI Project Builder | Admin</title>
      </Head>
      <div className="max-w-3xl">
        <Link href="/admin/projects" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 mb-4">
          <ChevronLeft className="w-3.5 h-3.5" /> პროექტებზე დაბრუნება
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            AI Project Builder
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            ატვირთეთ ფოტოები და ჩამოწერეთ ღონისძიების შესახებ — AI ამოიცნობს სათაურს, თარიღს, ადგილს და დაწერს სრულ ტექსტს.
          </p>
        </div>

        {error && <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        {!draft ? (
          <form onSubmit={handleGenerate} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ფოტოები</label>
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-8 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
                <UploadCloud className="w-6 h-6 text-gray-400" />
                <span className="text-sm text-gray-500">დააჭირეთ ფოტოების ასარჩევად (რამდენიმეს ატვირთვა შესაძლებელია)</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotosChange} />
              </label>

              {previewUrls.length > 0 && (
                <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {previewUrls.map((url, i) => (
                    <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      {i === 0 && (
                        <span className="absolute top-1 left-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                          Cover
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity border-none cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {previewUrls.length > 1 && (
                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                  <GripVertical className="w-3 h-3" /> პირველი ფოტო გამოყენებული იქნება, როგორც ყდის სურათი (Cover Image).
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ჩანაწერები / დეტალები</label>
              <textarea
                rows={5}
                className={inputClass}
                placeholder="მაგ: ღონისძიების დასახელება, თარიღი, ადგილი, მონაწილეები, რაც მოხდა..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={generating || photos.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              {generating ? 'AI ამუშავებს…' : 'AI-ს გენერირება'}
            </button>
          </form>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <p className="text-xs font-medium text-emerald-600 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> AI-მ დაწერა — გადახედეთ და საჭიროებისამებრ შეასწორეთ გამოქვეყნებამდე.
            </p>

            <div className="grid grid-cols-6 gap-2">
              {[draft.coverImage, ...draft.galleryImages].map((url, i) => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {i === 0 && (
                    <span className="absolute top-1 left-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                      Cover
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">სათაური</label>
              <input className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">თარიღი</label>
                <input
                  type="date"
                  className={inputClass}
                  value={draft.date.slice(0, 10)}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">ადგილი (არასავალდებულო)</label>
                <input
                  className={inputClass}
                  value={draft.location ?? ''}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value || null })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">მოკლე აღწერა</label>
              <textarea
                rows={2}
                className={inputClass}
                value={draft.shortDescription}
                onChange={(e) => setDraft({ ...draft, shortDescription: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">სრული ტექსტი (HTML)</label>
              <textarea
                rows={10}
                className={`${inputClass} font-mono text-xs`}
                value={draft.fullContent}
                onChange={(e) => setDraft({ ...draft, fullContent: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleSave('PUBLISHED')}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? 'ინახება…' : 'გამოქვეყნება'}
              </button>
              <button
                type="button"
                onClick={() => handleSave('DRAFT')}
                disabled={saving}
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                მონახაზის შენახვა
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="ml-auto text-xs text-gray-500 hover:text-gray-700 bg-transparent border-none cursor-pointer"
              >
                თავიდან დაწყება
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminAiProjectBuilderPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AiProjectBuilder />
      </AdminLayout>
    </AdminGuard>
  );
}
