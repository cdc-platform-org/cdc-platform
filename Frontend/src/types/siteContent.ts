export interface HomepageStat {
  valueKa: string;
  labelKa: string;
  valueEn: string;
  labelEn: string;
}

export interface HomepageFaqItem {
  questionKa: string;
  answerKa: string;
  questionEn: string;
  answerEn: string;
}

// --- Photo Gallery (page: "gallery") ---

export interface GalleryImage {
  url: string; // absolute URL or a server-relative /uploads/... path
  captionKa?: string;
  captionEn?: string;
}

export interface GalleryContent {
  images?: GalleryImage[];
}

export interface HeksCardConfig {
  // Absolute URL or a server-relative /uploads/... path (see uploadCmsImage).
  // Falls back to the bundled /images/heks-eper.jpg when unset.
  imageUrl?: string;
  objectPosition?: 'top' | 'center' | 'bottom';
  heightPreset?: 'normal' | 'tall';
}

export interface HomepageContent {
  heroTitleKa?: string;
  heroTitleEn?: string;
  heroSubtitleKa?: string;
  heroSubtitleEn?: string;
  stats?: HomepageStat[];
  faq?: HomepageFaqItem[];
  heksCard?: HeksCardConfig;
}

// --- CDC Studio Portfolio (page: "agency") ---

export interface AgencyPortfolioItem {
  badgeKa: string;
  badgeEn: string;
  titleKa: string;
  titleEn: string;
  subtitleKa: string;
  subtitleEn: string;
  descKa: string;
  descEn: string;
  statusKa: string;
  statusEn: string;
  // Optional card cover image — CSS object-fit: cover, object-position
  // keyword, and a 100-200% zoom applied via transform: scale(). Cards
  // without an imageUrl render exactly as before (text-only).
  imageUrl?: string;
  imagePosition?: 'top' | 'center' | 'bottom' | 'left' | 'right';
  imageZoom?: number;
  // Optional outbound link to the live project/client site. When set, the
  // whole card becomes a clickable link (target="_blank") with an
  // ExternalLink affordance; cards without one stay non-interactive.
  externalLink?: string;
}

export interface AgencyContent {
  portfolio?: AgencyPortfolioItem[];
}

// --- Tool Catalog CMS (page: "tool-catalog") ---
// Admin-editable overrides for the SaaS tool cards on /tools and
// /marketplace (pages/admin/tools.tsx). `slug` matches each tool's own
// stable id (see marketplace/index.tsx's SAAS_TOOLS and tools.tsx's own
// card keys) — the public pages look up by slug and only override a field
// when its value here is a non-empty string, otherwise falling back to
// that page's existing static/i18n copy. Same ka/en-pair convention as
// AgencyPortfolioItem above; features are longer so they're an array
// rather than one field.
export type ToolCatalogStatus = 'ACTIVE' | 'COMING_SOON' | 'DISABLED';

export interface ToolCatalogEntry {
  slug: string;
  status: ToolCatalogStatus;
  titleKa?: string;
  titleEn?: string;
  subtitleKa?: string;
  subtitleEn?: string;
  badgeKa?: string;
  badgeEn?: string;
  pricingLabelKa?: string;
  pricingLabelEn?: string;
  descriptionKa?: string;
  descriptionEn?: string;
  featuresKa?: string[];
  featuresEn?: string[];
}

export interface ToolCatalogContent {
  tools?: ToolCatalogEntry[];
}
