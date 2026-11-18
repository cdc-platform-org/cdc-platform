// Digital Store (ციფრული მარკეტი). Layout, top to bottom:
//   title + "add product" → search, category chips (with counts), sort/price
//   → AI tools section → coloring pages section → other digital products.
// Each section shows a few cards and a "Show more" button (StoreSection).
// Picking a chip or typing a search switches to one filtered list.
// Categories are the fixed keys in src/data/productCategories.ts (the API
// already normalizes old free-text values); admin-highlighted products and
// tools come first in the default "Recommended" sort.
import { useState, useEffect, useMemo, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { GetStaticProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { Plus, ShoppingBag } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { getProducts, productTitle, productDescription, DigitalProduct } from '../../src/services/productService';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';
import {
  AI_TOOLS_FILTER,
  PRODUCT_CATEGORIES,
  highlightRank,
  isAiToolsFilter,
  isProductCategoryKey,
  normalizeProductCategory,
  productCategoryLabel,
} from '../../src/data/productCategories';
import { useStoreTools, StoreTool } from '../../src/components/marketplace/useStoreTools';
import { ToolCard, ProductCard } from '../../src/components/marketplace/StoreCards';
import StoreSection from '../../src/components/marketplace/StoreSection';
import StoreToolbar, { CategoryChip, PriceFilter, PRICE_FILTERS, SortOption, SORT_OPTIONS } from '../../src/components/marketplace/StoreToolbar';

const SEARCH_DEBOUNCE_MS = 300;
// How many cards each section shows before "Show more".
const TOOLS_INITIAL = 3;
const COLORING_INITIAL = 3;
const OTHER_INITIAL = 6;
const FILTERED_INITIAL = 9;
const INTERNAL_CATEGORY_MARKER = /(?:^|[^a-z0-9])(?:qa|e2e|test(?:ing)?|fixture|fixtures|demo|seed)(?:$|[^a-z0-9])/i;

// ?category= may be the new key, the "ai-tools" chip, or an old free-text
// link (bookmarks, other pages) — all resolve to one chip value.
function resolveCategoryParam(value: string | null): string | null {
  if (!value) return null;
  if (isAiToolsFilter(value)) return AI_TOOLS_FILTER;
  if (isProductCategoryKey(value)) return value;
  return normalizeProductCategory(value);
}

function MarketplaceContent() {
  const { t } = useTranslation('marketplace');
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { openAuthModal } = useAuthModal();
  // Product/tool text only exists in ka/en; other locales read English.
  const lang = router.locale === 'ka' ? 'ka' : 'en';
  const collatorLocale = lang;

  const activeCategory = resolveCategoryParam(typeof router.query.category === 'string' ? router.query.category : null);
  const { tools } = useStoreTools(lang, !!user?.adminRole);

  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getProducts()
      .then((catalog) =>
        setProducts(
          catalog
            .filter((p) => !INTERNAL_CATEGORY_MARKER.test(p.category))
            // Already normalized by the API; repeated so the page also works
            // against an API that hasn't been redeployed yet.
            .map((p) => ({ ...p, category: normalizeProductCategory(p.category, p.title) }))
        )
      )
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // ---- Filters, mirrored into the URL so a filtered view is shareable.
  // Read FROM the URL once (hydratedFromUrlRef); after that state -> URL.
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const hydratedFromUrlRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || hydratedFromUrlRef.current) return;
    hydratedFromUrlRef.current = true;
    const q = router.query;
    if (typeof q.sort === 'string' && (SORT_OPTIONS as string[]).includes(q.sort)) setSortBy(q.sort as SortOption);
    if (typeof q.price === 'string' && (PRICE_FILTERS as string[]).includes(q.price)) setPriceFilter(q.price as PriceFilter);
    if (typeof q.minPrice === 'string') setMinPrice(q.minPrice);
    if (typeof q.maxPrice === 'string') setMaxPrice(q.maxPrice);
    if (typeof q.search === 'string') {
      setSearchInput(q.search);
      setSearch(q.search);
    }
  }, [router.isReady, router.query]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const buildQuery = (category: string | null) => {
    const query: Record<string, string> = {};
    if (category) query.category = category;
    if (sortBy !== 'featured') query.sort = sortBy;
    if (priceFilter !== 'all') query.price = priceFilter;
    if (minPrice.trim()) query.minPrice = minPrice.trim();
    if (maxPrice.trim()) query.maxPrice = maxPrice.trim();
    if (search.trim()) query.search = search.trim();
    return query;
  };

  // A chip is a real navigation (back button undoes it); other filter
  // changes replace the URL in place.
  const setCategory = (category: string | null) => {
    router.push({ pathname: '/marketplace', query: buildQuery(category) }, undefined, { shallow: true, scroll: false });
  };

  useEffect(() => {
    if (!router.isReady || !hydratedFromUrlRef.current) return;
    router.replace({ pathname: '/marketplace', query: buildQuery(activeCategory) }, undefined, { shallow: true, scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, priceFilter, minPrice, maxPrice, search]);

  const priceActive = priceFilter !== 'all' || !!minPrice.trim() || !!maxPrice.trim();
  const query = search.trim().toLowerCase();
  const hasActiveFilters = sortBy !== 'featured' || priceActive || !!query || !!activeCategory;

  const resetAllFilters = () => {
    setSortBy('featured');
    setPriceFilter('all');
    setMinPrice('');
    setMaxPrice('');
    setSearchInput('');
    setSearch('');
    if (activeCategory) setCategory(null);
  };

  // Search + price filter + sort (category is applied per view below).
  const filteredProducts = useMemo(() => {
    const min = minPrice.trim() ? parseFloat(minPrice) : null;
    const max = maxPrice.trim() ? parseFloat(maxPrice) : null;
    const list = products.filter((p) => {
      if (priceFilter === 'free' && p.currentPrice !== 0) return false;
      if (priceFilter === 'paid' && p.currentPrice === 0) return false;
      const gel = p.currentPrice / 100;
      if (min !== null && !Number.isNaN(min) && gel < min) return false;
      if (max !== null && !Number.isNaN(max) && gel > max) return false;
      if (query) {
        const haystack = `${productTitle(p, lang)} ${productDescription(p, lang)} ${productCategoryLabel(p.category, lang, p.title)}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
    const newest = (a: DigitalProduct, b: DigitalProduct) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return list.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return productTitle(a, lang).localeCompare(productTitle(b, lang), collatorLocale, { sensitivity: 'base' });
        case 'name_desc':
          return productTitle(b, lang).localeCompare(productTitle(a, lang), collatorLocale, { sensitivity: 'base' });
        case 'price_asc':
          return a.currentPrice - b.currentPrice;
        case 'price_desc':
          return b.currentPrice - a.currentPrice;
        case 'popularity':
          return b.salesCount - a.salesCount || newest(a, b);
        case 'newest':
          return newest(a, b);
        case 'featured':
        default:
          // Admin-flagged first, then best sellers, then newest.
          return highlightRank(a.highlight) - highlightRank(b.highlight) || b.salesCount - a.salesCount || newest(a, b);
      }
    });
  }, [products, priceFilter, minPrice, maxPrice, query, sortBy, lang, collatorLocale]);

  // Tools have no fixed price, so a price filter hides them.
  const filteredTools = useMemo(() => {
    if (priceActive) return [];
    if (!query) return tools;
    return tools.filter((tool) => `${tool.title} ${tool.desc} ${tool.badge}`.toLowerCase().includes(query));
  }, [tools, query, priceActive]);

  const chips: CategoryChip[] = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((p) => counts.set(p.category, (counts.get(p.category) ?? 0) + 1));
    return [
      { value: AI_TOOLS_FILTER, label: t('aiToolsChip'), emoji: '🤖', count: tools.length },
      ...PRODUCT_CATEGORIES.filter((c) => (counts.get(c.key) ?? 0) > 0).map((c) => ({
        value: c.key,
        label: lang === 'ka' ? c.labelKa : c.labelEn,
        emoji: c.emoji,
        count: counts.get(c.key) ?? 0,
      })),
    ];
  }, [products, tools.length, lang, t]);

  const goToUpload = () => {
    if (!isAuthenticated) {
      openAuthModal({ onSuccess: () => router.push('/dashboard?tab=products') });
      return;
    }
    router.push('/dashboard?tab=products');
  };

  const sectionLabels = { showMoreLabel: t('showMore'), showLessLabel: t('showLess') };
  const renderTool = (tool: StoreTool) => <ToolCard tool={tool} lang={lang} />;
  const renderProduct = (product: DigitalProduct) => <ProductCard product={product} lang={lang} />;
  const toolsSection = (initial: number) => (
    <StoreSection id="ai-tools" emoji="🤖" title={t('saasToolsHeading')} subtitle={t('saasToolsSubheading')} items={filteredTools} initial={initial} renderItem={renderTool} getKey={(x) => x.id} {...sectionLabels} />
  );

  const browsing = !activeCategory && !query && !priceActive;
  const coloringLabel = PRODUCT_CATEGORIES.find((c) => c.key === 'coloring')!;
  const coloring = filteredProducts.filter((p) => p.category === 'coloring');
  const others = filteredProducts.filter((p) => p.category !== 'coloring');

  let body: React.ReactNode;
  if (browsing) {
    body = (
      <>
        {toolsSection(TOOLS_INITIAL)}
        <StoreSection id="coloring" emoji={coloringLabel.emoji} title={lang === 'ka' ? coloringLabel.labelKa : coloringLabel.labelEn} subtitle={t('coloringSubtitle')} items={coloring} initial={COLORING_INITIAL} renderItem={renderProduct} getKey={(x) => x.id} {...sectionLabels} />
        <StoreSection id="products" emoji="🛍️" title={t('otherProductsTitle')} subtitle={t('otherProductsSubtitle')} items={others} initial={OTHER_INITIAL} renderItem={renderProduct} getKey={(x) => x.id} {...sectionLabels} />
      </>
    );
  } else if (activeCategory === AI_TOOLS_FILTER) {
    body = toolsSection(filteredTools.length);
  } else {
    const list = activeCategory ? filteredProducts.filter((p) => p.category === activeCategory) : filteredProducts;
    const def = PRODUCT_CATEGORIES.find((c) => c.key === activeCategory);
    const showTools = !activeCategory && filteredTools.length > 0;
    body = (
      <>
        {(query || priceActive) && <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6">{t('resultsFound', { count: list.length + (showTools ? filteredTools.length : 0) })}</p>}
        {showTools && toolsSection(TOOLS_INITIAL)}
        <StoreSection
          key={activeCategory ?? 'all'}
          id="products"
          emoji={def?.emoji ?? '🛍️'}
          title={def ? (lang === 'ka' ? def.labelKa : def.labelEn) : t('productsHeading')}
          items={list}
          initial={FILTERED_INITIAL}
          renderItem={renderProduct}
          getKey={(x) => x.id}
          {...sectionLabels}
        />
        {list.length === 0 && !showTools && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-16 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{products.length === 0 ? t('empty') : t('noResultsFiltered')}</p>
            <button type="button" onClick={resetAllFilters} className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline bg-transparent border-none cursor-pointer">
              {t('resetFilters')}
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t('title')} | CDC Platform`}</title>
      </Head>
      <SiteHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-10 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>

        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest px-3 py-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full border border-purple-500/20 mb-3">
              <ShoppingBag className="w-3.5 h-3.5" />
              CDC Marketplace
            </span>
            <h1 className="text-3xl md:text-4xl font-black tracking-wide mb-2">{t('title')}</h1>
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed">{t('subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={goToUpload}
            className="self-start md:self-auto shrink-0 inline-flex items-center gap-2 text-sm font-black text-white bg-gradient-to-r from-purple-500 to-cyan-600 px-5 py-3 rounded-xl shadow-lg shadow-purple-500/20 hover:shadow-xl transition-all border-none cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t('uploadCta')}
          </button>
        </div>

        <StoreToolbar
          search={searchInput}
          onSearch={setSearchInput}
          chips={chips}
          activeCategory={activeCategory}
          onCategory={setCategory}
          sortBy={sortBy}
          onSort={setSortBy}
          priceFilter={priceFilter}
          onPriceFilter={setPriceFilter}
          minPrice={minPrice}
          maxPrice={maxPrice}
          onMinPrice={setMinPrice}
          onMaxPrice={setMaxPrice}
          hasActiveFilters={hasActiveFilters}
          onReset={resetAllFilters}
        />

        {loading ? (
          <>
            {toolsSection(TOOLS_INITIAL)}
            <p className="text-sm text-slate-400 text-center py-16">…</p>
          </>
        ) : error ? (
          <>
            {toolsSection(TOOLS_INITIAL)}
            <p className="text-sm text-red-500 text-center py-16">{t('loadFailed')}</p>
          </>
        ) : (
          body
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
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['marketplace', 'educatorHub', 'mediaStudio', 'home', 'childrensBook'])) },
});
