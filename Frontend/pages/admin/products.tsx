import { useState, useEffect, useCallback, useMemo, FormEvent } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import {
  getAdminProducts,
  createProduct,
  approveProduct,
  rejectProduct,
  uploadProductImage,
  uploadProductFile,
  DigitalProduct,
} from '../../src/services/productService';
import { formatPrice } from '../../src/utils/coursePricing';

type AdminProduct = DigitalProduct & { submittedBy: { id: string; name: string; email: string } | null };

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

function AdminProductsDashboard() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
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
      await createProduct({ title, description, price: Number(price) || 0, category, imageUrl, fileUrl });
      setTitle('');
      setDescription('');
      setPrice('');
      setCategory('');
      setImageUrl('');
      setFileUrl('');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create product.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return;
    setImageUploadError(null);
    setImageUploading(true);
    try {
      setImageUrl(await uploadProductImage(file));
    } catch (err: any) {
      setImageUploadError(err?.response?.data?.message ?? 'Image upload failed.');
    } finally {
      setImageUploading(false);
    }
  };

  const handleAssetFile = async (file: File | undefined) => {
    if (!file) return;
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
            <textarea required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Price (GEL, 0 = free)</label>
              <input required type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Product Preview Image</label>
              <div className="flex items-center gap-2">
                {imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  disabled={imageUploading}
                  onChange={(e) => handleImageFile(e.target.files?.[0])}
                  className="w-full text-xs"
                />
              </div>
              {imageUploading && <p className="text-xs text-gray-400 mt-1">Uploading…</p>}
              {imageUploadError && <p className="text-xs text-red-600 mt-1">{imageUploadError}</p>}
              {!imageUrl && !imageUploading && <p className="text-xs text-amber-600 mt-1">Required</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Downloadable Product File (Zip/PDF/Asset)</label>
              <input
                type="file"
                accept=".zip,.pdf,.epub,.rar,.7z,.fig,.sketch"
                disabled={fileUploading}
                onChange={(e) => handleAssetFile(e.target.files?.[0])}
                className="w-full text-xs"
              />
              {fileUploading && <p className="text-xs text-gray-400 mt-1">Uploading…</p>}
              {fileUploadError && <p className="text-xs text-red-600 mt-1">{fileUploadError}</p>}
              {fileUrl && !fileUploading && <p className="text-xs text-emerald-600 mt-1 truncate">Uploaded ✓</p>}
              {!fileUrl && !fileUploading && <p className="text-xs text-amber-600 mt-1">Required — only revealed to buyers after purchase</p>}
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || !imageUrl || !fileUrl || imageUploading || fileUploading}
            className="text-sm font-medium text-white bg-indigo-600 px-5 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Add Product'}
          </button>
        </form>

        <div className="flex items-center gap-2 mb-4">
          {['PENDING', 'APPROVED', 'REJECTED', ''].map((s) => (
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
              <div key={p.id} className="flex gap-4 bg-white border border-gray-200 rounded-xl p-4">
                <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  <Image src={p.imageUrl} alt={p.title} fill className="object-cover" unoptimized />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">{p.category}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${STATUS_BADGE[p.status ?? 'PENDING']}`}>{p.status}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 truncate">{p.title}</h3>
                  <p className="text-xs text-gray-500">
                    {p.price === 0 ? 'Free' : formatPrice(p.price)} · {p.downloadsCount} downloads
                    {p.submittedBy && <> · Submitted by {p.submittedBy.name} ({p.submittedBy.email})</>}
                  </p>
                  {p.status === 'REJECTED' && p.rejectionReason && (
                    <p className="text-xs text-red-500 mt-1">Reason: {p.rejectionReason}</p>
                  )}
                </div>
                {p.status === 'PENDING' && (
                  <div className="flex flex-col gap-2 shrink-0 justify-center">
                    <button
                      type="button"
                      onClick={() => handleApprove(p.id)}
                      disabled={actingId === p.id}
                      className="text-xs font-medium text-white bg-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(p.id)}
                      disabled={actingId === p.id}
                      className="text-xs font-medium text-white bg-red-600 px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
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
