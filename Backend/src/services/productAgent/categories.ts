/**
 * Product agent — the product categories the agent can create.
 * Exports: AGENT_CATEGORIES, AgentCategoryKey, AGENT_CATEGORY_KEYS, isAgentCategoryKey.
 *
 * One entry per category: the store category string the listing is filed
 * under, the default price, and the rough cost per product shown to the
 * admin before they raise a daily count. The generator for each category
 * lives in ./generators/<file>.ts and is wired up in ./generators/index.ts.
 */
import type { ProductCategoryKey } from '../marketplace/productCategories';

export interface AgentCategoryDefinition {
  labelKa: string;
  labelEn: string;
  // DigitalProduct.category value: one of the fixed store keys
  // (services/marketplace/productCategories.ts).
  storeCategory: ProductCategoryKey;
  // The free-text value this category was filed under before the
  // 2026-11-18 clean-up. Sales/history queries match both until every old
  // row has been rewritten to the key.
  legacyStoreCategory: string;
  // GEL, major units.
  defaultPriceGel: number;
  // USD per product at "high" image quality as measured in the 2026-11-14
  // pilot run, for the admin page's
  // daily/monthly estimate only. The real cost of every run is measured
  // from Azure's token usage and stored on ProductAgentRun.
  estimatedCostUsd: number;
  // Exam material can carry factual mistakes; the admin page says so and
  // these always stay PENDING for a human check.
  needsFactCheck: boolean;
}

export const AGENT_CATEGORIES = {
  PRINTS: {
    labelKa: 'კედლის პრინტები',
    labelEn: 'Wall art prints',
    storeCategory: 'wall-art',
    legacyStoreCategory: 'Digital Art / Prints & Illustrations',
    defaultPriceGel: 15,
    estimatedCostUsd: 1.2,
    needsFactCheck: false,
  },
  KIDS_WORKSHEETS: {
    labelKa: 'საბავშვო სამუშაო ფურცლები და გასაფერადებლები',
    labelEn: 'Kids worksheets & coloring pages',
    storeCategory: 'coloring',
    legacyStoreCategory: 'Kids & Education / Worksheets & Coloring',
    defaultPriceGel: 9,
    estimatedCostUsd: 0.3,
    needsFactCheck: false,
  },
  PLANNERS: {
    labelKa: 'პლანერები და ტრეკერები',
    labelEn: 'Planners & trackers',
    storeCategory: 'planners',
    legacyStoreCategory: 'Planners & Organizers / Printable Planners',
    defaultPriceGel: 9,
    estimatedCostUsd: 0.05,
    needsFactCheck: false,
  },
  CV_TEMPLATES: {
    labelKa: 'CV და სამოტივაციო წერილის შაბლონები',
    labelEn: 'CV & cover letter templates',
    storeCategory: 'cv-career',
    legacyStoreCategory: 'Career / CV & Cover Letter Templates',
    defaultPriceGel: 12,
    estimatedCostUsd: 0.05,
    needsFactCheck: false,
  },
  BUSINESS_TEMPLATES: {
    labelKa: 'მცირე ბიზნესის შაბლონები',
    labelEn: 'Small business templates',
    storeCategory: 'design-business',
    legacyStoreCategory: 'Small Business / Templates',
    defaultPriceGel: 15,
    estimatedCostUsd: 0.12,
    needsFactCheck: false,
  },
  VECTOR_LOGOS: {
    labelKa: 'ვექტორული ლოგოების შაბლონები',
    labelEn: 'Editable vector logo templates',
    storeCategory: 'design-business',
    legacyStoreCategory: 'Design & Graphics / Vector Logos',
    defaultPriceGel: 15,
    // Text-model brief only; previews are rendered locally, not generated images.
    estimatedCostUsd: 0.05,
    needsFactCheck: false,
  },
  INVITATIONS: {
    labelKa: 'მოსაწვევები და ბარათები',
    labelEn: 'Invitations & cards',
    storeCategory: 'invitations',
    legacyStoreCategory: 'Events / Invitations & Cards',
    defaultPriceGel: 8,
    estimatedCostUsd: 0.25,
    needsFactCheck: false,
  },
  EXAM_PREP: {
    labelKa: 'გამოცდისთვის მოსამზადებელი მასალა',
    labelEn: 'Exam prep materials',
    storeCategory: 'education',
    legacyStoreCategory: 'Education / Exam Prep',
    defaultPriceGel: 10,
    estimatedCostUsd: 0.06,
    needsFactCheck: true,
  },
} as const satisfies Record<string, AgentCategoryDefinition>;

export type AgentCategoryKey = keyof typeof AGENT_CATEGORIES;
export const AGENT_CATEGORY_KEYS = Object.keys(AGENT_CATEGORIES) as AgentCategoryKey[];

export function isAgentCategoryKey(value: unknown): value is AgentCategoryKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(AGENT_CATEGORIES, value);
}

/** Every DigitalProduct.category value that belongs to this agent category (new key + pre-clean-up value). */
export function storeCategoryValues(key: AgentCategoryKey): string[] {
  const def: AgentCategoryDefinition = AGENT_CATEGORIES[key];
  return [def.storeCategory, def.legacyStoreCategory];
}
