import { useState, useEffect, useMemo, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { GetStaticProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { ShoppingBag, CheckCircle2, Tag, Star, Plus, Crown, Mic, GraduationCap, ShieldCheck } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { getProducts, productTitle, productDescription, DigitalProduct } from '../../src/services/productService';
import { formatPrice } from '../../src/utils/coursePricing';
import { onImageErrorFallback } from '../../src/utils/imageFallback';
import { MARKETPLACE_CATEGORIES } from '../../src/data/marketplaceCategories';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';

// The 4 CDC-built AI SaaS tools cross-listed under the "Business Tools"
// marketplace category (see the section below the filter chips) — these are
// NOT DigitalProduct rows (no price, no file, no seller — they're live
// dashboard tools, not downloadable purchases), so they're a small fixed
// list rendered directly here rather than seeded into the real product
// catalog, which would misrepresent them as purchasable/reviewable items
// and risk colliding with the real checkout flow. Each pulls its
// title/description/badge from that tool's OWN existing namespace (already
// real-translated across all 9 locales) rather than duplicating fresh copy
// here — only the AI Proctoring system had no reusable 9-locale source
// (its only existing text lives in tools.tsx's own 6-locale inline dict),
// so that one gets new keys directly in marketplace.json instead.
const SAAS_TOOLS = [
  { id: 'educator-hub', href: '/dashboard/tools/educator-hub', icon: Crown, accent: 'from-amber-500 to-purple-600' },
  { id: 'media-studio', href: '/dashboard/tools/media-studio', icon: Mic, accent: 'from-cyan-500 to-purple-600' },
  { id: 'english-tutor', href: '/dashboard/english-tutor', icon: GraduationCap, accent: 'from-purple-500 to-cyan-600' },
  // The task that requested this cross-listing named a
  // `/dashboard/tools/proctored-exam` route that doesn't exist in this
  // codebase — the real AI Proctored Exam feature lives at
  // /dashboard/ai-tools (see tools.tsx's Card 2), Business-account-gated.
  // Linking the nonexistent route would ship a dead link, so this points
  // at the real one instead.
  { id: 'proctoring', href: '/dashboard/ai-tools', icon: ShieldCheck, accent: 'from-cyan-500 to-purple-600' },
] as const;

function MarketplaceContent() {
  const { t } = useTranslation('marketplace');
  const { t: tEdu } = useTranslation('educatorHub');
  const { t: tm } = useTranslation('mediaStudio');
  const { t: th } = useTranslation('home');
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  // MARKETPLACE_CATEGORIES.value only carries ka/en fields (it's the literal
  // ?category= filter value, matching DigitalProduct.category as sellers
  // typed it) — falls back to English for de/es/fr/uk visitors rather than
  // Georgian, same boundary as SiteHeader's catLocale.
  const lang = router.locale === 'ka' ? 'ka' : 'en';

  const categoryParam = typeof router.query.category === 'string' ? router.query.category : null;

  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (category: string | null) => {
    setLoading(true);
    setError(false);
    try {
      setProducts(await getProducts(category ?? undefined));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    load(categoryParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, categoryParam]);

  // Curated marketplace taxonomy first, then any other category values
  // actually present on products (so nothing already published silently
  // disappears from "All" while the catalog is still adopting the new
  // categories) — de-duplicated.
  const categoryChips = useMemo(() => {
    const fromCatalog = Array.from(new Set(products.map((p) => p.category)));
    const curated = MARKETPLACE_CATEGORIES.map((c) => c.value[lang]);
    return Array.from(new Set([...curated, ...fromCatalog]));
  }, [products, lang]);

  const setCategory = (category: string | null) => {
    const query = category ? { category } : {};
    router.push({ pathname: '/marketplace', query }, undefined, { shallow: true });
  };

  // Shown only under the "Business Tools" filter (matches either the ka or
  // en literal value products are actually tagged with — see
  // MARKETPLACE_CATEGORIES' own comment on why category is free text, not
  // an enum), not under "All" — keeps the main catalog view unchanged.
  const showSaasTools = categoryParam === MARKETPLACE_CATEGORIES[0].value.ka || categoryParam === MARKETPLACE_CATEGORIES[0].value.en;

  const saasToolCopy: Record<(typeof SAAS_TOOLS)[number]['id'], { title: string; desc: string; badge: string; cta: string }> = {
    'educator-hub': { title: tEdu('pageTitle'), desc: tEdu('pageSubtitle'), badge: tEdu('vipBadge'), cta: tEdu('trialCta') },
    'media-studio': { title: tm('catalogTitle'), desc: tm('catalogDesc'), badge: tm('catalogTag'), cta: t('saasLaunchCta') },
    'english-tutor': { title: th('imiakoCardTitle'), desc: th('imiakoFeature1'), badge: th('imiakoBadgeFreeTrial'), cta: t('saasLaunchCta') },
    proctoring: { title: t('proctoringTitle'), desc: t('proctoringDesc'), badge: t('proctoringBadge'), cta: t('saasLaunchCta') },
  };

  // Same "sign in, then resume" pattern as this page's own product cards
  // (store/[id].tsx's handleBuy/handleClaim) — a guest lands in the auth
  // modal and, on success, is carried straight into the submission tab
  // instead of being dropped back on the marketplace with nothing continued.
  const goToUpload = () => {
    if (!isAuthenticated) {
      openAuthModal({ onSuccess: () => router.push('/dashboard?tab=products') });
      return;
    }
    router.push('/dashboard?tab=products');
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t('title')} | CDC Platform`}</title>
      </Head>
      <SiteHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>

        <div className="mb-10 text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest px-4 py-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full border border-purple-500/20 mb-4">
            <ShoppingBag className="w-3.5 h-3.5" />
            CDC Marketplace
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-wide mb-3">{t('title')}</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed mb-6">{t('subtitle')}</p>
          <button
            type="button"
            onClick={goToUpload}
            className="inline-flex items-center gap-2 text-sm font-black text-white bg-gradient-to-r from-purple-500 to-cyan-600 px-6 py-3.5 rounded-xl shadow-lg shadow-purple-500/20 hover:shadow-xl transition-all border-none cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t('uploadCta')}
          </button>
        </div>

        {categoryChips.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={`text-xs font-bold px-4 py-2 rounded-full border transition-colors ${
                categoryParam === null
                  ? 'bg-slate-900 dark:bg-cyan-600 text-white border-transparent'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t('all')}
            </button>
            {categoryChips.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`text-xs font-bold px-4 py-2 rounded-full border transition-colors ${
                  categoryParam === cat
                    ? 'bg-slate-900 dark:bg-cyan-600 text-white border-transparent'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {showSaasTools && (
          <div className="mb-10">
            <div className="text-center mb-5">
              <h2 className="text-lg font-black tracking-wide">{t('saasToolsHeading')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('saasToolsSubheading')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {SAAS_TOOLS.map(({ id, href, icon: Icon, accent }) => {
                const copy = saasToolCopy[id];
                return (
                  <Link
                    key={id}
                    href={href}
                    className="group rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 overflow-hidden no-underline text-current p-5 flex gap-4 items-start"
                  >
                    <div className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-tr ${accent} flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <h3 className="text-sm font-black tracking-wide group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{copy.title}</h3>
                      </div>
                      <span className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 mb-2">
                        {copy.badge}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 mb-2">{copy.desc}</p>
                      <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{copy.cta} →</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-16">…</p>
        ) : error ? (
          <p className="text-sm text-red-500 text-center py-16">{t('loadFailed')}</p>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-16 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/store/${product.id}`}
                className="group rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 overflow-hidden no-underline text-current hover:border-cyan-400 dark:hover:border-cyan-500 transition-colors flex flex-col"
              >
                <div className="relative w-full aspect-video overflow-hidden bg-slate-900">
                  <Image
                    src={product.imageUrl}
                    alt={productTitle(product, lang)}
                    fill
                    className="object-cover object-center"
                    unoptimized
                    onError={onImageErrorFallback}
                  />
                  {product.fileFormat && (
                    <span className="absolute top-3 left-3 inline-flex items-center text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-black/60 text-white shadow">
                      {product.fileFormat}
                    </span>
                  )}
                  {product.saleActive && (
                    <span className="absolute top-3 right-3 z-10 text-xs font-black text-white px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 shadow-lg shadow-rose-500/30">
                      -{Math.round((1 - product.currentPrice / product.price) * 100)}%
                    </span>
                  )}
                  {product.purchased && (
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500 text-white shadow">
                      <CheckCircle2 className="w-3 h-3" />
                      {t('owned')}
                    </span>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">{product.category}</span>
                    {product.salesCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                        <Tag className="w-3 h-3" />
                        {t(product.salesCount === 1 ? 'salesCount' : 'salesCountPlural', { count: product.salesCount })}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-black tracking-wide mb-1.5 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{productTitle(product, lang)}</h3>
                  {product.reviewCount > 0 && (
                    <div className="flex items-center gap-1 mb-1.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{product.averageRating?.toFixed(1)}</span>
                      <span className="text-xs text-slate-400">({product.reviewCount})</span>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 mb-4 flex-1">{productDescription(product, lang)}</p>
                  <div className="flex items-center justify-between">
                    <span className="flex items-baseline gap-1.5">
                      {product.saleActive && <s className="text-xs text-slate-500">{formatPrice(product.price)}</s>}
                      <span className="text-base font-black">{product.currentPrice === 0 ? t('free') : formatPrice(product.currentPrice)}</span>
                    </span>
                    <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{t('details')} →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

export default function MarketplacePage() {
  return <MarketplaceContent />;
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['marketplace', 'educatorHub', 'mediaStudio', 'home'])) },
});
