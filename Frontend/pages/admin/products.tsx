import { useState, useEffect, useCallback, useMemo, FormEvent } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import AITranslateButton from '../../src/components/admin/AITranslateButton';
import LaunchKitDrawer from '../../src/components/admin/LaunchKitDrawer';
import RichTextEditor from '../../src/components/shared/RichTextEditor';
import MarkdownContent from '../../src/components/shared/MarkdownContent';
import FileDropzone from '../../src/components/shared/FileDropzone';
import ImageGalleryUploader from '../../src/components/shared/ImageGalleryUploader';
import { PRODUCT_IMAGE_SIZE } from '../../src/components/shared/imageRatioCheck';
import { assetFilenameFromUrl } from '../../src/utils/assetFilename';
import {
  getAdminProducts,
  createProduct,
  approveProduct,
  rejectProduct,
  requestProductChanges,
  updateProductAdmin,
  archiveProduct,
  restoreProduct,
  uploadProductImage,
  uploadProductFile,
  uploadProductVideo,
  getProductPurchases,
  translateProduct,
  DigitalProduct,
  AdminProductPurchase,
  ProductLicenseType,
  LICENSE_LABELS,
  validateProductDiscount,
  UpdateProductPayload,
  ProductFile,
  getAdminProductFileLink,
  HowItWorksStep,
  HOW_IT_WORKS_ICONS,
} from '../../src/services/productService';
import { getAiAutomationSettings, updateAiAutomationSettings } from '../../src/services/adminPanelService';
import { formatPrice } from '../../src/utils/coursePricing';
import ProductTemplatePanel from '../../src/components/admin/ProductTemplatePanel';
import ProductPricingPanel from '../../src/components/admin/ProductPricingPanel';

import { adminLocale, at, atEnum, atf, getAdminLang } from '../../src/i18n/admin';
import { useCanSeeMoney } from '../../src/components/admin/useCanSeeMoney';
import { ProductCategorySelect, ProductHighlightSelect } from '../../src/components/admin/ProductCategoryFields';
import { PRODUCT_CATEGORIES, normalizeProductCategory } from '../../src/data/productCategories';
// Bilingual because this admin page is English-only while its editors work in
// Georgian. Why 4:3 + centre: the store detail gallery is 4:3 and the store
// card is 16:9 (crops top/bottom) — see imageRatioCheck.ts.
const COVER_SIZE_HINT =
  'რეკომენდებული: 2000×1500 px (4:3), მინ. 1200×900 · მთავარი ტექსტი/ობიექტი შუაში მოათავსე — მაღაზიის ბარათი ზემოდან და ქვემოდან ჭრის (16:9). ' +
  'Recommended: 2000×1500 px (4:3), min 1200×900 · keep key content centred — the store card crops top/bottom (16:9). PNG/JPG, max 10MB.';
const GALLERY_SIZE_HINT =
  'რეკომენდებული: 2000×1500 px (4:3), მაქს. 15 სურათი · Recommended: 2000×1500 px (4:3), up to 15 images, max 10MB each.';

const ASSET_ACCEPT = '.zip,.pdf,.epub,.rar,.7z,.fig,.sketch,.psd,.ai,.doc,.docx,.mp4,.mov';

type AdminProduct = DigitalProduct & { submittedBy: { id: string; name: string; email: string } | null };

const emptyHowItWorksStep = (): HowItWorksStep => ({ icon: 'Zap', titleKa: '', titleEn: '', bodyKa: '', bodyEn: '' });

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  NEEDS_REVISION: 'bg-orange-50 text-orange-700 border-orange-200',
  ARCHIVED: 'bg-gray-100 text-gray-600 border-gray-300',
};

