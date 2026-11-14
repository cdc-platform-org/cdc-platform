// /dashboard/designs — "My designs": purchased products that open in the
// design editor, with the buyer's saved designs for each.
// `?product=<id>` (the store page's "Open in editor" link) jumps straight
// into that product's latest design, creating the first one if needed.
import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { PenTool, Plus, Trash2 } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import { designEditorDict } from '../../../src/components/designEditor/i18n';
import { createDesign, deleteDesign, getEditableProducts, type EditableProduct } from '../../../src/services/designService';
import { resolveLocale } from '../../../src/utils/locale';

function DesignsList() {
  const router = useRouter();
  const t = designEditorDict(router.locale);
  const isKa = resolveLocale(router.locale) === 'ka';
  const [products, setProducts] = useState<EditableProduct[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoOpened = useRef(false);

  const load = useCallback(async () => {
    try { setProducts(await getEditableProducts()); } catch { setError(t.notFound); setProducts([]); }
  }, [t.notFound]);

  useEffect(() => { void load(); }, [load]);

  const openNew = useCallback(async (productId: string) => {
    setBusy(productId);
    try {
      const id = await createDesign(productId);
      await router.push(`/dashboard/designs/${id}`);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? t.notFound);
      setBusy(null);
    }
  }, [router, t.notFound]);

  useEffect(() => {
    const productId = typeof router.query.product === 'string' ? router.query.product : null;
    if (!productId || !products || autoOpened.current) return;
    autoOpened.current = true;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    if (product.designs[0]) void router.replace(`/dashboard/designs/${product.designs[0].id}`);
    else void openNew(product.id);
  }, [router, products, openNew]);

  const remove = async (designId: string) => {
    if (!window.confirm(t.confirmDelete)) return;
    await deleteDesign(designId);
    await load();
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head><title>{t.myDesigns} | CDC</title></Head>
      <SiteHeader />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
        <BackButton />
        <h1 className="mt-4 text-2xl font-black">{t.myDesigns}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.myDesignsSubtitle}</p>
        {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}

        {!products ? (
          <p className="mt-8 text-sm">{t.loading}</p>
        ) : products.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
            <p className="text-sm">{t.empty}</p>
            <Link href="/store" className="mt-4 inline-block rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2 text-sm font-semibold no-underline">{t.goToStore}</Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {products.map((product) => (
              <li key={product.id} className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="flex gap-3 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.imageUrl} alt="" className="h-20 w-20 rounded-lg object-cover bg-slate-100" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight">{isKa ? product.title : product.titleEn || product.title}</p>
                    <button type="button" disabled={busy === product.id} onClick={() => openNew(product.id)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                      <Plus size={14} /> {t.newDesign}
                    </button>
                  </div>
                </div>
                {product.designs.length > 0 && (
                  <ul className="border-t border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
                    {product.designs.map((design) => (
                      <li key={design.id} className="flex items-center gap-2 px-4 py-2">
                        <PenTool size={14} className="text-slate-400 shrink-0" />
                        <Link href={`/dashboard/designs/${design.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{design.title}</Link>
                        <span className="hidden sm:inline text-xs text-slate-500">{t.edited} {new Date(design.updatedAt).toLocaleDateString(isKa ? 'ka-GE' : 'en-GB')}</span>
                        <button type="button" onClick={() => remove(design.id)} title={t.delete} aria-label={t.delete} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export default function DesignsPage() {
  return <ProtectedRoute><DesignsList /></ProtectedRoute>;
}
