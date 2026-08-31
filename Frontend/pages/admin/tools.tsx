import { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import Head from 'next/head';
import { Trash2 } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { ToolCatalogContent, ToolCatalogEntry, ToolCatalogStatus } from '../../src/types/siteContent';
import { getAdminSiteContent, updateSiteContent, uploadCmsImage } from '../../src/services/siteContentService';
import { isImageTooLarge, IMAGE_SIZE_ERROR } from '../../src/utils/imageUpload';
import { resolveBlogImageUrl } from '../../src/services/blogService';

// The 4 real, live self-service SaaS tools this CMS currently covers (see
// marketplace/index.tsx's SAAS_TOOLS and tools.tsx's own cards for where
// these slugs are read) — pre-seeded here so an admin sees every real tool
// immediately rather than an empty list, but the array itself is fully
// admin-editable (add/remove) for whatever gets built next.
const KNOWN_TOOLS: { slug: string; route: string }[] = [
  { slug: 'educator-hub', route: '/dashboard/tools/educator-hub' },
  { slug: 'media-studio', route: '/dashboard/tools/media-studio' },
  { slug: 'english-tutor', route: '/dashboard/english-tutor' },
  { slug: 'proctoring', route: '/dashboard/tools/proctored-exam' },
];

const STATUS_OPTIONS: { value: ToolCatalogStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMING_SOON', label: 'Coming Soon / მალე' },
  { value: 'DISABLED', label: 'Disabled' },
];

function emptyEntry(slug = ''): ToolCatalogEntry {
  return { slug, status: 'ACTIVE' };
}

const inputClass = 'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const labelClass = 'text-[11px] font-medium text-gray-500 mb-1 block';

function featuresToText(features?: string[]): string {
  return (features ?? []).join('\n');
}
function textToFeatures(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function ToolEntryEditor({
  entry,
  onChange,
  onRemove,
}: {
  entry: ToolCatalogEntry;
  onChange: (patch: Partial<ToolCatalogEntry>) => void;
  onRemove: () => void;
}) {
  const known = KNOWN_TOOLS.find((k) => k.slug === entry.slug);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isImageTooLarge(file)) {
      setImageUploadError(IMAGE_SIZE_ERROR.ka);
      return;
    }
    setUploadingImage(true);
    setImageUploadError(null);
    try {
      const url = await uploadCmsImage(file);
      onChange({ imageUrl: url });
    } catch (err: any) {
      setImageUploadError(err?.response?.data?.message ?? 'სურათის ატვირთვა ვერ მოხერხდა.');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="border border-gray-100 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <label className={labelClass}>Slug (matches the tool&apos;s card id — see tools.tsx / marketplace/index.tsx)</label>
          <input placeholder="e.g. educator-hub" value={entry.slug} onChange={(e) => onChange({ slug: e.target.value })} className={inputClass} />
          {known && <p className="text-[11px] text-gray-400 mt-1">Live route: {known.route}</p>}
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select value={entry.status} onChange={(e) => onChange({ status: e.target.value as ToolCatalogStatus })} className={inputClass}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Cover image — shown at the top of the tool&apos;s card in place of the default gradient/icon header</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={entry.imageUrl ?? ''}
            onChange={(e) => onChange({ imageUrl: e.target.value })}
            className={`${inputClass} flex-1`}
            placeholder="https://... (leave empty for the default gradient/icon)"
          />
          <label className="shrink-0 inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-50">
            {uploadingImage ? 'იტვირთება…' : '📁 Upload'}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" disabled={uploadingImage} />
          </label>
        </div>
        {imageUploadError && <p className="text-[11px] text-red-600 mt-1.5">{imageUploadError}</p>}
        {entry.imageUrl && (
          <div className="mt-2 w-40 h-24 rounded-lg overflow-hidden border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveBlogImageUrl(entry.imageUrl)} alt="" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Title (KA)</label>
          <input value={entry.titleKa ?? ''} onChange={(e) => onChange({ titleKa: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Title (EN)</label>
          <input value={entry.titleEn ?? ''} onChange={(e) => onChange({ titleEn: e.target.value })} className={inputClass} />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Subtitle (KA)</label>
          <input value={entry.subtitleKa ?? ''} onChange={(e) => onChange({ subtitleKa: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Subtitle (EN)</label>
          <input value={entry.subtitleEn ?? ''} onChange={(e) => onChange({ subtitleEn: e.target.value })} className={inputClass} />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Badge (KA) — e.g. &quot;🎁 5-დღიანი უფასო პერიოდი&quot;, &quot;👑 VIP 50 ₾/თვე&quot;</label>
          <input value={entry.badgeKa ?? ''} onChange={(e) => onChange({ badgeKa: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Badge (EN)</label>
          <input value={entry.badgeEn ?? ''} onChange={(e) => onChange({ badgeEn: e.target.value })} className={inputClass} />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Pricing label (KA) — e.g. &quot;50 ₾ / თვეში (5 დღე უფასოდ)&quot;</label>
          <input value={entry.pricingLabelKa ?? ''} onChange={(e) => onChange({ pricingLabelKa: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Pricing label (EN)</label>
          <input value={entry.pricingLabelEn ?? ''} onChange={(e) => onChange({ pricingLabelEn: e.target.value })} className={inputClass} />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Description (KA)</label>
          <textarea rows={2} value={entry.descriptionKa ?? ''} onChange={(e) => onChange({ descriptionKa: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Description (EN)</label>
          <textarea rows={2} value={entry.descriptionEn ?? ''} onChange={(e) => onChange({ descriptionEn: e.target.value })} className={inputClass} />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Feature bullets (KA) — one per line</label>
          <textarea rows={3} value={featuresToText(entry.featuresKa)} onChange={(e) => onChange({ featuresKa: textToFeatures(e.target.value) })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Feature bullets (EN) — one per line</label>
          <textarea rows={3} value={featuresToText(entry.featuresEn)} onChange={(e) => onChange({ featuresEn: textToFeatures(e.target.value) })} className={inputClass} />
        </div>
      </div>

      <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
        <Trash2 className="w-3.5 h-3.5" />
        Remove entry
      </button>
    </div>
  );
}

function ToolsCmsDashboard() {
  const [content, setContent] = useState<ToolCatalogContent>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await getAdminSiteContent<ToolCatalogContent>('tool-catalog');
      const existing = row?.content?.tools ?? [];
      // Seed any known tool slug that isn't in the saved content yet so an
      // admin always sees every live tool, even before this CMS has ever
      // been saved — the seeded rows are pure defaults (ACTIVE, no text
      // overrides) so saving immediately is a no-op for pages that read it.
      const missing = KNOWN_TOOLS.filter((k) => !existing.some((e) => e.slug === k.slug)).map((k) => emptyEntry(k.slug));
      setContent({ tools: [...existing, ...missing] });
    } catch {
      setError('Could not load the tool catalog.');
      setContent({ tools: KNOWN_TOOLS.map((k) => emptyEntry(k.slug)) });
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
    setError(null);
    try {
      await updateSiteContent('tool-catalog', content);
      setSaved(true);
    } catch {
      setError('Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const updateEntry = (i: number, patch: Partial<ToolCatalogEntry>) => {
    const tools = [...(content.tools ?? [])];
    tools[i] = { ...tools[i], ...patch };
    setContent({ ...content, tools });
  };

  if (loading) {
    return <p className="text-sm text-gray-400">Loading…</p>;
  }

  return (
    <>
      <Head>
        <title>Tool Catalog CMS | Admin</title>
      </Head>
      <div className="max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Tool Catalog CMS</h1>
            <p className="text-sm text-gray-500 mt-1">
              Controls the title, subtitle, badge, pricing label, description, and feature bullets for each SaaS tool card on /tools and
              /marketplace. Leave a field empty to keep that page&apos;s existing default text.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {saved && <span className="text-xs font-medium text-emerald-600">Saved ✓</span>}
            {error && <span className="text-xs font-medium text-red-600">{error}</span>}
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
            <h2 className="font-semibold text-sm text-gray-900">Tools</h2>
            <button
              type="button"
              onClick={() => setContent({ ...content, tools: [...(content.tools ?? []), emptyEntry()] })}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              + Add tool entry
            </button>
          </div>
          <div className="space-y-6">
            {(content.tools ?? []).map((entry, i) => (
              <ToolEntryEditor
                key={i}
                entry={entry}
                onChange={(patch) => updateEntry(i, patch)}
                onRemove={() => setContent({ ...content, tools: (content.tools ?? []).filter((_, idx) => idx !== i) })}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function ToolsCmsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <ToolsCmsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
