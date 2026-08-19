import { useState, useEffect, useCallback, useMemo, FormEvent } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import RichTextEditor from '../../src/components/shared/RichTextEditor';
import MarkdownContent from '../../src/components/shared/MarkdownContent';
import FileDropzone from '../../src/components/shared/FileDropzone';
import ImageGalleryUploader from '../../src/components/shared/ImageGalleryUploader';
import { assetFilenameFromUrl } from '../../src/utils/assetFilename';
import {
  getAdminProducts,
  createProduct,
  approveProduct,
  rejectProduct,
  requestProductChanges,
  updateProductAdmin,
  uploadProductImage,
  uploadProductFile,
  getProductPurchases,
  DigitalProduct,
  AdminProductPurchase,
} from '../../src/services/productService';
import { getAiAutomationSettings, updateAiAutomationSettings } from '../../src/services/adminPanelService';
import { formatPrice } from '../../src/utils/coursePricing';

const ASSET_ACCEPT = '.zip,.pdf,.epub,.rar,.7z,.fig,.sketch,.psd,.ai,.doc,.docx,.mp4,.mov';

type AdminProduct = DigitalProduct & { submittedBy: { id: string; name: string; email: string } | null };

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  NEEDS_REVISION: 'bg-orange-50 text-orange-700 border-orange-200',
};

