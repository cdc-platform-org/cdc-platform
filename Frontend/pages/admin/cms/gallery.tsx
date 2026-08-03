import { useState, useEffect, useCallback, useRef, ChangeEvent, DragEvent } from 'react';
import Head from 'next/head';
import AdminGuard from '../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../src/components/admin/AdminLayout';
import { GalleryContent, GalleryImage } from '../../../src/types/siteContent';
import { getAdminSiteContent, updateSiteContent, uploadCmsImage } from '../../../src/services/siteContentService';
import { resolveBlogImageUrl } from '../../../src/services/blogService';
import { isImageTooLarge, IMAGE_SIZE_ERROR } from '../../../src/utils/imageUpload';

const inputClass = 'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function GalleryCmsDashboard() {
  const [content, setContent] = useState<GalleryContent>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await getAdminSiteContent<GalleryContent>('gallery');
      setContent(row?.content ?? {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      // Drop any "+ Add by URL" rows left blank — an empty url would
      // resolve to the bare API origin and render as a broken image on the
      // public /gallery page and the homepage preview grid.
      const cleaned = { ...content, images: (content.images ?? []).filter((img) => img.url.trim().length > 0) };
      await updateSiteContent('gallery', cleaned);
      setContent(cleaned);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const images = content.images ?? [];

  const updateImage = (i: number, patch: Partial<GalleryImage>) => {
    const next = [...images];
    next[i] = { ...next[i], ...patch };
    setContent({ ...content, images: next });
  };

  const removeImage = (i: number) => {
    setContent({ ...content, images: images.filter((_, idx) => idx !== i) });
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    const oversized = files.filter(isImageTooLarge);
    const toUpload = files.filter((f) => !isImageTooLarge(f));
    setUploadError(oversized.length > 0 ? IMAGE_SIZE_ERROR.ka : null);
    if (toUpload.length === 0) return;

    setUploading(true);
    setUploadProgress({ done: 0, total: toUpload.length });
    let failures = 0;
    for (const file of toUpload) {
      try {
        const url = await uploadCmsImage(file);
        // Functional update — each upload appends to whatever content is
        // current at that moment, so a prior upload's result in this same
        // batch is never clobbered by a stale closure over `images`.
        setContent((prev) => ({ ...prev, images: [...(prev.images ?? []), { url }] }));
      } catch {
        failures += 1;
      } finally {
        setUploadProgress((prev) => (prev ? { done: prev.done + 1, total: prev.total } : prev));
      }
    }
    if (failures > 0) {
      setUploadError(`${failures} სურათის ატვირთვა ვერ მოხერხდა.`);
    }
    setUploading(false);
    setUploadProgress(null);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) await handleFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) await handleFiles(e.dataTransfer.files);
  };

  if (loading) {
    return <p className="text-sm text-gray-400">Loading…</p>;
  }

  return (
    <>
      <Head>
        <title>Photo Gallery CMS | Admin</title>
      </Head>
      <div className="max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Photo Gallery</h1>
            <p className="text-sm text-gray-500 mt-1">
              Images shown on the public /gallery page and the homepage's "CDC Life" preview grid.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saved && <span className="text-xs font-medium text-emerald-600">Saved ✓</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm text-gray-900">Images ({images.length})</h2>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer">
                {uploading && uploadProgress ? `იტვირთება ${uploadProgress.done}/${uploadProgress.total}…` : '📁 Upload images'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
              <button
                type="button"
                onClick={() => setContent({ ...content, images: [...images, { url: '' }] })}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                + Add by URL
              </button>
            </div>
          </div>
          {uploadError && <p className="text-xs text-red-600 mb-3">{uploadError}</p>}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`rounded-lg transition-colors ${dragActive ? 'ring-2 ring-indigo-400 bg-indigo-50/50' : ''}`}
          >
            {images.length === 0 ? (
              <p className="text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                No images yet — drag & drop images here, upload, or add by URL.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {images.map((img, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3 flex gap-3">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    {img.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolveBlogImageUrl(img.url)} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <input
                      value={img.url}
                      onChange={(e) => updateImage(i, { url: e.target.value })}
                      className={inputClass}
                      placeholder="Image URL"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        value={img.captionKa ?? ''}
                        onChange={(e) => updateImage(i, { captionKa: e.target.value })}
                        className={inputClass}
                        placeholder="Caption (KA)"
                      />
                      <input
                        value={img.captionEn ?? ''}
                        onChange={(e) => updateImage(i, { captionEn: e.target.value })}
                        className={inputClass}
                        placeholder="Caption (EN)"
                      />
                    </div>
                    <button type="button" onClick={() => removeImage(i)} className="text-xs text-red-500 hover:text-red-700">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function GalleryCmsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <GalleryCmsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
