/**
 * Filter panel for the /courses catalog: category, language, price,
 * discounted-only and sort. An in-flow sticky card on desktop, a slide-over
 * drawer with backdrop on mobile (opened from the filter button next to the
 * search bar). 2026-11 redesign: EDUPRO-style grouped options on cdc-*
 * tokens. State lives in pages/courses/index.tsx; search is in the page's
 * top search bar, not here.
 */
import { X } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { CourseLanguage } from '../../../types/lms';
import { courseLanguageBadge } from '../../../utils/courseLanguage';

export type SortMode = 'recommended' | 'price_asc' | 'price_desc';
export type PriceFilter = 'all' | 'free' | 'paid';

interface CatalogFiltersProps {
  t: TFunction<'courses', undefined>;
  lang: 'ka' | 'en';
  open: boolean;
  onClose: () => void;
  categories: string[];
  category: string | null;
  setCategory: (v: string | null) => void;
  languagesPresent: CourseLanguage[];
  language: CourseLanguage | null;
  setLanguage: (v: CourseLanguage | null) => void;
  priceFilter: PriceFilter;
  setPriceFilter: (v: PriceFilter) => void;
  discountedOnly: boolean;
  setDiscountedOnly: (v: boolean) => void;
  sort: SortMode;
  setSort: (v: SortMode) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  showResultsLabel: string;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-bold text-cdc-ink mb-3">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Option({ checked, onChange, children, type = 'radio' }: { checked: boolean; onChange: () => void; children: ReactNode; type?: 'radio' | 'checkbox' }) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-cdc-muted hover:text-cdc-ink cursor-pointer">
      <input type={type} checked={checked} onChange={onChange} className="w-4 h-4 rounded accent-[rgb(var(--cdc-primary))]" />
      <span className={checked ? 'text-cdc-ink font-semibold' : ''}>{children}</span>
    </label>
  );
}

export default function CatalogFilters(p: CatalogFiltersProps) {
  const { t } = p;
  return (
    <aside>
      {p.open && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={p.onClose} />}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-50 lg:z-auto w-80 max-w-[85vw] lg:w-64 shrink-0 flex flex-col lg:block bg-cdc-surface lg:bg-transparent transition-transform duration-300 ease-in-out lg:transition-none ${
          p.open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="lg:hidden flex items-center justify-between px-5 py-4 border-b border-cdc-border shrink-0">
          <span className="text-base font-bold text-cdc-ink">{t('filtersDrawerTitle')}</span>
          <button type="button" onClick={p.onClose} aria-label="Close" className="p-1.5 rounded-lg text-cdc-muted hover:bg-cdc-bg border-none bg-transparent cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto lg:overflow-visible p-5 space-y-6 lg:sticky lg:top-24 lg:rounded-card lg:border lg:border-cdc-border lg:bg-cdc-surface">
          <Group title={t('categoryLabel')}>
            <Option checked={p.category === null} onChange={() => p.setCategory(null)}>{t('allCategories')}</Option>
            {p.categories.map((cat) => (
              <Option key={cat} checked={p.category === cat} onChange={() => p.setCategory(cat)}>{cat}</Option>
            ))}
          </Group>

          {p.languagesPresent.length > 1 && (
            <Group title={t('languageLabel')}>
              <Option checked={p.language === null} onChange={() => p.setLanguage(null)}>{t('allLanguages')}</Option>
              {p.languagesPresent.map((l) => (
                <Option key={l} checked={p.language === l} onChange={() => p.setLanguage(l)}>{courseLanguageBadge(l, p.lang)}</Option>
              ))}
            </Group>
          )}

          <Group title={t('priceLabel')}>
            <Option checked={p.priceFilter === 'all'} onChange={() => p.setPriceFilter('all')}>{t('priceAll')}</Option>
            <Option checked={p.priceFilter === 'free'} onChange={() => p.setPriceFilter('free')}>{t('priceFree')}</Option>
            <Option checked={p.priceFilter === 'paid'} onChange={() => p.setPriceFilter('paid')}>{t('pricePaid')}</Option>
          </Group>

          <Option type="checkbox" checked={p.discountedOnly} onChange={() => p.setDiscountedOnly(!p.discountedOnly)}>{t('discountedOnly')}</Option>

          <div>
            <label className="block text-sm font-bold text-cdc-ink mb-3">{t('sortLabel')}</label>
            <select
              value={p.sort}
              onChange={(e) => p.setSort(e.target.value as SortMode)}
              className="w-full rounded-xl border border-cdc-border bg-cdc-surface px-3 py-2.5 text-sm text-cdc-ink focus:outline-none focus:ring-2 focus:ring-cdc-primary/40"
            >
              <option value="recommended">{t('sortRecommended')}</option>
              <option value="price_asc">{t('sortPriceAsc')}</option>
              <option value="price_desc">{t('sortPriceDesc')}</option>
            </select>
          </div>

          {p.hasActiveFilters && (
            <button type="button" onClick={p.clearFilters} className="inline-flex items-center gap-1.5 text-sm font-bold text-cdc-primary-ink hover:underline bg-transparent border-none cursor-pointer p-0">
              <X className="w-3.5 h-3.5" />
              {t('clearFilters')}
            </button>
          )}
        </div>

        <div className="lg:hidden shrink-0 p-4 border-t border-cdc-border">
          <button type="button" onClick={p.onClose} className="vip-btn-primary w-full py-3 cursor-pointer">
            {p.showResultsLabel}
          </button>
        </div>
      </div>
    </aside>
  );
}