function ModerationProductCard({
  product: p,
  acting,
  onApprove,
  onReject,
  onRequestChanges,
  onSave,
}: {
  product: AdminProduct;
  acting: boolean;
  onApprove: () => void;
  onReject: () => void;
  onRequestChanges: () => void;
  onSave: (patch: { title: string; description: string }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(p.title);
  const [description, setDescription] = useState(p.description);
  const [saving, setSaving] = useState(false);
  const [showPurchases, setShowPurchases] = useState(false);
  const [purchases, setPurchases] = useState<AdminProductPurchase[] | null>(null);
  const [loadingPurchases, setLoadingPurchases] = useState(false);

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
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ title, description });
      setEditing(false);
    } catch {
      // error already surfaced via the parent's actionError state
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-4 bg-white border border-gray-200 rounded-xl p-4">
      <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
        <Image src={p.imageUrl} alt={p.title} fill className="object-cover" unoptimized />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">{p.category}</span>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${STATUS_BADGE[p.status ?? 'PENDING']}`}>{p.status}</span>
        </div>

        {editing ? (
          <div className="space-y-2 mb-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold" />
            <RichTextEditor rows={3} value={description} onChange={setDescription} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-xs font-medium text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200">
                Cancel
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
          {p.price === 0 ? 'Free' : formatPrice(p.price)} · {p.downloadsCount} downloads
          {p.submittedBy && <> · Submitted by {p.submittedBy.name} ({p.submittedBy.email})</>}
        </p>
        {p.status === 'REJECTED' && p.rejectionReason && <p className="text-xs text-red-500 mt-1">Reason: {p.rejectionReason}</p>}
        {p.status === 'NEEDS_REVISION' && p.rejectionReason && <p className="text-xs text-orange-600 mt-1">Requested changes: {p.rejectionReason}</p>}
        {p.aiReviewedAt && (
          <div className="mt-1.5 rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-500 mb-0.5">
              🤖 AI Review — Score {p.aiReviewScore} · Confidence {p.aiReviewConfidence}
            </p>
            <p className="text-[11px] text-indigo-700">{p.aiReviewReasoning}</p>
          </div>
        )}

        {showPurchases && (
          <div className="mt-2 rounded-lg border border-gray-200 p-2">
            {loadingPurchases ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : !purchases || purchases.length === 0 ? (
              <p className="text-xs text-gray-400">No purchases yet.</p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {purchases.map((pu) => (
                    <tr key={pu.id} className="border-b last:border-0 border-gray-100">
                      <td className="py-1 pr-2 text-gray-700">{pu.user.name} ({pu.user.email})</td>
                      <td className="py-1 pr-2 text-gray-500">{pu.paymentStatus}</td>
                      <td className="py-1 text-right font-medium">
                        {pu.downloadedAt ? (
                          <span className="text-emerald-600">Downloaded {new Date(pu.downloadedAt).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-gray-400">Not downloaded</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      {!editing && (
        <div className="flex flex-col gap-2 shrink-0 justify-center">
          <button type="button" onClick={startEdit} disabled={acting} className="text-xs font-medium text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-60">
            Edit
          </button>
          <button type="button" onClick={togglePurchases} className="text-xs font-medium text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            {showPurchases ? 'Hide Purchases' : 'Purchases'}
          </button>
          {p.status === 'PENDING' && (
            <>
              <button
                type="button"
                onClick={onApprove}
                disabled={acting}
                className="text-xs font-medium text-white bg-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={onRequestChanges}
                disabled={acting}
                className="text-xs font-medium text-white bg-orange-500 px-3 py-1.5 rounded-lg hover:bg-orange-600 disabled:opacity-60"
              >
                Request Changes
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={acting}
                className="text-xs font-medium text-white bg-red-600 px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                Reject
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AdminProductsDashboard() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
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
      setActionError(err?.response?.data?.message ?? 'Failed to save AI thresholds.');
    } finally {
      setSavingThresholds(false);
    }
  };

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [fileUrl, setFileUrl] = useState('');
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

  const visible = useMemo(
    () => (statusFilter ? products.filter((p) => p.status === statusFilter) : products),
    [products, statusFilter]
  );
  const pendingCount = products.filter((p) => p.status === 'PENDING').length;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createProduct({ title, description, price: Number(price) || 0, category, imageUrl, previewImages, fileUrl });
      setTitle('');
      setDescription('');
      setPrice('');
      setCategory('');
      setImageUrl('');
      setPreviewImages([]);
      setFileUrl('');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create product.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssetFile = async (file: File) => {
    setFileUploadError(null);
    setFileUploading(true);
    try {
      setFileUrl(await uploadProductFile(file));
    } catch (err: any) {
      setFileUploadError(err?.response?.data?.message ?? 'File upload failed.');
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
      setActionError(err?.response?.data?.message ?? 'Failed to approve.');
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Rejection reason (shown to the submitter):');
    if (!reason) return;
    setActionError(null);
    setActingId(id);
    try {
      const updated = await rejectProduct(id, reason);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Failed to reject.');
    } finally {
      setActingId(null);
    }
  };

  const handleRequestChanges = async (id: string) => {
    const feedback = window.prompt('What needs to change? (shown to the submitter, e.g. "Fix cover image resolution")');
    if (!feedback) return;
    setActionError(null);
    setActingId(id);
    try {
      const updated = await requestProductChanges(id, feedback);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Failed to request changes.');
    } finally {
      setActingId(null);
    }
  };

  const handleUpdate = async (id: string, patch: { title: string; description: string }) => {
    setActionError(null);
    setActingId(id);
    try {
      const updated = await updateProductAdmin(id, patch);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Failed to save changes.');
      throw err;
    } finally {
      setActingId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Digital Store | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Digital Store</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review graduate/freelancer submissions, or list a new product directly (published immediately).
          </p>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 mb-8">
          <p className="text-sm font-semibold text-indigo-900 mb-1">🤖 AI Moderation Sensitivity</p>
          <p className="text-xs text-indigo-700 mb-3">
            New/resubmitted products are auto-reviewed by Gemini. Auto-APPROVE only fires when the verdict AND both thresholds below are met — otherwise it falls back to NEEDS_REVISION or a normal PENDING human review. Raising either threshold makes auto-approval rarer (the safer direction).
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-medium text-indigo-700 mb-1">Min. Score (0-100)</label>
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
              <label className="block text-[11px] font-medium text-indigo-700 mb-1">Min. Confidence (0-100)</label>
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
              {savingThresholds ? 'Saving…' : thresholdsSaved ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 mb-8 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Add Product Directly (Admin)</h2>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <input
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="UI Kits / AI Prompts / Templates / E-Books"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <RichTextEditor required rows={3} value={description} onChange={setDescription} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Price (GEL, 0 = free)</label>
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

          <ImageGalleryUploader
            coverUrl={imageUrl}
            onCoverChange={setImageUrl}
            previewImages={previewImages}
            onPreviewImagesChange={setPreviewImages}
            uploadImage={uploadProductImage}
            lang="en"
            labels={{
              coverLabel: 'Main Cover Image (required)',
              coverHint: imageUrl ? 'Click or drop to replace' : 'Click or drop an image',
              coverSizeHint: 'Recommended size: 2000 × 1500 px (4:3 ratio) or 2000 × 2000 px. PNG/JPG, up to 10MB.',
              galleryLabel: 'Additional Screenshots',
              gallerySizeHint: 'Upload up to 4 preview images (Recommended: 2000 × 1500 px).',
              addMore: 'Add',
              uploading: 'Uploading…',
              remove: 'Remove',
              uploadFailed: 'Upload failed.',
            }}
          />
          {!imageUrl && <p className="text-xs text-amber-600">Cover image is required.</p>}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Downloadable Product File</label>
            <FileDropzone
              accept={ASSET_ACCEPT}
              uploading={fileUploading}
              selectedFileName={assetFilenameFromUrl(fileUrl)}
              onFile={handleAssetFile}
              label="Drag & drop the product file here, or click to browse"
              hint="ZIP, PDF, EPUB, RAR, 7Z, FIG, SKETCH, PSD, AI, DOC, DOCX, MP4, or MOV — up to 200MB"
              uploadingLabel="Uploading…"
            />
            {fileUploadError && <p className="text-xs text-red-600 mt-1">{fileUploadError}</p>}
            {!fileUrl && !fileUploading && <p className="text-xs text-amber-600 mt-1">Required — only revealed to buyers after purchase</p>}
          </div>

          <button
            type="submit"
            disabled={submitting || !imageUrl || !fileUrl || fileUploading}
            className="text-sm font-medium text-white bg-indigo-600 px-5 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Add Product'}
          </button>
        </form>

        <div className="flex items-center gap-2 mb-4">
          {['PENDING', 'NEEDS_REVISION', 'APPROVED', 'REJECTED', ''].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              {s || 'All'}
              {s === 'PENDING' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </button>
          ))}
        </div>

        {actionError && <p className="text-sm text-red-600 mb-4">{actionError}</p>}

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-gray-500">No products here.</p>
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
