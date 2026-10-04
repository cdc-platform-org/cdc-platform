import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getAdminProducts, DigitalProduct, productTitle } from '../../src/services/productService';
import { getAdminSiteContent } from '../../src/services/siteContentService';
import { ToolCatalogContent, ToolCatalogCategory } from '../../src/types/siteContent';
import { resolveToolCategory } from '../../src/utils/toolCatalog';
import { resolveBlogImageUrl } from '../../src/services/blogService';
import { findRegistryEntry } from '../../src/data/productCatalogRegistry';

// Unified "Products" discovery hub (product spec section 2, 2026-10):
// a single admin view across all 3 digital-ecosystem product types —
// Digital Store (real DigitalProduct rows, their own purchase/entitlement
// engine — see adminProducts.ts/pages/admin/products.tsx, deliberately
// untouched and NOT folded into this list's underlying storage), AI Tools,
// and AI Teachers (both backed by the tool-catalog CMS — see
// pages/admin/tools.tsx). This page is READ/DISCOVER/FILTER only; editing
// happens on each type's own already-proven editor (linked via "Edit"
// below) — a genuinely unified EDIT form isn't safe here: Digital Store
// rows carry pricing/licensing/moderation/purchase-history fields no AI
// Tool/Teacher has, and forcing them into one shape risks hiding or
// corrupting real purchasable-product data for a cosmetic single-form win.
type UnifiedRow = {
  key: string;
  type: 'DIGITAL_STORE' | ToolCatalogCategory;
  title: string;
  coverUrl: string | undefined;
  status: string;
  videoConfigured: boolean;
  editHref: string;
  publicHref: string | null;
};

const TYPE_LABELS: Record<UnifiedRow['type'], string> = {
  DIGITAL_STORE: 'Digital Store',
  AI_TOOL: 'AI Tool',
  AI_TEACHER: 'AI Teacher',
  DIGITAL_PRODUCT_LINK: 'Digital Store',
};

const TYPE_FILTERS: { value: 'ALL' | UnifiedRow['type']; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DIGITAL_STORE', label: 'Digital Store' },
  { value: 'AI_TOOL', label: 'AI Tools' },
  { value: 'AI_TEACHER', label: 'AI Teachers' },
];

function ProductCatalogDashboard() {
  const [digitalProducts, setDigitalProducts] = useState<DigitalProduct[]>([]);
  const [toolCatalog, setToolCatalog] = useState<ToolCatalogContent>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'ALL' | UnifiedRow['type']>('ALL');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [products, toolsRow] = await Promise.all([
        getAdminProducts().catch(() => []),
        getAdminSiteContent<ToolCatalogContent>('tool-catalog').catch(() => null),
      ]);
      setDigitalProducts(products);
      setToolCatalog(toolsRow?.content ?? {});
    } catch {
      setError('Could not load the product catalog.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows: UnifiedRow[] = useMemo(() => {
    const digitalStoreRows: UnifiedRow[] = digitalProducts.map((p) => ({
      key: `dp-${p.id}`,
      type: 'DIGITAL_STORE',
      title: productTitle(p, 'en'),
      coverUrl: p.imageUrl ? resolveBlogImageUrl(p.imageUrl) : undefined,
      status: p.status ?? 'APPROVED',
      videoConfigured: !!p.previewVideoUrl,
      editHref: '/admin/products',
      publicHref: `/store/${p.id}`,
    }));
    const catalogRows: UnifiedRow[] = (toolCatalog.tools ?? []).map((entry) => {
      const type = resolveToolCategory(entry);
      const registryEntry = findRegistryEntry(entry.slug);
      return {
        key: `tc-${entry.slug}`,
        type,
        title: entry.titleEn || entry.titleKa || entry.slug,
        coverUrl: entry.imageUrl ? resolveBlogImageUrl(entry.imageUrl) : undefined,
        status: entry.status,
        videoConfigured: !!entry.videoUrl,
        editHref: '/admin/tools',
        publicHref: registryEntry ? `/products/${entry.slug}` : null,
      };
    });
    return [...digitalStoreRows, ...catalogRows];
  }, [digitalProducts, toolCatalog]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter !== 'ALL' && row.type !== typeFilter) return false;
      if (q && !row.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, typeFilter, search]);

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>;

  return (
    <>
      <Head>
        <title>Products | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every CDC-owned digital product in one place — Digital Store, AI Tools, and AI Teachers. Select a product to edit its presentation on
            its own dedicated editor.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex gap-1">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setTypeFilter(f.value)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                  typeFilter === f.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title…"
            className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5">Cover</th>
                <th className="px-4 py-2.5">Title</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Video</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((row) => (
                <tr key={row.key}>
                  <td className="px-4 py-2.5">
                    {row.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.coverUrl} alt="" className="w-12 h-8 rounded object-cover border border-gray-200" />
                    ) : (
                      <div className="w-12 h-8 rounded bg-gray-100 border border-gray-200" />
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {row.title}
                    {row.publicHref && (
                      <a href={row.publicHref} target="_blank" rel="noopener noreferrer" className="ml-2 text-gray-400 hover:text-indigo-600 inline-block align-middle">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{TYPE_LABELS[row.type]}</td>
                  <td className="px-4 py-2.5 text-gray-500">{row.status}</td>
                  <td className="px-4 py-2.5">
                    {row.videoConfigured ? <span className="text-emerald-600 text-xs font-semibold">✓ Configured</span> : <span className="text-gray-400 text-xs">— None</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={row.editHref} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No products match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function ProductCatalogPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <ProductCatalogDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
