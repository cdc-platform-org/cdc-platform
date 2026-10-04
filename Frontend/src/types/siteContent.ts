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
// Admin-editable presentation metadata for every CDC product that ISN'T a
// purchasable DigitalProduct row — AI Tools (educator-hub, media-studio,
// smart-reader, proctoring), AI Teachers (english-tutor/IMIAKO), and the
// Personalized Children's Book (a server-priced generative product with its
// own purchase/entitlement engine, never a DigitalProduct row — see
// marketplace/index.tsx's SAAS_TOOLS comment). This is the single unified
// catalog for all three (pages/admin/tools.tsx, soon renamed in spirit to
// "AI Ecosystem CMS" but keeping its existing route/page key so nothing
// that already links or reads from it breaks) — `category` below is what a
// listing page filters by; Digital Store's real purchasable products stay
// on DigitalProduct/adminProducts.ts entirely, which already has its own
// mature cover/gallery/video/localization support and is deliberately NOT
// folded into this JSON-blob catalog (a purchase/entitlement-bearing row
// needs real relational integrity, not a CMS text field).
//
// `slug` matches each entry's own stable id (see marketplace/index.tsx's
// SAAS_TOOLS and courses/index.tsx's AI_TEACHERS) — the public pages look
// up by slug and only override a field when its value here is non-empty,
// otherwise falling back to that page's existing static/i18n copy.
export type ToolCatalogStatus = 'ACTIVE' | 'COMING_SOON' | 'DISABLED';
// What a unified admin product listing filters by — DIGITAL_PRODUCT_LINK
// marks an entry (currently just the Children's Book) that is presentation
// metadata for a product whose actual purchase/generation lives elsewhere
// (BookProject + bookStateService), grouped under "Digital Store" in the
// admin UI even though its CMS row lives here, not in DigitalProduct.
export type ToolCatalogCategory = 'AI_TOOL' | 'AI_TEACHER' | 'DIGITAL_PRODUCT_LINK';

// Every real CDC site locale (SITE_LOCALES in utils/locale.ts) — Russian is
// never a key, platform-wide policy. A locale left unset here falls back to
// that EXACT locale's existing titleKa/titleEn-equivalent default (ka using
// titleKa, every other real locale using titleEn — see utils/locale.ts's
// contentLocale), never to a different locale's override.
export interface ToolCatalogLocalizedText {
  ka?: string;
  en?: string;
  de?: string;
  es?: string;
  fr?: string;
  uk?: string;
  tr?: string;
  hy?: string;
  az?: string;
}

export interface ToolCatalogEntry {
  slug: string;
  status: ToolCatalogStatus;
  // Optional — entries written before this field existed (every entry as of
  // this comment) have no category yet; readers treat a missing category as
  // 'AI_TOOL' unless the slug is independently known to be an AI Teacher or
  // the Children's Book (see aiTeacherCatalog.ts's categoryForSlug).
  category?: ToolCatalogCategory;
  titleKa?: string;
  titleEn?: string;
  subtitleKa?: string;
  subtitleEn?: string;
  badgeKa?: string;
  badgeEn?: string;
  pricingLabelKa?: string;
  pricingLabelEn?: string;
  // Short description — shown on the card. Same ka/en-pair convention as
  // the rest of this entry (see utils/locale.ts's own comment on why ka/en
  // is this codebase's DB/CMS content default).
  descriptionKa?: string;
  descriptionEn?: string;
  // Full description — shown on the product's detail page only, below the
  // short one. Product requirement (2026-10): admin-editable in all 9 real
  // CDC site locales, not collapsed to ka/en — see fullDescriptionLocales.
  featuresKa?: string[];
  featuresEn?: string[];
  // Cover/banner image for this entry's card AND detail-page hero —
  // absolute URL or a path relative to the API origin (see
  // blogService.ts's resolveBlogImageUrl). Empty/undefined means the
  // reading page falls back to its own default gradient/icon header.
  imageUrl?: string;
  // Instruction/demo video — a pasted link (YouTube, Vimeo, or a direct
  // hosted file URL), same convention and the same VideoEmbed.tsx parser
  // DigitalProduct.previewVideoUrl already uses; never a broken/unsafe
  // embed (see VideoEmbed.tsx's own comment — an unparseable URL renders
  // nothing). No dedicated upload-to-storage route exists for this JSON
  // catalog (unlike DigitalProduct, which has a real row/id to attach an
  // uploaded file to) — an admin wanting a self-hosted video pastes the
  // direct URL of a file they've uploaded through an existing CMS image/
  // video uploader elsewhere, same as how a pasted YouTube/Vimeo link works.
  videoUrl?: string;
  // Full (detail-page) description and title/subtitle/short-description,
  // each independently overridable per real CDC site locale — additive
  // fields (every existing entry simply has none of these set yet, so
  // nothing already saved changes meaning). A locale with no override here
  // falls back to the ka/en pair above via utils/locale.ts's contentLocale
  // rule (ka only for the ka locale, titleEn/descriptionEn for every other
  // real locale) — never to Georgian for a non-ka locale, and never
  // fabricated for a locale nobody has written yet.
  titleLocales?: ToolCatalogLocalizedText;
  subtitleLocales?: ToolCatalogLocalizedText;
  descriptionLocales?: ToolCatalogLocalizedText;
  fullDescriptionLocales?: ToolCatalogLocalizedText;
}

export interface ToolCatalogContent {
  tools?: ToolCatalogEntry[];
}
