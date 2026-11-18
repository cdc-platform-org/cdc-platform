// Search + category chips + sort/price filters for the Digital Store
// (pages/marketplace/index.tsx). Sits right under the page title so a
// visitor sees "what's here" (chips with counts) before the sections.
// Sort and price live inline on desktop and in a bottom sheet on mobile.
import { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';

export type SortOption = 'featured' | 'newest' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'popularity';
export const SORT_OPTIONS: SortOption[] = ['featured', 'newest', 'popularity', 'price_asc', 'price_desc', 'name_asc', 'name_desc'];
const SORT_LABEL_KEYS: Record<SortOption, string> = {
  featured: 'sortFeatured',
  newest: 'sortNewest',
  name_asc: 'sortAlphaAsc',
  name_desc: 'sortAlphaDesc',
  price_asc: 'sortPriceAsc',
  price_desc: 'sortPriceDesc',
  popularity: 'sortPopularity',
};
export type PriceFilter = 'all' | 'free' | 'paid';
export const PRICE_FILTERS: PriceFilter[] = ['all', 'free', 'paid'];

export interface CategoryChip {
  value: string;
  label: string;
  emoji: string;
  count: number;
}

interface StoreToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  chips: CategoryChip[];
  activeCategory: string | null;
  onCategory: (value: string | null) => void;
  sortBy: SortOption;
  onSort: (value: SortOption) => void;
  priceFilter: PriceFilter;
  onPriceFilter: (value: PriceFilter) => void;
  minPrice: string;
  maxPrice: string;
  onMinPrice: (value: string) => void;
  onMaxPrice: (value: string) => void;
  hasActiveFilters: boolean;
  onReset: () => void;
}

const chipClass = (active: boolean) =>
  `shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full border transition-colors cursor-pointer ${
    active
      ? 'bg-slate-900 dark:bg-cyan-600 text-white border-transparent'
      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-cyan-500'
  }`;
const fieldClass =
  'rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500';

export default function StoreToolbar(p: StoreToolbarProps) {
  const { t } = useTranslation('marketplace');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sortSelect = (extra: string) => (
    <div className={`relative ${extra}`}>
      <select value={p.sortBy} onChange={(e) => p.onSort(e.target.value as SortOption)} aria-label={t('sortLabel')} className={`${fieldClass} w-full appearance-none pl-4 pr-9 py-2.5 font-semibold cursor-pointer`}>
        {SORT_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {t(SORT_LABEL_KEYS[opt])}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
    </div>
  );

  const priceControls = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">{t('priceRangeLabel')}:</span>
      {/* Free / Paid toggle (click again to clear) — no second "All" chip next to the category "All". */}
      {PRICE_FILTERS.filter((pf) => pf !== 'all').map((pf) => (
        <button key={pf} type="button" aria-pressed={p.priceFilter === pf} onClick={() => p.onPriceFilter(p.priceFilter === pf ? 'all' : pf)} className={chipClass(p.priceFilter === pf)}>
          {t(pf)}
        </button>
      ))}
      <input type="number" min={0} inputMode="decimal" value={p.minPrice} onChange={(e) => p.onMinPrice(e.target.value)} placeholder={t('minPricePlaceholder')} className={`${fieldClass} w-24 px-3 py-1.5 text-xs`} />
      <span className="text-xs text-slate-400">–</span>
      <input type="number" min={0} inputMode="decimal" value={p.maxPrice} onChange={(e) => p.onMaxPrice(e.target.value)} placeholder={t('maxPricePlaceholder')} className={`${fieldClass} w-24 px-3 py-1.5 text-xs`} />
    </div>
  );

  return (
    <div className="mb-10 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 p-4 md:p-5">
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
            placeholder={t('storeSearchPlaceholder')}
            aria-label={t('storeSearchPlaceholder')}
            className={`${fieldClass} w-full pl-10 pr-4 py-2.5`}
          />
        </div>
        {sortSelect('hidden md:block shrink-0 w-56')}
        <button type="button" onClick={() => setDrawerOpen(true)} className="md:hidden shrink-0 inline-flex items-center gap-2 text-sm font-bold px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="sr-only sm:not-sr-only">{t('filtersButton')}</span>
          {p.hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />}
        </button>
      </div>

      {/* Category chips: one row, scrolls sideways on phones instead of wrapping into a wall of buttons. */}
      <div className="mt-4 -mx-1 px-1 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible" role="group" aria-label={t('filtersButton')}>
        <button type="button" onClick={() => p.onCategory(null)} className={chipClass(p.activeCategory === null)}>
          {t('all')}
        </button>
        {p.chips.map((chip) => (
          <button key={chip.value} type="button" onClick={() => p.onCategory(chip.value)} className={chipClass(p.activeCategory === chip.value)} aria-pressed={p.activeCategory === chip.value}>
            <span aria-hidden>{chip.emoji}</span>
            {chip.label}
            <span className="opacity-60">{chip.count}</span>
          </button>
        ))}
      </div>

      <div className="hidden md:flex items-center gap-3 mt-3">
        {priceControls}
        {p.hasActiveFilters && (
          <button type="button" onClick={p.onReset} className="ml-auto text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline bg-transparent border-none cursor-pointer">
            {t('resetFilters')}
          </button>
        )}
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-[100] flex items-end md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-full max-h-[85vh] rounded-t-2xl bg-white dark:bg-[#0e1422] shadow-2xl overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0e1422]/95">
              <h2 className="text-sm font-black">{t('filtersButton')}</h2>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label={t('modalClose')} className="p-1.5 rounded-lg border-none bg-transparent cursor-pointer text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t('sortLabel')}</label>
                {sortSelect('w-full')}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t('priceRangeLabel')}</label>
                {priceControls}
              </div>
              <div className="flex gap-3 pt-2">
                {p.hasActiveFilters && (
                  <button type="button" onClick={p.onReset} className="flex-1 text-sm font-bold px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent cursor-pointer">
                    {t('resetFilters')}
                  </button>
                )}
                <button type="button" onClick={() => setDrawerOpen(false)} className="flex-1 text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-cyan-600 px-4 py-2.5 rounded-lg border-none cursor-pointer">
                  {t('applyFilters')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