// KA/EN tabbed title+description editor, shared by the "Add Product
// Directly" form and ModerationProductCard's edit mode — mirrors the same
// tab-bar + AITranslateButton pattern already used on admin/blog.tsx,
// admin/mentorship.tsx, etc. Deliberately owns only the tab UI; the caller
// owns state, the actual translate request, and the overwrite-confirmation
// check (same "caller owns the call" split AITranslateButton itself uses).
function BilingualTitleDescriptionFields({
  title, description, titleEn, descriptionEn,
  onTitleChange, onDescriptionChange, onTitleEnChange, onDescriptionEnChange,
  onTranslate, translating, translateError,
  titleRequired, descriptionRequired, inputClassName,
}: {
  title: string; description: string; titleEn: string; descriptionEn: string;
  onTitleChange: (value: string) => void; onDescriptionChange: (value: string) => void;
  onTitleEnChange: (value: string) => void; onDescriptionEnChange: (value: string) => void;
  onTranslate: () => void; translating: boolean; translateError: string | null;
  titleRequired?: boolean; descriptionRequired?: boolean; inputClassName: string;
}) {
  const [tab, setTab] = useState<'ka' | 'en'>('ka');
  const hasEnglishContent = !!(titleEn.trim() || descriptionEn.trim());
  return (
    <div>
      <div className="flex items-center justify-between border-b border-gray-200 mb-3 flex-wrap gap-2">
        <div className="flex gap-1">
          {(['ka', 'en'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 -mb-px transition-colors bg-transparent cursor-pointer ${
                tab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'ka' ? at("🇬🇪 Title/Description (KA)") : at("🇬🇧 Title/Description (EN)")}
              {t === 'en' && hasEnglishContent && <span className="ml-1 text-emerald-500" title={at("English content set")}>●</span>}
            </button>
          ))}
        </div>
        <AITranslateButton onClick={onTranslate} loading={translating} label={at("✨ Auto Translate to English")} loadingLabel="Translating…" className="mb-0" />
      </div>
      {translateError && <p className="text-xs text-red-600 mb-2">{translateError}</p>}
      {tab === 'ka' ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{at("Title (KA)")}</label>
            <input required={titleRequired} value={title} onChange={(e) => onTitleChange(e.target.value)} className={inputClassName} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{at("Description (KA)")}</label>
            <RichTextEditor required={descriptionRequired} rows={3} value={description} onChange={onDescriptionChange} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{at("Title (EN)")}</label>
            <input
              value={titleEn}
              onChange={(e) => onTitleEnChange(e.target.value)}
              placeholder={at("Falls back to the Georgian title on the storefront if left blank")}
              className={inputClassName}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{at("Description (EN)")}</label>
            <RichTextEditor
              rows={3}
              value={descriptionEn}
              onChange={onDescriptionEnChange}
              placeholder={at("Falls back to the Georgian description on the storefront if left blank")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Main file first, then any extras — the shape ProductFilesEditor edits.
// Rows saved before fileName existed fall back to the stored url's last
// segment (a random blob name, but at least something to tell them apart).
function productFilesOf(p: AdminProduct): ProductFile[] {
  if (!p.fileUrl) return [];
  return [
    { url: p.fileUrl, name: p.fileName || assetFilenameFromUrl(p.fileUrl) || 'file' },
    ...(p.additionalFiles ?? []),
  ];
}

const MAX_PRODUCT_FILES = 21; // main file + Backend's MAX_ADDITIONAL_FILES (20)

// The downloadable files a buyer gets after purchase (the first one is the
// main file, DigitalProduct.fileUrl). Lets an admin open each file to check
// it, replace it with a new upload, remove it, or add more. Nothing is
// persisted until the card's Save — uploads land in private storage right
// away, but only the saved list is ever delivered to buyers.
function ProductFilesEditor({
  files,
  onChange,
  onBusyChange,
}: {
  files: ProductFile[];
  onChange: (files: ProductFile[]) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  // Index being replaced, 'new' for the add dropzone, or null when idle.
  const [uploading, setUploading] = useState<number | 'new' | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File, target: number | 'new') => {
    setError(null);
    setUploading(target);
    onBusyChange(true);
    try {
      const uploaded = await uploadProductFile(file);
      onChange(target === 'new' ? [...files, uploaded] : files.map((f, i) => (i === target ? uploaded : f)));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? at("File upload failed."));
    } finally {
      setUploading(null);
      onBusyChange(false);
    }
  };

  const pickReplacement = (index: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ASSET_ACCEPT;
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) upload(file, index);
    };
    input.click();
  };

  const open = async (index: number) => {
    setError(null);
    setOpening(index);
    // Open the tab synchronously (before the await) so it isn't popup-blocked,
    // then point it at the freshly signed link.
    const tab = window.open('', '_blank');
    try {
      const url = await getAdminProductFileLink(files[index].url);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.assign(url);
      }
    } catch (err: any) {
      tab?.close();
      setError(err?.response?.data?.message ?? at("Could not open the file."));
    } finally {
      setOpening(null);
    }
  };

  const remove = (index: number) => {
    if (files.length <= 1) return;
    if (!window.confirm(atf("Remove \"{0}\" from this product? Buyers will no longer get it (after you click Save).", files[index].name))) return;
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {at("Product Files")}{" "}<span className="text-gray-400">({files.length})</span>
      </label>
      <p className="text-[11px] text-gray-400 mb-2">
        {at("What buyers download after purchase (e.g. the printable file). The first one is the main file. Changes apply after Save.")}
      </p>
      {files.length === 0 && (
        <p className="text-xs text-amber-600 mb-2">{at("No file attached — upload one below before saving.")}</p>
      )}
      <ul className="space-y-1.5 mb-2">
        {files.map((f, i) => (
          <li key={`${i}-${f.url}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs text-gray-800" title={f.name}>
              {i === 0 && <span className="mr-1.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">{at("MAIN")}</span>}
              {f.name}
            </span>
            <button
              type="button"
              onClick={() => open(i)}
              disabled={opening !== null}
              className="text-[11px] font-medium text-gray-700 border border-gray-200 px-2 py-1 rounded-md hover:bg-gray-50 disabled:opacity-60"
            >
              {opening === i ? at("Opening…") : at("View")}
            </button>
            <button
              type="button"
              onClick={() => pickReplacement(i)}
              disabled={uploading !== null}
              className="text-[11px] font-medium text-indigo-700 border border-indigo-200 px-2 py-1 rounded-md hover:bg-indigo-50 disabled:opacity-60"
            >
              {uploading === i ? at("Uploading…") : at("Replace")}
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={files.length <= 1 || uploading !== null}
              title={files.length <= 1 ? at("A product needs at least one file — use Replace instead.") : undefined}
              className="text-[11px] font-medium text-red-600 border border-red-200 px-2 py-1 rounded-md hover:bg-red-50 disabled:opacity-40"
            >
              {at("Delete")}
            </button>
          </li>
        ))}
      </ul>
      {files.length < MAX_PRODUCT_FILES && (
        <FileDropzone
          accept={ASSET_ACCEPT}
          uploading={uploading === 'new'}
          selectedFileName={null}
          onFile={(file) => upload(file, 'new')}
          label={at("Add another file — drag & drop or click to browse")}
          hint={at("ZIP, PDF, EPUB, RAR, 7Z, FIG, SKETCH, PSD, AI, DOC, DOCX, MP4, or MOV — up to 200MB")}
          uploadingLabel="Uploading…"
        />
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function ModerationProductCard({
  product: p,
  acting,
  onApprove,
  onReject,
  onRequestChanges,
  onSave,
  onArchive,
  onRestore,
}: {
  product: AdminProduct;
  acting: boolean;
  onApprove: () => void;
  onReject: () => void;
  onRequestChanges: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onSave: (patch: UpdateProductPayload) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [title, setTitle] = useState(p.title);
  const [description, setDescription] = useState(p.description);
  const [titleEn, setTitleEn] = useState(p.titleEn ?? '');
  const [descriptionEn, setDescriptionEn] = useState(p.descriptionEn ?? '');
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [editImageUrl, setEditImageUrl] = useState(p.imageUrl);
  const [editPreviewImages, setEditPreviewImages] = useState<string[]>(p.previewImages);
  const [editVideoUrl, setEditVideoUrl] = useState(p.previewVideoUrl ?? '');
  const [editVideoUploading, setEditVideoUploading] = useState(false);
  const [editToolRoute, setEditToolRoute] = useState(p.toolRoute ?? '');
  // Prices are SUPER_ADMIN-only: other tiers get products without `price`
  // from the API and never see or send a price.
  const canSeeMoney = useCanSeeMoney();
  const [editPrice, setEditPrice] = useState(p.price != null ? (p.price / 100).toFixed(2) : '');
  const editPriceMinor = Math.round(Number(editPrice) * 100);
  const priceError = !canSeeMoney ? null : !editPrice.trim() || !Number.isFinite(Number(editPrice)) || Number(editPrice) < 0
    || !Number.isSafeInteger(editPriceMinor) || editPriceMinor > 2147483647
    ? at('Enter a valid non-negative price in GEL.')
    : null;
  const [editFiles, setEditFiles] = useState<ProductFile[]>(() => productFilesOf(p));
  const [editFilesBusy, setEditFilesBusy] = useState(false);
  const [useCustomSteps, setUseCustomSteps] = useState(!!p.howItWorksSteps);
  const [steps, setSteps] = useState<HowItWorksStep[]>(
    p.howItWorksSteps ?? [emptyHowItWorksStep(), emptyHowItWorksStep(), emptyHowItWorksStep()]
  );
  const updateStep = (index: number, patch: Partial<HowItWorksStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };
  const stepsValid = steps.every((s) => s.titleKa.trim() && s.titleEn.trim() && s.bodyKa.trim() && s.bodyEn.trim());
  const [saving, setSaving] = useState(false);
  const [showPurchases, setShowPurchases] = useState(false);
  const [purchases, setPurchases] = useState<AdminProductPurchase[] | null>(null);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [showLaunchKit, setShowLaunchKit] = useState(false);

  const togglePurchases = async () => {
    if (showPurchases) return setShowPurchases(false);
    setShowPurchases(true);
    if (purchases) return;
    setLoadingPurchases(true);
    try {
      setPurchases(await getProductPurchases(p.id));
    } finally {
      setLoadingPurchases(false);
    }
  };

  const startEdit = () => {
    setTitle(p.title);
    setDescription(p.description);
    setTitleEn(p.titleEn ?? '');
    setDescriptionEn(p.descriptionEn ?? '');
    setTranslateError(null);
    setEditImageUrl(p.imageUrl);
    setEditPreviewImages(p.previewImages);
    setEditVideoUrl(p.previewVideoUrl ?? '');
    setEditToolRoute(p.toolRoute ?? '');
    setEditPrice(p.price != null ? (p.price / 100).toFixed(2) : '');
    setEditFiles(productFilesOf(p));
    setUseCustomSteps(!!p.howItWorksSteps);
    setSteps(p.howItWorksSteps ?? [emptyHowItWorksStep(), emptyHowItWorksStep(), emptyHowItWorksStep()]);
    setEditing(true);
  };

  const handleAutoTranslate = async () => {
    setTranslateError(null);
    if (!title.trim() || !description.trim()) {
      setTranslateError(at("Enter a Georgian title and description before translating."));
      return;
    }
    if ((titleEn.trim() || descriptionEn.trim()) && !window.confirm(at("This will overwrite the existing English title/description. Continue?"))) {
      return;
    }
    setTranslating(true);
    try {
      const translated = await translateProduct({ title: title.trim(), description: description.trim() });
      setTitleEn(translated.titleEn);
      setDescriptionEn(translated.descriptionEn);
    } catch (err: any) {
      // Existing titleEn/descriptionEn are left exactly as they were.
      setTranslateError(err?.response?.data?.message ?? at("Translation failed. Please try again."));
    } finally {
      setTranslating(false);
    }
  };

  const handleSave = async () => {
    if (priceError) return;
    if (useCustomSteps && !stepsValid) return;
    setSaving(true);
    try {
      await onSave({
        ...(canSeeMoney ? { priceMinor: editPriceMinor } : {}),
        title,
        description,
        titleEn: titleEn.trim() || null,
        descriptionEn: descriptionEn.trim() || null,
        imageUrl: editImageUrl,
        previewImages: editPreviewImages,
        previewVideoUrl: editVideoUrl || null,
        howItWorksSteps: useCustomSteps ? steps : null,
        toolRoute: editToolRoute.trim() || null,
        // Only sent when the product actually has a main file to keep —
        // ProductFilesEditor never lets the list drop to empty.
        ...(editFiles.length > 0
          ? { fileUrl: editFiles[0].url, fileName: editFiles[0].name || null, additionalFiles: editFiles.slice(1) }
          : {}),
      });
      setEditing(false);
    } catch {
      // error already surfaced via the parent's actionError state
    } finally {
      setSaving(false);
    }
  };

  const handleEditVideoFile = async (file: File) => {
    setEditVideoUploading(true);
    try {
      setEditVideoUrl(await uploadProductVideo(file));
    } catch {
      // Non-fatal — the demo video is optional.
    } finally {
      setEditVideoUploading(false);
    }
  };

  return (
    <div id={`product-${p.id}`} className="flex gap-4 bg-white border border-gray-200 rounded-xl p-4 scroll-mt-24">
      <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
        <Image src={p.imageUrl} alt={p.title} fill className="object-cover" unoptimized />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${STATUS_BADGE[p.status ?? 'PENDING']}`}>{atEnum(p.status)}</span>
          {/* Category + store flag are changed right here (saved at once), no need to open Edit. */}
          <ProductCategorySelect
            value={normalizeProductCategory(p.category, p.title)}
            onChange={(category) => void onSave({ category }).catch(() => undefined)}
            className="!py-1 !text-xs"
          />
          <ProductHighlightSelect
            value={p.highlight ?? ''}
            onChange={(v) => void onSave({ highlight: v || null }).catch(() => undefined)}
            className="!py-1 !text-xs"
          />
          {p.createdByAgent && (
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-600 text-white" title={at("Created by the AI product agent — see /admin/product-agent")}>
              AI აგენტი
            </span>
          )}
        </div>

        {editing ? (
          <div className="space-y-3 mb-2">
            <BilingualTitleDescriptionFields
              title={title} description={description} titleEn={titleEn} descriptionEn={descriptionEn}
              onTitleChange={setTitle} onDescriptionChange={setDescription}
              onTitleEnChange={setTitleEn} onDescriptionEnChange={setDescriptionEn}
              onTranslate={handleAutoTranslate} translating={translating} translateError={translateError}
              inputClassName="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold"
            />
            <ImageGalleryUploader
              coverUrl={editImageUrl}
              onCoverChange={setEditImageUrl}
              previewImages={editPreviewImages}
              onPreviewImagesChange={setEditPreviewImages}
              uploadImage={uploadProductImage}
              lang="en"
              recommendedSize={PRODUCT_IMAGE_SIZE}
              bilingualWarnings
              labels={{
                coverLabel: at('Cover Image'),
                coverHint: at('Click or drop to replace'),
                coverSizeHint: COVER_SIZE_HINT,
                galleryLabel: at('Screenshots'),
                gallerySizeHint: GALLERY_SIZE_HINT,
                addMore: at('Add more'),
                uploading: 'Uploading…',
                remove: 'Remove',
                uploadFailed: at('Upload failed.'),
              }}
            />
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{at("Demo Video (optional)")}</label>
              <input
                value={editVideoUrl}
                onChange={(e) => setEditVideoUrl(e.target.value)}
                placeholder={at("YouTube/Vimeo link, or upload a file below")}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm mb-2"
              />
              <FileDropzone
                accept=".mp4,.mov"
                uploading={editVideoUploading}
                selectedFileName={editVideoUrl ? assetFilenameFromUrl(editVideoUrl) : null}
                onFile={handleEditVideoFile}
                label={at("Upload video")}
                hint={at("MP4 or MOV, up to 50MB")}
                uploadingLabel="Uploading…"
              />
            </div>

            <ProductFilesEditor files={editFiles} onChange={setEditFiles} onBusyChange={setEditFilesBusy} />

            {canSeeMoney && (
            <div>
              <label htmlFor={`product-price-${p.id}`} className="block text-xs font-medium text-gray-700 mb-1">{at("Price (₾ / GEL)")}</label>
              <input
                id={`product-price-${p.id}`}
                type="number"
                step="0.01"
                min="0"
                max="21474836.47"
                required
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                aria-invalid={!!priceError}
                aria-describedby={priceError ? `product-price-error-${p.id}` : undefined}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
              {priceError && <p id={`product-price-error-${p.id}`} role="alert" className="text-xs text-red-600 mt-1">{priceError}</p>}
            </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{at("Tool Route (optional)")}</label>
              <input
                value={editToolRoute}
                onChange={(e) => setEditToolRoute(e.target.value)}
                placeholder={at("e.g. /dashboard/tools/chatbot-builder — leave blank for a normal downloadable file")}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                {at("If set, the storefront page shows a \"Launch Tool\" button linking here instead of a download, once purchased.")}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-1 cursor-pointer">
                <input type="checkbox" checked={useCustomSteps} onChange={(e) => setUseCustomSteps(e.target.checked)} />
                {at("Custom \"How it Works\" steps for this listing")}
              </label>
              <p className="text-[11px] text-gray-400 mb-3">
                {at("Unchecked = the storefront page's generic 3-step copy. Checked = exactly these 3 steps, both languages.")}
              </p>
              {useCustomSteps && (
                <div className="space-y-3">
                  {steps.map((step, i) => (
                    <div key={i} className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-gray-400 shrink-0">{at("STEP")}{" "}{i + 1}</span>
                        <select
                          value={step.icon}
                          onChange={(e) => updateStep(i, { icon: e.target.value as HowItWorksStep['icon'] })}
                          className="text-xs rounded-md border border-gray-300 px-2 py-1"
                        >
                          {HOW_IT_WORKS_ICONS.map((icon) => (
                            <option key={icon} value={icon}>{icon}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={step.titleKa}
                          onChange={(e) => updateStep(i, { titleKa: e.target.value })}
                          placeholder="სათაური (ქართ.)"
                          className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs"
                        />
                        <input
                          value={step.titleEn}
                          onChange={(e) => updateStep(i, { titleEn: e.target.value })}
                          placeholder={at("Title (EN)")}
                          className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <textarea
                          value={step.bodyKa}
                          onChange={(e) => updateStep(i, { bodyKa: e.target.value })}
                          placeholder="აღწერა (ქართ.)"
                          rows={2}
                          className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs"
                        />
                        <textarea
                          value={step.bodyEn}
                          onChange={(e) => updateStep(i, { bodyEn: e.target.value })}
                          placeholder={at("Description (EN)")}
                          rows={2}
                          className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                  {!stepsValid && <p className="text-[11px] text-red-600">{at("All 3 steps need both a title and description in both languages.")}</p>}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !!priceError || editFilesBusy || editFiles.length === 0 || (useCustomSteps && !stepsValid)}
                className="text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? at("Saving…") : at("Save")}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-xs font-medium text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200">
                {at("Cancel")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="font-semibold text-gray-900 truncate">{p.title}</h3>
            <MarkdownContent content={p.description} className="!text-xs text-gray-500 mb-1 line-clamp-2" />
          </>
        )}

        <p className="text-xs text-gray-500">
          {!canSeeMoney ? null : p.price === 0 ? (
            at("Free")
          ) : p.saleActive ? (
            <>
              <s className="text-gray-400">{formatPrice(p.price)}</s> {formatPrice(p.currentPrice)}{' '}
              <span className="text-rose-600 font-semibold">(-{Math.round((1 - p.currentPrice / p.price) * 100)}%)</span>
            </>
          ) : (
            formatPrice(p.price)
          )}{canSeeMoney ? ' · ' : ''}{p.downloadsCount} {at("downloads ·")}{" "}{getAdminLang() === 'ka' ? LICENSE_LABELS[p.licenseType].ka : LICENSE_LABELS[p.licenseType].en}
          {p.submittedBy && <> {at("· Submitted by")}{" "}{p.submittedBy.name} ({p.submittedBy.email})</>}
        </p>
        {p.status === 'REJECTED' && p.rejectionReason && <p className="text-xs text-red-500 mt-1">{at("Reason:")}{" "}{p.rejectionReason}</p>}
        {p.status === 'NEEDS_REVISION' && p.rejectionReason && <p className="text-xs text-orange-600 mt-1">{at("Requested changes:")}{" "}{p.rejectionReason}</p>}
        {p.aiReviewedAt && (
          <div className="mt-1.5 rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-500 mb-0.5">
              {at("🤖 AI Review — Score")}{" "}{p.aiReviewScore} {at("· Confidence")}{" "}{p.aiReviewConfidence}
            </p>
            <p className="text-[11px] text-indigo-700">{p.aiReviewReasoning}</p>
          </div>
        )}

        {canSeeMoney && showPurchases && (
          <div className="mt-2 rounded-lg border border-gray-200 p-2">
            {loadingPurchases ? (
              <p className="text-xs text-gray-400">{at("Loading…")}</p>
            ) : !purchases || purchases.length === 0 ? (
              <p className="text-xs text-gray-400">{at("No purchases yet.")}</p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {purchases.map((pu) => (
                    <tr key={pu.id} className="border-b last:border-0 border-gray-100">
                      <td className="py-1 pr-2 text-gray-700">{pu.user.name} ({pu.user.email})</td>
                      <td className="py-1 pr-2 text-gray-500">{atEnum(pu.paymentStatus)}</td>
                      <td className="py-1 text-right font-medium">
                        {pu.downloadedAt ? (
                          <span className="text-emerald-600">{at("Downloaded")}{" "}{new Date(pu.downloadedAt).toLocaleDateString(adminLocale())}</span>
                        ) : (
                          <span className="text-gray-400">{at("Not downloaded")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {showTemplate && <ProductTemplatePanel productId={p.id} />}
        {canSeeMoney && showPricing && <ProductPricingPanel product={p} onSave={onSave} onClose={() => setShowPricing(false)} />}
      </div>
      {!editing && (
        <div className="flex flex-col gap-2 shrink-0 justify-center">
          <button type="button" onClick={startEdit} disabled={acting} className="text-xs font-medium text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-60">
            {at("Edit")}
          </button>
          {canSeeMoney && (
            <>
              <button
                type="button"
                onClick={() => setShowPricing((v) => !v)}
                disabled={acting}
                className="text-xs font-medium text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-60"
              >
                {at("Price / Discount")}
              </button>
              <button type="button" onClick={togglePurchases} className="text-xs font-medium text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                {showPurchases ? at("Hide Purchases") : at("Purchases")}
              </button>
            </>
          )}
          <button type="button" onClick={() => setShowTemplate((v) => !v)} className="text-xs font-medium text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            {showTemplate ? at("Hide Template") : at("Editable Template")}
          </button>
          <button
            type="button"
            onClick={() => setShowLaunchKit(true)}
            className="flex items-center justify-center gap-1 text-xs font-medium text-white bg-gradient-to-r from-cyan-500 to-purple-600 px-3 py-1.5 rounded-lg hover:opacity-90"
          >
            <Sparkles className="w-3.5 h-3.5" /> {at("Launch Kit")}
          </button>
          {p.status === 'ARCHIVED' ? (
            <button
              type="button"
              onClick={onRestore}
              disabled={acting}
              className="text-xs font-medium text-white bg-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
            >
              აღდგენა
            </button>
          ) : (
            <button
              type="button"
              onClick={onArchive}
              disabled={acting}
              className="text-xs font-medium text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-60"
            >
              დამალვა (არქივი)
            </button>
          )}
          {p.status === 'PENDING' && (
            <>
              <button
                type="button"
                onClick={onApprove}
                disabled={acting}
                className="text-xs font-medium text-white bg-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
              >
                {at("Approve")}
              </button>
              <button
                type="button"
                onClick={onRequestChanges}
                disabled={acting}
                className="text-xs font-medium text-white bg-orange-500 px-3 py-1.5 rounded-lg hover:bg-orange-600 disabled:opacity-60"
              >
                {at("Request Changes")}
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={acting}
                className="text-xs font-medium text-white bg-red-600 px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {at("Reject")}
              </button>
            </>
          )}
        </div>
      )}
      {showLaunchKit && <LaunchKitDrawer target={{ productId: p.id }} title={p.title} onClose={() => setShowLaunchKit(false)} />}
    </div>
  );
}

function AdminProductsDashboard() {
  const canSeeMoney = useCanSeeMoney();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [scoreThreshold, setScoreThreshold] = useState('85');
  const [confidenceThreshold, setConfidenceThreshold] = useState('85');
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdsSaved, setThresholdsSaved] = useState(false);

  useEffect(() => {
    getAiAutomationSettings()
      .then((s) => {
        setScoreThreshold(String(s.autoApproveScoreThreshold));
        setConfidenceThreshold(String(s.autoApproveConfidenceThreshold));
      })
      .catch(() => {});
  }, []);

  const handleSaveThresholds = async () => {
    setSavingThresholds(true);
    setThresholdsSaved(false);
    try {
      await updateAiAutomationSettings({
        autoApproveScoreThreshold: Number(scoreThreshold),
        autoApproveConfidenceThreshold: Number(confidenceThreshold),
      });
      setThresholdsSaved(true);
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? at("Failed to save AI thresholds."));
    } finally {
      setSavingThresholds(false);
    }
  };

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [licenseType, setLicenseType] = useState<ProductLicenseType>('PERSONAL_USE');
  const [discountedPrice, setDiscountedPrice] = useState('');
  const [saleEndsAt, setSaleEndsAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await getAdminProducts());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // /admin/product-agent links here as #product-<id>; the list renders
  // after the fetch, so the browser's own hash jump happens too early.
  useEffect(() => {
    if (loading || typeof window === 'undefined' || !window.location.hash.startsWith('#product-')) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loading]);

  const visible = useMemo(
    () =>
      products.filter(
        (p) =>
          (!statusFilter || p.status === statusFilter) &&
          (!categoryFilter || normalizeProductCategory(p.category, p.title) === categoryFilter)
      ),
    [products, statusFilter, categoryFilter]
  );
  const pendingCount = products.filter((p) => p.status === 'PENDING').length;

  // Real-time — checked as the admin types, before the form is even
  // submitted, mirroring Backend's own productPricing.ts validation exactly
  // so the message they see now matches what a submit would say anyway.
  const discountError = useMemo(() => {
    if (!discountedPrice) return null;
    return validateProductDiscount(Number(price) || 0, Number(discountedPrice) || 0);
  }, [price, discountedPrice]);

  const handleAutoTranslate = async () => {
    setTranslateError(null);
    if (!title.trim() || !description.trim()) {
      setTranslateError(at("Enter a Georgian title and description before translating."));
      return;
    }
    if ((titleEn.trim() || descriptionEn.trim()) && !window.confirm(at("This will overwrite the existing English title/description. Continue?"))) {
      return;
    }
    setTranslating(true);
    try {
      const translated = await translateProduct({ title: title.trim(), description: description.trim() });
      setTitleEn(translated.titleEn);
      setDescriptionEn(translated.descriptionEn);
    } catch (err: any) {
      // Existing titleEn/descriptionEn are left exactly as they were.
      setTranslateError(err?.response?.data?.message ?? at("Translation failed. Please try again."));
    } finally {
      setTranslating(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (discountError) return setError(discountError);
    setSubmitting(true);
    try {
      await createProduct({
        title,
        description,
        titleEn: titleEn.trim() || null,
        descriptionEn: descriptionEn.trim() || null,
        price: Number(price) || 0,
        category,
        imageUrl,
        previewImages,
        fileUrl,
        fileName: fileName || null,
        licenseType,
        discountedPrice: discountedPrice ? Number(discountedPrice) : null,
        saleEndsAt: saleEndsAt || null,
      });
      setTitle('');
      setDescription('');
      setTitleEn('');
      setDescriptionEn('');
      setPrice('');
      setCategory('');
      setImageUrl('');
      setPreviewImages([]);
      setFileUrl('');
      setFileName('');
      setLicenseType('PERSONAL_USE');
      setDiscountedPrice('');
      setSaleEndsAt('');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? at("Failed to create product."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssetFile = async (file: File) => {
    setFileUploadError(null);
    setFileUploading(true);
    try {
      const uploaded = await uploadProductFile(file);
      setFileUrl(uploaded.url);
      setFileName(uploaded.name);
    } catch (err: any) {
      setFileUploadError(err?.response?.data?.message ?? at("File upload failed."));
    } finally {
      setFileUploading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionError(null);
    setActingId(id);
    try {
      const updated = await approveProduct(id);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? at("Failed to approve."));
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt(at("Rejection reason (shown to the submitter):"));
    if (!reason) return;
    setActionError(null);
    setActingId(id);
    try {
      const updated = await rejectProduct(id, reason);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? at("Failed to reject."));
    } finally {
      setActingId(null);
    }
  };

  const handleRequestChanges = async (id: string) => {
    const feedback = window.prompt(at("What needs to change? (shown to the submitter, e.g. \"Fix cover image resolution\")"));
    if (!feedback) return;
    setActionError(null);
    setActingId(id);
    try {
      const updated = await requestProductChanges(id, feedback);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? at("Failed to request changes."));
    } finally {
      setActingId(null);
    }
  };

  // Soft delete with an explicit confirm: the product leaves the store, but
  // buyers keep their downloads and it can be restored any time.
  const handleArchive = async (p: AdminProduct) => {
    const sold = p.salesCount ?? 0;
    const msg = [
      `დავმალო „${p.title}"?`,
      '',
      'პროდუქტი გაქრება მაღაზიიდან და ვეღარავინ იყიდის.',
      ...(sold > 0 ? [`${sold} მყიდველს შეუნარჩუნდება ჩამოტვირთვის უფლება.`] : []),
      'ნებისმიერ დროს შეგიძლია აღადგინო ("ARCHIVED" ჩანართიდან).',
    ].join('\n');
    if (!window.confirm(msg)) return;
    setActionError(null);
    setActingId(p.id);
    try {
      const updated = await archiveProduct(p.id);
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...updated } : x)));
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? at("Failed to archive."));
    } finally {
      setActingId(null);
    }
  };

  const handleRestore = async (id: string) => {
    if (!window.confirm('აღვადგინო პროდუქტი? ისევ გამოჩნდება მაღაზიაში და გაიყიდება.')) return;
    setActionError(null);
    setActingId(id);
    try {
      const updated = await restoreProduct(id);
      setProducts((prev) => prev.map((x) => (x.id === id ? { ...x, ...updated } : x)));
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? at("Failed to restore."));
    } finally {
      setActingId(null);
    }
  };

  const handleUpdate = async (id: string, patch: UpdateProductPayload) => {
    setActionError(null);
    setActingId(id);
    try {
      const updated = await updateProductAdmin(id, patch);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? at("Failed to save changes."));
      throw err;
    } finally {
      setActingId(null);
    }
  };

  return (
    <>
      <Head>
        <title>{at("Digital Store | Admin")}</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">{at("Digital Store")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {at("Review graduate/freelancer submissions, or list a new product directly (published immediately).")}
          </p>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 mb-8">
          <p className="text-sm font-semibold text-indigo-900 mb-1">{at("🤖 AI Moderation Sensitivity")}</p>
          <p className="text-xs text-indigo-700 mb-3">
            {at("New/resubmitted products are auto-reviewed by Gemini. Auto-APPROVE only fires when the verdict AND both thresholds below are met — otherwise it falls back to NEEDS_REVISION or a normal PENDING human review. Raising either threshold makes auto-approval rarer (the safer direction).")}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-medium text-indigo-700 mb-1">{at("Min. Score (0-100)")}</label>
              <input
                type="number"
                min="0"
                max="100"
                value={scoreThreshold}
                onChange={(e) => setScoreThreshold(e.target.value)}
                className="w-24 rounded-lg border border-indigo-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-indigo-700 mb-1">{at("Min. Confidence (0-100)")}</label>
              <input
                type="number"
                min="0"
                max="100"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(e.target.value)}
                className="w-24 rounded-lg border border-indigo-200 px-3 py-1.5 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveThresholds}
              disabled={savingThresholds}
              className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {savingThresholds ? at("Saving…") : thresholdsSaved ? at("Saved ✓") : at("Save")}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 mb-8 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">{at("Add Product Directly (Admin)")}</h2>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <BilingualTitleDescriptionFields
            title={title} description={description} titleEn={titleEn} descriptionEn={descriptionEn}
            onTitleChange={setTitle} onDescriptionChange={setDescription}
            onTitleEnChange={setTitleEn} onDescriptionEnChange={setDescriptionEn}
            onTranslate={handleAutoTranslate} translating={translating} translateError={translateError}
            titleRequired descriptionRequired
            inputClassName="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{at("Category")}</label>
            <ProductCategorySelect required value={category} onChange={setCategory} className="w-full sm:w-80" />
          </div>
          {!canSeeMoney && (
            <p className="text-xs text-gray-500">{at("Price is set by a Super Admin. New products wait in Pending until it is set.")}</p>
          )}
          {canSeeMoney && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{at("Price (GEL, 0 = free)")}</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full sm:w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          )}

          <ImageGalleryUploader
            coverUrl={imageUrl}
            onCoverChange={setImageUrl}
            previewImages={previewImages}
            onPreviewImagesChange={setPreviewImages}
            uploadImage={uploadProductImage}
            lang="en"
            recommendedSize={PRODUCT_IMAGE_SIZE}
            bilingualWarnings
            labels={{
              coverLabel: at('Main Cover Image (required)'),
              coverHint: imageUrl ? at('Click or drop to replace') : at('Click or drop an image'),
              coverSizeHint: COVER_SIZE_HINT,
              galleryLabel: at('Additional Screenshots'),
              gallerySizeHint: GALLERY_SIZE_HINT,
              addMore: at('Add'),
              uploading: 'Uploading…',
              remove: 'Remove',
              uploadFailed: at('Upload failed.'),
            }}
          />
          {!imageUrl && <p className="text-xs text-amber-600">{at("Cover image is required.")}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{at("Downloadable Product File")}</label>
            <FileDropzone
              accept={ASSET_ACCEPT}
              uploading={fileUploading}
              selectedFileName={fileName || assetFilenameFromUrl(fileUrl)}
              onFile={handleAssetFile}
              label={at("Drag & drop the product file here, or click to browse")}
              hint={at("ZIP, PDF, EPUB, RAR, 7Z, FIG, SKETCH, PSD, AI, DOC, DOCX, MP4, or MOV — up to 200MB")}
              uploadingLabel="Uploading…"
            />
            {fileUploadError && <p className="text-xs text-red-600 mt-1">{fileUploadError}</p>}
            {!fileUrl && !fileUploading && <p className="text-xs text-amber-600 mt-1">{at("Required — only revealed to buyers after purchase")}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{at("License")}</label>
            <select
              value={licenseType}
              onChange={(e) => setLicenseType(e.target.value as ProductLicenseType)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {(Object.keys(LICENSE_LABELS) as ProductLicenseType[]).map((key) => (
                <option key={key} value={key}>{getAdminLang() === 'ka' ? LICENSE_LABELS[key].ka : LICENSE_LABELS[key].en}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">{getAdminLang() === 'ka' ? LICENSE_LABELS[licenseType].descriptionKa : LICENSE_LABELS[licenseType].descriptionEn}</p>
          </div>

          {canSeeMoney && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">{at("Discounted Price (GEL, optional)")}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountedPrice}
                onChange={(e) => setDiscountedPrice(e.target.value)}
                placeholder={at("Leave blank for no sale")}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${discountError ? 'border-red-400' : 'border-gray-300'}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">{at("Sale Ends At (optional)")}</label>
              <input
                type="datetime-local"
                value={saleEndsAt}
                onChange={(e) => setSaleEndsAt(e.target.value)}
                disabled={!discountedPrice}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
          </div>
          )}
          {discountError && <p className="text-xs text-red-600">{discountError}</p>}

          <button
            type="submit"
            disabled={submitting || !imageUrl || !fileUrl || fileUploading || !!discountError}
            className="text-sm font-medium text-white bg-indigo-600 px-5 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? at("Saving…") : at("Add Product")}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {['PENDING', 'NEEDS_REVISION', 'APPROVED', 'REJECTED', 'ARCHIVED', ''].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              {s ? atEnum(s) : at("All")}
              {s === 'PENDING' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </button>
          ))}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label={at("Category")}
            className="ml-auto text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-600"
          >
            <option value="">{at("All categories")}</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.emoji} {getAdminLang() === 'ka' ? c.labelKa : c.labelEn}
              </option>
            ))}
          </select>
        </div>

        {actionError && <p className="text-sm text-red-600 mb-4">{actionError}</p>}

        {loading ? (
          <p className="text-sm text-gray-400">{at("Loading…")}</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-gray-500">{at("No products here.")}</p>
        ) : (
          <div className="space-y-3">
            {visible.map((p) => (
              <ModerationProductCard
                key={p.id}
                product={p}
                acting={actingId === p.id}
                onApprove={() => handleApprove(p.id)}
                onReject={() => handleReject(p.id)}
                onRequestChanges={() => handleRequestChanges(p.id)}
                onSave={(patch) => handleUpdate(p.id, patch)}
                onArchive={() => handleArchive(p)}
                onRestore={() => handleRestore(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminProductsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminProductsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
