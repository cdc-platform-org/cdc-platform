// Dropdowns for the admin Digital Store page (pages/admin/products.tsx):
// the fixed product category list and the store "highlight" flag
// (Bestseller / Popular / Recommended / New), both from
// src/data/productCategories.ts. Labels follow the admin panel language.
import { PRODUCT_CATEGORIES, PRODUCT_HIGHLIGHTS, HIGHLIGHT_LABELS } from '../../data/productCategories';
import { at, useAdminLangValue } from '../../i18n/admin';

const selectClass = 'rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white';

export function ProductCategorySelect({ value, onChange, required, className = '' }: { value: string; onChange: (v: string) => void; required?: boolean; className?: string }) {
  const lang = useAdminLangValue();
  return (
    <select required={required} value={value} onChange={(e) => onChange(e.target.value)} className={`${selectClass} ${className}`}>
      <option value="" disabled>
        {at("Choose a category…")}
      </option>
      {PRODUCT_CATEGORIES.map((c) => (
        <option key={c.key} value={c.key}>
          {c.emoji} {lang === 'ka' ? c.labelKa : c.labelEn}
        </option>
      ))}
    </select>
  );
}

export function ProductHighlightSelect({ value, onChange, className = '' }: { value: string; onChange: (v: string) => void; className?: string }) {
  const lang = useAdminLangValue();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${selectClass} ${className}`} title={at("Flagged products are shown first in the store")}>
      <option value="">{at("No store flag")}</option>
      {PRODUCT_HIGHLIGHTS.map((h) => (
        <option key={h} value={h}>
          {HIGHLIGHT_LABELS[h].emoji} {lang === 'ka' ? HIGHLIGHT_LABELS[h].ka : HIGHLIGHT_LABELS[h].en}
        </option>
      ))}
    </select>
  );
}
