import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { GetStaticProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { ShoppingBag, CheckCircle2, Tag, Star, Plus, Crown, Mic, GraduationCap, ShieldCheck, Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { getProducts, productTitle, productDescription, DigitalProduct } from '../../src/services/productService';
import { formatPrice } from '../../src/utils/coursePricing';
import { onImageErrorFallback } from '../../src/utils/imageFallback';
import { MARKETPLACE_CATEGORIES } from '../../src/data/marketplaceCategories';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';
import { getSiteContent } from '../../src/services/siteContentService';
import { ToolCatalogContent } from '../../src/types/siteContent';
import { findToolEntry, overrideText } from '../../src/utils/toolCatalog';

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
  // Self-service practice version — distinct from the Business-gated
  // candidate-screening system at /dashboard/ai-tools (tools.tsx's Card 2).
  { id: 'proctoring', href: '/dashboard/tools/proctored-exam', icon: ShieldCheck, accent: 'from-cyan-500 to-purple-600' },
] as const;

type SortOption = 'newest' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'popularity';
const SORT_OPTIONS: SortOption[] = ['newest', 'name_asc', 'name_desc', 'price_asc', 'price_desc', 'popularity'];
const SORT_LABEL_KEYS: Record<SortOption, string> = {
  newest: 'sortNewest',
  name_asc: 'sortAlphaAsc',
  name_desc: 'sortAlphaDesc',
  price_asc: 'sortPriceAsc',
  price_desc: 'sortPriceDesc',
  popularity: 'sortPopularity',
};
type PriceFilter = 'all' | 'free' | 'paid';
const PRICE_FILTERS: PriceFilter[] = ['all', 'free', 'paid'];
const PRICE_FILTER_LABEL_KEYS: Record<PriceFilter, string> = { all: 'all', free: 'free', paid: 'paid' };

const SEARCH_DEBOUNCE_MS = 300;

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
  // Admin-editable overrides for the SaaS tool cards below (pages/admin/tools.tsx)
  // — null until loaded, at which point findToolEntry/overrideText below
  // fall back to each card's existing static/i18n copy for any unset field.
  const [toolCatalog, setToolCatalog] = useState<ToolCatalogContent | null>(null);

  useEffect(() => {
    getSiteContent<ToolCatalogContent>('tool-catalog')
      .then((row) => setToolCatalog(row?.content ?? {}))
      .catch(() => setToolCatalog({}));
  }, []);

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

  // ---- Sorting, price filter/range, and search — all mirrored into the URL
  // (?sort=&price=&minPrice=&maxPrice=&search=&category=) so a filtered view
  // is directly shareable, same shallow-routing approach categoryParam above
  // already uses. Hydrated FROM the URL exactly once (hydratedFromUrlRef)
  // so a shared link opens pre-filtered; every change after that flows the
  // other way (state -> URL) via the sync effect below. ----
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // Only this debounced value drives actual filtering/URL sync — searchInput
  // itself updates the text box instantly so typing never feels laggy.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hydratedFromUrlRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || hydratedFromUrlRef.current) return;
    hydratedFromUrlRef.current = true;
    const q = router.query;
    if (typeof q.sort === 'string' && (SORT_OPTIONS as string[]).includes(q.sort)) setSortBy(q.sort as SortOption);
    if (typeof q.price === 'string' && (PRICE_FILTERS as string[]).includes(q.price)) setPriceFilter(q.price as PriceFilter);
    if (typeof q.minPrice === 'string') setMinPriceInput(q.minPrice);
    if (typeof q.maxPrice === 'string') setMaxPriceInput(q.maxPrice);
    if (typeof q.search === 'string') {
      setSearchInput(q.search);
      setDebouncedSearch(q.search);
    }
  }, [router.isReady, router.query]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const setCategory = (category: string | null) => {
    const query: Record<string, string> = {};
    if (category) query.category = category;
    if (sortBy !== 'newest') query.sort = sortBy;
    if (priceFilter !== 'all') query.price = priceFilter;
    if (minPriceInput.trim()) query.minPrice = minPriceInput.trim();
    if (maxPriceInput.trim()) query.maxPrice = maxPriceInput.trim();
    if (debouncedSearch.trim()) query.search = debouncedSearch.trim();
    router.push({ pathname: '/marketplace', query }, undefined, { shallow: true });
  };

  // Every OTHER filter change (sort/price/range/search) replaces the URL in
  // place — no new history entry per keystroke/toggle, unlike setCategory's
  // push above (a deliberate navigation the back button should undo).
  // Skipped until hydration has run once, so this can never fire before the
  // initial URL state is read and silently wipe a shared link's params.
  useEffect(() => {
    if (!router.isReady || !hydratedFromUrlRef.current) return;
    const query: Record<string, string> = {};
    if (categoryParam) query.category = categoryParam;
    if (sortBy !== 'newest') query.sort = sortBy;
    if (priceFilter !== 'all') query.price = priceFilter;
    if (minPriceInput.trim()) query.minPrice = minPriceInput.trim();
    if (maxPriceInput.trim()) query.maxPrice = maxPriceInput.trim();
    if (debouncedSearch.trim()) query.search = debouncedSearch.trim();
    router.replace({ pathname: '/marketplace', query }, undefined, { shallow: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, priceFilter, minPriceInput, maxPriceInput, debouncedSearch]);

  const hasActiveFilters =
    sortBy !== 'newest' || priceFilter !== 'all' || !!minPriceInput.trim() || !!maxPriceInput.trim() || !!debouncedSearch.trim() || !!categoryParam;

  const resetAllFilters = () => {
    setSortBy('newest');
    setPriceFilter('all');
    setMinPriceInput('');
    setMaxPriceInput('');
    setSearchInput('');
    setDebouncedSearch('');
    if (categoryParam) setCategory(null);
    setFiltersOpen(false);
  };

  // Georgian collation: plain codepoint order (what a bare .sort() or a
  // locale-less localeCompare falls back to) does not reliably follow the
  // traditional ა -> ჰ ordering — explicitly passing 'ka' (vs. 'en' for
  // every other site locale, matching the lang boundary already used
  // throughout this page) is what actually gets it right.
  const collatorLocale = lang === 'ka' ? 'ka' : 'en';

  const visibleProducts = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    const min = minPriceInput.trim() ? parseFloat(minPriceInput) : null;
    const max = maxPriceInput.trim() ? parseFloat(maxPriceInput) : null;

    const filtered = products.filter((p) => {
      if (priceFilter === 'free' && p.currentPrice !== 0) return false;
      if (priceFilter === 'paid' && p.currentPrice === 0) return false;
      const priceInGel = p.currentPrice / 100;
      if (min !== null && !Number.isNaN(min) && priceInGel < min) return false;
      if (max !== null && !Number.isNaN(max) && priceInGel > max) return false;
      if (query) {
        const haystack = `${productTitle(p, lang)} ${productDescription(p, lang)} ${p.category}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
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
          return b.salesCount - a.salesCount;
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [products, debouncedSearch, priceFilter, minPriceInput, maxPriceInput, sortBy, lang, collatorLocale]);

  // Shown only under the "Business Tools" filter (matches either the ka or
  // en literal value products are actually tagged with — see
  // MARKETPLACE_CATEGORIES' own comment on why category is free text, not
  // an enum), not under "All" — keeps the main catalog view unchanged.
  const showSaasTools = categoryParam === MARKETPLACE_CATEGORIES[0].value.ka || categoryParam === MARKETPLACE_CATEGORIES[0].value.en;

  const saasToolDefaults: Record<(typeof SAAS_TOOLS)[number]['id'], { title: string; desc: string; badge: string; cta: string }> = {
    'educator-hub': { title: tEdu('pageTitle'), desc: tEdu('pageSubtitle'), badge: tEdu('vipBadge'), cta: tEdu('trialCta') },
    'media-studio': { title: tm('catalogTitle'), desc: tm('catalogDesc'), badge: tm('catalogTag'), cta: t('saasLaunchCta') },
    'english-tutor': { title: th('imiakoCardTitle'), desc: th('imiakoFeature1'), badge: th('imiakoBadgeFreeTrial'), cta: t('saasLaunchCta') },
    proctoring: { title: t('proctoringTitle'), desc: t('proctoringDesc'), badge: t('proctoringBadge'), cta: t('saasLaunchCta') },
  };

  type SaasToolCopy = { title: string; desc: string; badge: string; cta: string; status: 'ACTIVE' | 'COMING_SOON' | 'DISABLED' };

  // Layers pages/admin/tools.tsx's saved overrides on top of the defaults
  // above — a DISABLED entry is hidden entirely, COMING_SOON swaps the CTA
  // for a non-clickable badge instead of launching the (not yet ready)
  // tool.
  const saasToolCopy = SAAS_TOOLS.reduce((acc, { id }) => {
    const fallback = saasToolDefaults[id];
    const cms = findToolEntry(toolCatalog?.tools, id);
    acc[id] = {
      title: overrideText(fallback.title, lang === 'ka' ? cms?.titleKa : cms?.titleEn),
      desc: overrideText(fallback.desc, lang === 'ka' ? cms?.descriptionKa : cms?.descriptionEn),
      badge: overrideText(fallback.badge, lang === 'ka' ? cms?.badgeKa : cms?.badgeEn),
      cta: fallback.cta,
      status: cms?.status ?? 'ACTIVE',
    };
    return acc;
  }, {} as Record<(typeof SAAS_TOOLS)[number]['id'], SaasToolCopy>);

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

  // Same pattern as goToUpload above — a guest clicking a SaaS tool card
  // gets the auth modal (continuing straight into the tool on success)
  // rather than a plain <Link> that would silently full-navigate into
  // ProtectedRoute's own redirect-to-/auth/login dance on the destination
  // page. Kept as its own handler (not goToUpload) since the destination
  // varies per card.
  const goToSaasTool = (href: string) => {
    if (!isAuthenticated) {
      openAuthModal({ onSuccess: () => router.push(href) });
      return;
    }
    router.push(href);
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
              {SAAS_TOOLS.filter(({ id }) => saasToolCopy[id].status !== 'DISABLED').map(({ id, href, icon: Icon, accent }) => {
                const copy = saasToolCopy[id];
                const comingSoon = copy.status === 'COMING_SOON';
                return (
                  <div
                    key={id}
                    role="button"
                    tabIndex={0}
                    onClick={() => !comingSoon && goToSaasTool(href)}
                    onKeyDown={(e) => {
                      if (!comingSoon && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        goToSaasTool(href);
                      }
                    }}
                    className={`group rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 overflow-hidden p-5 flex gap-4 items-start ${
                      comingSoon ? 'opacity-80' : 'cursor-pointer hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10'
                    }`}
                  >
                    <div className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-tr ${accent} flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <h3 className="text-sm font-black tracking-wide group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{copy.title}</h3>
                      </div>
                      <span className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 mb-2">
                        {comingSoon ? t('comingSoonBadge') : copy.badge}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 mb-2">{copy.desc}</p>
                      {!comingSoon && <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{copy.cta} →</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Sort dropdown — inline on desktop, hidden here (moved into the
                  drawer) below md, where SORT_LABEL_KEYS + the price controls
                  collapse behind the "Filters" button instead. */}
              <div className="relative hidden md:block shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label={t('sortLabel')}
                  className="appearance-none pl-4 pr-9 py-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {t(SORT_LABEL_KEYS[opt])}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>

              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="md:hidden shrink-0 inline-flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {t('filtersButton')}
                {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />}
              </button>
            </div>

            {/* Price chips + range — inline on desktop; rendered a second
                time inside the mobile drawer below (FilterExtras) rather than
                just hidden here, so the drawer isn't empty. */}
            <div className="hidden md:flex flex-wrap items-center gap-3 mt-3">
              <div className="flex gap-2">
                {PRICE_FILTERS.map((pf) => (
                  <button
                    key={pf}
                    type="button"
                    onClick={() => setPriceFilter(pf)}
                    className={`text-xs font-bold px-3.5 py-1.5 rounded-full border transition-colors ${
                      priceFilter === pf
                        ? 'bg-slate-900 dark:bg-cyan-600 text-white border-transparent'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t(PRICE_FILTER_LABEL_KEYS[pf])}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={minPriceInput}
                  onChange={(e) => setMinPriceInput(e.target.value)}
                  placeholder={t('minPricePlaceholder')}
                  className="w-28 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <span className="text-xs text-slate-400">–</span>
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={maxPriceInput}
                  onChange={(e) => setMaxPriceInput(e.target.value)}
                  placeholder={t('maxPricePlaceholder')}
                  className="w-28 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline bg-transparent border-none cursor-pointer ml-auto"
                >
                  {t('resetFilters')}
                </button>
              )}
            </div>

            {/* Mobile-only active-filter reset (desktop's lives inline above) */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="md:hidden mt-3 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline bg-transparent border-none cursor-pointer"
              >
                {t('resetFilters')}
              </button>
            )}
          </div>
        )}

        {/* Mobile filter drawer — bottom sheet with the sort dropdown + price
            chips/range that live inline on desktop above. */}
        {filtersOpen && (
          <div className="fixed inset-0 z-[100] flex items-end md:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setFiltersOpen(false)} />
            <div className="relative w-full max-h-[85vh] rounded-t-2xl bg-white dark:bg-[#0e1422] shadow-2xl overflow-y-auto">
              <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0e1422]/95 backdrop-blur-md">
                <h2 className="text-sm font-black text-slate-900 dark:text-white">{t('filtersButton')}</h2>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  aria-label={t('modalClose')}
                  className="p-1.5 rounded-lg border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t('sortLabel')}</label>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="w-full appearance-none pl-4 pr-9 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {t(SORT_LABEL_KEYS[opt])}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t('priceRangeLabel')}</label>
                  <div className="flex gap-2 mb-3">
                    {PRICE_FILTERS.map((pf) => (
                      <button
                        key={pf}
                        type="button"
                        onClick={() => setPriceFilter(pf)}
                        className={`flex-1 text-xs font-bold px-3 py-2 rounded-lg border transition-colors ${
                          priceFilter === pf
                            ? 'bg-slate-900 dark:bg-cyan-600 text-white border-transparent'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {t(PRICE_FILTER_LABEL_KEYS[pf])}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={minPriceInput}
                      onChange={(e) => setMinPriceInput(e.target.value)}
                      placeholder={t('minPricePlaceholder')}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <span className="text-xs text-slate-400">–</span>
                    <input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={maxPriceInput}
                      onChange={(e) => setMaxPriceInput(e.target.value)}
                      placeholder={t('maxPricePlaceholder')}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="flex-1 text-sm font-bold px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-transparent cursor-pointer"
                    >
                      {t('resetFilters')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="flex-1 text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-cyan-600 px-4 py-2.5 rounded-lg border-none cursor-pointer"
                  >
                    {t('applyFilters')}
                  </button>
                </div>
              </div>
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
        ) : visibleProducts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none p-16 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{t('noResultsFiltered')}</p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline bg-transparent border-none cursor-pointer"
            >
              {t('resetFilters')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleProducts.map((product) => (
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
                      {t('owned', 'შეძენილი')}
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
