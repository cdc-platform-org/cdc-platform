import { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Trash2, ExternalLink } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { ToolCatalogContent, ToolCatalogEntry, ToolCatalogStatus, ToolCatalogCategory } from '../../src/types/siteContent';
import { getAdminSiteContent, updateSiteContent, uploadCmsImage } from '../../src/services/siteContentService';
import { isImageTooLarge, IMAGE_SIZE_ERROR } from '../../src/utils/imageUpload';
import { resolveBlogImageUrl } from '../../src/services/blogService';
import { resolveToolCategory } from '../../src/utils/toolCatalog';
import { PRODUCT_CATALOG_REGISTRY } from '../../src/data/productCatalogRegistry';
import { SITE_LOCALES, SiteLocale } from '../../src/utils/seo';

// Every real, live AI Tool / AI Teacher / Children's Book this CMS covers —
// pre-seeded from the single shared registry (src/data/
// productCatalogRegistry.ts, also used by marketplace/index.tsx and
// courses/index.tsx) so an admin sees every real entry immediately rather
// than an empty or stale list — this used to be its own separately
// hand-maintained 4-entry copy that had already drifted from the real
// 6-entry list marketplace/index.tsx's SAAS_TOOLS actually renders
// (missing smart-reader and childrens-book). The array below is still
// fully admin-editable (add/remove) for whatever gets built next.
const KNOWN_TOOLS: { slug: string; route: string }[] = PRODUCT_CATALOG_REGISTRY.map(({ slug, route }) => ({ slug, route }));

const STATUS_OPTIONS: { value: ToolCatalogStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMING_SOON', label: 'Coming Soon / მალე' },
  { value: 'DISABLED', label: 'Disabled' },
];

const CATEGORY_OPTIONS: { value: ToolCatalogCategory; label: string }[] = [
  { value: 'AI_TOOL', label: 'AI Tool' },
  { value: 'AI_TEACHER', label: 'AI Teacher' },
  { value: 'DIGITAL_PRODUCT_LINK', label: "Digital Store (e.g. Children's Book)" },
];

const LOCALE_LABELS: Record<SiteLocale, string> = {
  ka: 'ქართული (KA)',
  en: 'English (EN)',
  de: 'Deutsch (DE)',
  es: 'Español (ES)',
  fr: 'Français (FR)',
  uk: 'Українська (UK)',
  tr: 'Türkçe (TR)',
  hy: 'Հայերեն (HY)',
  az: 'Azərbaycan (AZ)',
};

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
  const detailPageHref = entry.slug ? `/products/${entry.slug}` : null;

  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeLocale, setActiveLocale] = useState<SiteLocale>('ka');

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
        <div>
          <label className={labelClass}>Type — drives the unified Products admin filter and public placement</label>
          <select value={resolveToolCategory(entry)} onChange={(e) => onChange({ category: e.target.value as ToolCatalogCategory })} className={inputClass}>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {detailPageHref && (
        <a href={detailPageHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800">
          View public detail page <ExternalLink className="w-3 h-3" />
        </a>
      )}

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
          <label className={labelClass}>Short description (KA) — shown on the card</label>
          <textarea rows={2} value={entry.descriptionKa ?? ''} onChange={(e) => onChange({ descriptionKa: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Short description (EN)</label>
          <textarea rows={2} value={entry.descriptionEn ?? ''} onChange={(e) => onChange({ descriptionEn: e.target.value })} className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>
          Instruction/demo video — a pasted YouTube, Vimeo, or direct hosted file link. Shown as a &quot;▶ Watch how to use&quot; button on the
          detail page; the button itself doesn&apos;t appear at all when this is empty or unparseable.
        </label>
        <input
          value={entry.videoUrl ?? ''}
          onChange={(e) => onChange({ videoUrl: e.target.value })}
          className={inputClass}
          placeholder="https://www.youtube.com/watch?v=... (leave empty for no video button)"
        />
        {!entry.videoUrl && <p className="text-[11px] text-gray-400 mt-1">No instruction video configured.</p>}
      </div>

      <div>
        <label className={labelClass}>
          Title / subtitle / short description / full description — per locale. Leave a locale blank to keep its existing KA/EN default (above).
          Russian is never offered (platform policy).
        </label>
        <div className="flex flex-wrap gap-1 mb-2">
          {SITE_LOCALES.map((locale) => {
            const hasOverride = !!(
              entry.titleLocales?.[locale]?.trim() ||
              entry.subtitleLocales?.[locale]?.trim() ||
              entry.descriptionLocales?.[locale]?.trim() ||
              entry.fullDescriptionLocales?.[locale]?.trim()
            );
            return (
              <button
                key={locale}
                type="button"
                onClick={() => setActiveLocale(locale)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded flex items-center gap-1 ${
                  activeLocale === locale ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {LOCALE_LABELS[locale]}
                {hasOverride && <span className={`w-1.5 h-1.5 rounded-full ${activeLocale === locale ? 'bg-white' : 'bg-emerald-500'}`} />}
              </button>
            );
          })}
        </div>
        <div className="grid gap-2">
          <div>
            <label className={labelClass}>Title ({activeLocale.toUpperCase()})</label>
            <input
              value={entry.titleLocales?.[activeLocale] ?? ''}
              onChange={(e) => onChange({ titleLocales: { ...entry.titleLocales, [activeLocale]: e.target.value } })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Subtitle ({activeLocale.toUpperCase()})</label>
            <input
              value={entry.subtitleLocales?.[activeLocale] ?? ''}
              onChange={(e) => onChange({ subtitleLocales: { ...entry.subtitleLocales, [activeLocale]: e.target.value } })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Short description ({activeLocale.toUpperCase()})</label>
            <textarea
              rows={2}
              value={entry.descriptionLocales?.[activeLocale] ?? ''}
              onChange={(e) => onChange({ descriptionLocales: { ...entry.descriptionLocales, [activeLocale]: e.target.value } })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Full description ({activeLocale.toUpperCase()}) — detail page only</label>
            <textarea
              rows={4}
              value={entry.fullDescriptionLocales?.[activeLocale] ?? ''}
              onChange={(e) => onChange({ fullDescriptionLocales: { ...entry.fullDescriptionLocales, [activeLocale]: e.target.value } })}
              className={inputClass}
            />
          </div>
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
        <title>AI Tools / AI Teachers CMS | Admin</title>
      </Head>
      <div className="max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">AI Tools / AI Teachers / Children&apos;s Book CMS</h1>
            <p className="text-sm text-gray-500 mt-1">
              Controls cover image, instruction video, and title/subtitle/description (short + full, in all 9 CDC locales) for every AI Tool, AI
              Teacher, and the Children&apos;s Book listing — shown on their cards on /marketplace and /courses, and on each one&apos;s public
              /products/[slug] detail page. Leave a field empty to keep that page&apos;s existing default text. See also{' '}
              <Link href="/admin/product-catalog" className="text-indigo-600 hover:text-indigo-800">
                the unified Products list
              </Link>{' '}
              for Digital Store products alongside these.
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
