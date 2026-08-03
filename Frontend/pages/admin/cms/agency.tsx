import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import Head from 'next/head';
import AdminGuard from '../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../src/components/admin/AdminLayout';
import { AgencyContent, AgencyPortfolioItem } from '../../../src/types/siteContent';
import { getAdminSiteContent, updateSiteContent, uploadCmsImage } from '../../../src/services/siteContentService';
import { resolveBlogImageUrl } from '../../../src/services/blogService';
import { isImageTooLarge, IMAGE_SIZE_ERROR } from '../../../src/utils/imageUpload';

const OBJECT_POSITION: Record<string, string> = {
  top: 'center top',
  center: 'center center',
  bottom: 'center bottom',
  left: 'left center',
  right: 'right center',
};
const POSITION_OPTIONS: { value: NonNullable<AgencyPortfolioItem['imagePosition']>; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'center', label: 'Center' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

const emptyItem: AgencyPortfolioItem = {
  badgeKa: '',
  badgeEn: '',
  titleKa: '',
  titleEn: '',
  subtitleKa: '',
  subtitleEn: '',
  descKa: '',
  descEn: '',
  statusKa: '✓ წარმატებული ქეისი',
  statusEn: '✓ Success Case',
};

const inputClass = 'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function PortfolioItemEditor({
  item,
  onChange,
  onRemove,
}: {
  item: AgencyPortfolioItem;
  onChange: (patch: Partial<AgencyPortfolioItem>) => void;
  onRemove: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isImageTooLarge(file)) {
      setUploadError(IMAGE_SIZE_ERROR.ka);
      e.target.value = '';
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const imageUrl = await uploadCmsImage(file);
      onChange({ imageUrl });
    } catch (err: any) {
      setUploadError(err?.response?.data?.message ?? 'სურათის ატვირთვა ვერ მოხერხდა.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="border border-gray-100 rounded-lg p-4 space-y-3">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Live preview — mirrors the exact object-fit/object-position/zoom
            math the public /agency card uses, so what admins see here is
            what actually ships. */}
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveBlogImageUrl(item.imageUrl)}
              alt=""
              className="w-full h-full object-cover"
              style={{
                objectPosition: OBJECT_POSITION[item.imagePosition ?? 'center'],
                transform: `scale(${(item.imageZoom ?? 100) / 100})`,
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No image</div>
          )}
        </div>
        <div className="space-y-2">
          <label className="inline-block text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer">
            {uploading ? 'იტვირთება…' : item.imageUrl ? '📁 Replace image' : '📁 Upload image'}
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={uploading} />
          </label>
          {item.imageUrl && (
            <button type="button" onClick={() => onChange({ imageUrl: undefined })} className="block text-xs text-red-500 hover:text-red-700">
              Remove image
            </button>
          )}
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

          <div>
            <p className="text-[11px] font-medium text-gray-500 mb-1">Position</p>
            <div className="flex flex-wrap gap-1.5">
              {POSITION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ imagePosition: opt.value })}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded border ${
                    (item.imagePosition ?? 'center') === opt.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-medium text-gray-500 mb-1">Zoom ({item.imageZoom ?? 100}%)</p>
            <input
              type="range"
              min={100}
              max={200}
              value={item.imageZoom ?? 100}
              onChange={(e) => onChange({ imageZoom: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-2">
        <input placeholder="Badge (KA)" value={item.badgeKa} onChange={(e) => onChange({ badgeKa: e.target.value })} className={inputClass} />
        <input placeholder="Badge (EN)" value={item.badgeEn} onChange={(e) => onChange({ badgeEn: e.target.value })} className={inputClass} />
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        <input placeholder="Title (KA)" value={item.titleKa} onChange={(e) => onChange({ titleKa: e.target.value })} className={inputClass} />
        <input placeholder="Title (EN)" value={item.titleEn} onChange={(e) => onChange({ titleEn: e.target.value })} className={inputClass} />
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        <input placeholder="Subtitle (KA)" value={item.subtitleKa} onChange={(e) => onChange({ subtitleKa: e.target.value })} className={inputClass} />
        <input placeholder="Subtitle (EN)" value={item.subtitleEn} onChange={(e) => onChange({ subtitleEn: e.target.value })} className={inputClass} />
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        <textarea rows={2} placeholder="Description (KA)" value={item.descKa} onChange={(e) => onChange({ descKa: e.target.value })} className={inputClass} />
        <textarea rows={2} placeholder="Description (EN)" value={item.descEn} onChange={(e) => onChange({ descEn: e.target.value })} className={inputClass} />
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        <input placeholder="Status (KA)" value={item.statusKa} onChange={(e) => onChange({ statusKa: e.target.value })} className={inputClass} />
        <input placeholder="Status (EN)" value={item.statusEn} onChange={(e) => onChange({ statusEn: e.target.value })} className={inputClass} />
      </div>
      <button type="button" onClick={onRemove} className="text-xs text-red-500 hover:text-red-700">
        Remove project
      </button>
    </div>
  );
}

function AgencyCmsDashboard() {
  const [content, setContent] = useState<AgencyContent>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await getAdminSiteContent<AgencyContent>('agency');
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
      await updateSiteContent('agency', content);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (i: number, patch: Partial<AgencyPortfolioItem>) => {
    const portfolio = [...(content.portfolio ?? [])];
    portfolio[i] = { ...portfolio[i], ...patch };
    setContent({ ...content, portfolio });
  };

  if (loading) {
    return <p className="text-sm text-gray-400">Loading…</p>;
  }

  return (
    <>
      <Head>
        <title>CDC Studio Portfolio CMS | Admin</title>
      </Head>
      <div className="max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">CDC Studio Portfolio CMS</h1>
            <p className="text-sm text-gray-500 mt-1">
              Controls the "Our Portfolio" cards on /agency. Leave empty to keep the bundled default 3 case studies.
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
            <h2 className="font-semibold text-sm text-gray-900">Portfolio Items</h2>
            <button
              type="button"
              onClick={() => setContent({ ...content, portfolio: [...(content.portfolio ?? []), emptyItem] })}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              + Add project
            </button>
          </div>
          {(content.portfolio ?? []).length === 0 && (
            <p className="text-xs text-gray-400 mb-2">Using the bundled default 3 case studies.</p>
          )}
          <div className="space-y-6">
            {(content.portfolio ?? []).map((item, i) => (
              <PortfolioItemEditor
                key={i}
                item={item}
                onChange={(patch) => updateItem(i, patch)}
                onRemove={() => setContent({ ...content, portfolio: (content.portfolio ?? []).filter((_, idx) => idx !== i) })}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function AgencyCmsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AgencyCmsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
