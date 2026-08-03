import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { ShoppingBag, CheckCircle2 } from 'lucide-react';
import SiteHeader from '../src/components/layout/SiteHeader';
import SiteFooter from '../src/components/layout/SiteFooter';
import BackButton from '../src/components/common/BackButton';
import { getProducts, DigitalProduct } from '../src/services/productService';
import { formatPrice } from '../src/utils/coursePricing';

const dict = {
  ka: {
    title: 'ციფრული პროდუქტების მაღაზია',
    subtitle: 'UI Kits, AI Prompts, შაბლონები და ელექტრონული წიგნები — მზად გამოსაყენებლად.',
    all: 'ყველა',
    free: 'უფასო',
    owned: 'შენი ნაყიდი',
    details: 'დეტალურად',
    empty: 'ამ კატეგორიაში პროდუქტები ჯერ არ არის.',
    loadFailed: 'პროდუქტების ჩატვირთვა ვერ მოხერხდა.',
  },
  en: {
    title: 'Digital Product Store',
    subtitle: 'UI Kits, AI Prompts, templates, and e-books — ready to use.',
    all: 'All',
    free: 'Free',
    owned: 'Owned',
    details: 'View Details',
    empty: 'No products in this category yet.',
    loadFailed: 'Could not load products.',
  },
};

export default function StorePage() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];

  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);
  const visible = activeCategory ? products.filter((p) => p.category === activeCategory) : products;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>
      <SiteHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/tools" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>

        <div className="mb-10 text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest px-4 py-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full border border-purple-500/20 mb-4">
            <ShoppingBag className="w-3.5 h-3.5" />
            CDC Store
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-wide mb-3">{t.title}</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed">{t.subtitle}</p>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={`text-xs font-bold px-4 py-2 rounded-full border transition-colors ${
                activeCategory === null
                  ? 'bg-slate-900 dark:bg-cyan-600 text-white border-transparent'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.all}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`text-xs font-bold px-4 py-2 rounded-full border transition-colors ${
                  activeCategory === cat
                    ? 'bg-slate-900 dark:bg-cyan-600 text-white border-transparent'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-16">…</p>
        ) : error ? (
          <p className="text-sm text-red-500 text-center py-16">{t.loadFailed}</p>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-16 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.empty}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((product) => (
              <Link
                key={product.id}
                href={`/store/${product.id}`}
                className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden no-underline text-current hover:border-cyan-400 dark:hover:border-cyan-500 transition-colors flex flex-col"
              >
                <div className="relative w-full aspect-video bg-slate-100 dark:bg-slate-800">
                  <Image src={product.imageUrl} alt={product.title} fill className="object-cover" unoptimized />
                  {product.purchased && (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500 text-white shadow">
                      <CheckCircle2 className="w-3 h-3" />
                      {t.owned}
                    </span>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-1.5">{product.category}</span>
                  <h3 className="text-sm font-black tracking-wide mb-1.5 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{product.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 mb-4 flex-1">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black">{product.price === 0 ? t.free : formatPrice(product.price)}</span>
                    <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{t.details} →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <SiteFooter lang={lang === 'ka' ? 'GEO' : 'ENG'} />
    </div>
  );
}
