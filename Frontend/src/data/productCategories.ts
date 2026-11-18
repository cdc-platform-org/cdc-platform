// The Digital Store's one fixed category list, its labels, and the admin
// "highlight" flags. Used by the store page (/marketplace), the admin product
// dropdowns (pages/admin/products.tsx), the seller submission form
// (dashboard ProductsTab) and anywhere a product's category is shown.
//
// Keys and mapping rules mirror Backend/src/services/marketplace/
// productCategories.ts. The API already returns normalized keys; the same
// normalize function runs here too so an older cached response or a legacy
// ?category= link still lands in the right group.

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

export interface ProductCategoryDefinition {
  key: ProductCategoryKey;
  emoji: string;
  labelKa: string;
  labelEn: string;
}

export const PRODUCT_CATEGORIES: ProductCategoryDefinition[] = [
  { key: 'coloring', emoji: '🖍️', labelKa: 'გასაფერადებლები და საბავშვო აქტივობები', labelEn: 'Coloring pages & kids activities' },
  { key: 'wall-art', emoji: '🖼️', labelKa: 'კედლის პრინტები და ნახატები', labelEn: 'Wall art & prints' },
  { key: 'planners', emoji: '🗓️', labelKa: 'პლანერები და კალენდრები', labelEn: 'Planners & calendars' },
  { key: 'cv-career', emoji: '📄', labelKa: 'CV და კარიერა', labelEn: 'CV & career' },
  { key: 'design-business', emoji: '💼', labelKa: 'ბიზნესის და დიზაინის შაბლონები', labelEn: 'Business & design templates' },
  { key: 'invitations', emoji: '💌', labelKa: 'მოსაწვევები და ბარათები', labelEn: 'Invitations & cards' },
  { key: 'education', emoji: '📘', labelKa: 'სასწავლო მასალა და ელ-წიგნები', labelEn: 'Learning materials & e-books' },
  { key: 'ai-prompts', emoji: '🤖', labelKa: 'AI პრომპტები', labelEn: 'AI prompts' },
  { key: 'other', emoji: '📦', labelKa: 'სხვა ციფრული პროდუქტები', labelEn: 'Other digital products' },
];

// Not a DigitalProduct category: the store's "AI tools" filter chip, which
// shows the CDC-built tools (SAAS_TOOLS in pages/marketplace) instead of
// products. Links elsewhere on the site point at ?category=ai-tools.
export const AI_TOOLS_FILTER = 'ai-tools';
// ?category= values used before 2026-11-18 for the same filter.
const LEGACY_AI_TOOLS_FILTERS = ['ციფრული AI ხელსაწყოები', 'Digital AI Tools'];

export function isAiToolsFilter(value: string | null | undefined): boolean {
  return !!value && (value === AI_TOOLS_FILTER || LEGACY_AI_TOOLS_FILTERS.includes(value));
}

export function isProductCategoryKey(value: unknown): value is ProductCategoryKey {
  return typeof value === 'string' && (PRODUCT_CATEGORY_KEYS as readonly string[]).includes(value);
}

// Same ordered rules as the Backend copy: first match wins; coloring is also
// matched on the title because some coloring books were filed as "E-Books".
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

export function normalizeProductCategory(category: string | null | undefined, title?: string | null): ProductCategoryKey {
  const raw = (category ?? '').trim();
  if (isProductCategoryKey(raw)) return raw;
  for (const rule of LEGACY_RULES) {
    if (rule.pattern.test(raw)) return rule.key;
    if (rule.useTitle && title && rule.pattern.test(title)) return rule.key;
  }
  return 'other';
}

export function productCategoryLabel(category: string | null | undefined, lang: string, title?: string | null): string {
  const key = normalizeProductCategory(category, title);
  const def = PRODUCT_CATEGORIES.find((c) => c.key === key)!;
  return lang === 'ka' ? def.labelKa : def.labelEn;
}

// ---- Highlight flags (DigitalProduct.highlight, set in the admin) ----
export const PRODUCT_HIGHLIGHTS = ['BESTSELLER', 'POPULAR', 'RECOMMENDED', 'NEW'] as const;
export type ProductHighlight = (typeof PRODUCT_HIGHLIGHTS)[number];

export const HIGHLIGHT_LABELS: Record<ProductHighlight, { ka: string; en: string; emoji: string; className: string }> = {
  BESTSELLER: { ka: 'ბესტსელერი', en: 'Bestseller', emoji: '🏆', className: 'from-amber-500 to-orange-500' },
  POPULAR: { ka: 'პოპულარული', en: 'Popular', emoji: '🔥', className: 'from-rose-500 to-pink-500' },
  RECOMMENDED: { ka: 'გირჩევთ', en: 'Recommended', emoji: '⭐', className: 'from-violet-500 to-purple-600' },
  NEW: { ka: 'ახალი', en: 'New', emoji: '✨', className: 'from-cyan-500 to-sky-600' },
};

export function isProductHighlight(value: unknown): value is ProductHighlight {
  return typeof value === 'string' && (PRODUCT_HIGHLIGHTS as readonly string[]).includes(value);
}

/** Flagged first (in PRODUCT_HIGHLIGHTS order), unflagged last. */
export function highlightRank(value: string | null | undefined): number {
  const index = (PRODUCT_HIGHLIGHTS as readonly string[]).indexOf(value ?? '');
  return index === -1 ? PRODUCT_HIGHLIGHTS.length : index;
}

export function highlightLabel(value: string | null | undefined, lang: string): string | null {
  if (!isProductHighlight(value)) return null;
  const h = HIGHLIGHT_LABELS[value];
  return `${h.emoji} ${lang === 'ka' ? h.ka : h.en}`;
}
