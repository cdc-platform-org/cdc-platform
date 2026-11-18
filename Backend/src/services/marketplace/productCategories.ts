/**
 * The Digital Store's one fixed category list + "highlight" flags.
 * Exports: PRODUCT_CATEGORY_KEYS, ProductCategoryKey, isProductCategoryKey,
 * normalizeProductCategory, PRODUCT_HIGHLIGHTS, ProductHighlight,
 * highlightRank.
 *
 * DigitalProduct.category is a plain String column. Before 2026-11-18 it held
 * whatever each form/agent wrote ("Digital Art / Prints & Illustrations",
 * "E-Books", "ebooks_guides", ...), so the store showed a long messy chip
 * list. Now every write stores one of the stable keys below, and every read
 * goes through normalizeProductCategory() so rows saved before the data
 * clean-up still land in the right group. The Frontend keeps the labels
 * (src/data/productCategories.ts, same keys + same mapping rules).
 */

export const PRODUCT_CATEGORY_KEYS = [
  'coloring',
  'wall-art',
  'planners',
  'cv-career',
  'design-business',
  'invitations',
  'education',
  'ai-prompts',
  'other',
] as const;

export type ProductCategoryKey = (typeof PRODUCT_CATEGORY_KEYS)[number];

export function isProductCategoryKey(value: unknown): value is ProductCategoryKey {
  return typeof value === 'string' && (PRODUCT_CATEGORY_KEYS as readonly string[]).includes(value);
}

// Ordered: the first rule that matches wins. Coloring is checked first and
// also against the title, because several coloring books were filed under
// "Education" / "E-Books".
const LEGACY_RULES: { key: ProductCategoryKey; pattern: RegExp; useTitle?: boolean }[] = [
  { key: 'coloring', pattern: /coloring|colouring|გასაფერადებ|worksheet/i, useTitle: true },
  { key: 'wall-art', pattern: /wall\s*art|print(s|able wall)|illustration|digital art|პრინტ|ნახატ/i },
  { key: 'planners', pattern: /planner|organi[sz]er|calendar|tracker|პლანერ|კალენდარ/i },
  { key: 'cv-career', pattern: /\bcv\b|resume|résumé|cover letter|career|რეზიუმე|კარიერ/i },
  { key: 'invitations', pattern: /invitation|greeting|cards?\b|events?\b|მოსაწვევ|ბარათ/i },
  { key: 'design-business', pattern: /business|logo|banner|design|graphic|ui\s*\/?\s*ux|uiux|template|ბიზნეს|ლოგო|დიზაინ|შაბლონ/i },
  { key: 'education', pattern: /education|exam|e-?books?|ebooks|guide|course|lesson|წიგნ|გამოცდ|სასწავლ/i },
  { key: 'ai-prompts', pattern: /\bai\b|prompt|artificial intelligence|ხელოვნური ინტელექტ/i },
];

/** Maps any stored/legacy category (plus the title, for coloring books) to one fixed key. */
export function normalizeProductCategory(category: string | null | undefined, title?: string | null): ProductCategoryKey {
  const raw = (category ?? '').trim();
  if (isProductCategoryKey(raw)) return raw;
  for (const rule of LEGACY_RULES) {
    if (rule.pattern.test(raw)) return rule.key;
    if (rule.useTitle && title && rule.pattern.test(title)) return rule.key;
  }
  return 'other';
}

// Admin-set flags (DigitalProduct.highlight). Any flagged product is listed
// before unflagged ones; this order decides between two flagged ones.
export const PRODUCT_HIGHLIGHTS = ['BESTSELLER', 'POPULAR', 'RECOMMENDED', 'NEW'] as const;
export type ProductHighlight = (typeof PRODUCT_HIGHLIGHTS)[number];

export function highlightRank(value: string | null | undefined): number {
  const index = (PRODUCT_HIGHLIGHTS as readonly string[]).indexOf(value ?? '');
  return index === -1 ? PRODUCT_HIGHLIGHTS.length : index;
}
