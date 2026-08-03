import { useState, useEffect, useCallback, FormEvent } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getProducts, createProduct, DigitalProduct } from '../../src/services/productService';
import { formatPrice } from '../../src/utils/coursePricing';

function AdminProductsDashboard() {
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await getProducts());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createProduct({
        title,
        description,
        price: Number(price) || 0,
        category,
        imageUrl,
        fileUrl,
      });
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

  return (
    <>
      <Head>
        <title>Digital Store | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Digital Store</h1>
          <p className="text-sm text-gray-500 mt-1">List new downloadable products (UI Kits, AI Prompts, Templates, E-Books).</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 mb-8 space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
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
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Price (GEL, 0 = free)</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Image URL</label>
              <input
                required
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">File URL (secured, only shown to buyers)</label>
              <input
                required
                type="url"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="text-sm font-medium text-white bg-indigo-600 px-5 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Add Product'}
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-gray-500">No products yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {products.map((p) => (
              <div key={p.id} className="flex gap-4 bg-white border border-gray-200 rounded-xl p-4">
                <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  <Image src={p.imageUrl} alt={p.title} fill className="object-cover" unoptimized />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">{p.category}</span>
                  <h3 className="font-semibold text-gray-900 truncate">{p.title}</h3>
                  <p className="text-xs text-gray-500">{p.price === 0 ? 'Free' : formatPrice(p.price)} · {p.downloadsCount} downloads</p>
                </div>
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
