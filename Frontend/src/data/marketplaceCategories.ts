// Curated marketplace category taxonomy — shared between the header nav's
// "კატეგორიები" dropdown and the /marketplace listing page's filter chips.
// The `value` is what actually gets passed as the ?category= query param
// (and therefore must match DigitalProduct.category exactly for a product
// to show up under it — category is free text set by whoever creates the
// product, not a DB enum, so this taxonomy is a UI-level convention rather
// than a schema constraint).
export interface MarketplaceCategory {
  value: { ka: string; en: string };
  labelEn: string;
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  { value: { ka: 'ბიზნეს ინსტრუმენტები', en: 'Business Tools' }, labelEn: 'B2B Tools & AI Automation' },
  { value: { ka: 'ელექტრონული წიგნები', en: 'E-books' }, labelEn: 'E-books' },
  { value: { ka: 'ბანერები და საბეჭდი მასალები', en: 'Banners & Print Assets' }, labelEn: 'Banners & Print Assets' },
];
