// Curated marketplace category taxonomy — shared between the header nav's
// "კატეგორიები" dropdown and the /marketplace listing page's filter chips.
// Categories are customer-facing filters, not a database enum. Digital AI
// Tools also groups real AI utilities stored under older seller categories;
// genuine non-AI product categories remain discoverable from the catalog.
export interface MarketplaceCategory {
  value: { ka: string; en: string };
  labelEn: string;
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  { value: { ka: 'ციფრული AI ხელსაწყოები', en: 'Digital AI Tools' }, labelEn: 'Digital AI Tools' },
  { value: { ka: 'ელექტრონული წიგნები', en: 'E-books' }, labelEn: 'E-books' },
  { value: { ka: 'ლოგოები, ბანერები და საბეჭდი მასალები', en: 'Logos, Banners & Print Assets' }, labelEn: 'Logos, Banners & Print Assets' },
];
