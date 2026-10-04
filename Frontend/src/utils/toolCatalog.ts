import { ToolCatalogEntry, ToolCatalogCategory, ToolCatalogLocalizedText } from '../types/siteContent';
import { SiteLocale } from './seo';

// Shared by /tools, /marketplace, courses' AI Teachers tab, product detail
// headers, and any future page that renders one of the admin-editable
// catalog cards (see pages/admin/tools.tsx) — a field only overrides the
// page's own static/i18n default when it's actually been set to a
// non-empty value, so an admin can edit just e.g. the badge without having
// to also fill in every other field.
export function findToolEntry(tools: ToolCatalogEntry[] | undefined, slug: string): ToolCatalogEntry | undefined {
  return tools?.find((t) => t.slug === slug);
}

export function overrideText(fallback: string, override?: string): string {
  return override && override.trim() ? override : fallback;
}

export function overrideList(fallback: string[], override?: string[]): string[] {
  return override && override.length > 0 ? override : fallback;
}

// Entries saved before `category` existed (every entry prior to 2026-10)
// have no value for it — this is the one place that gap is bridged, by the
// slug's own known identity, so every call site doesn't have to repeat the
// same two special cases. A genuinely new entry an admin creates always
// gets an explicit category from the editor, so this fallback chain only
// ever matters for the pre-existing rows.
export function resolveToolCategory(entry: ToolCatalogEntry): ToolCatalogCategory {
  if (entry.category) return entry.category;
  if (entry.slug === 'english-tutor') return 'AI_TEACHER';
  if (entry.slug === 'childrens-book') return 'DIGITAL_PRODUCT_LINK';
  return 'AI_TOOL';
}

// Resolves a catalog entry's localized text for the CURRENT real site
// locale: an explicit per-locale override first, else that exact locale's
// own ka/en-pair default (ka only for the ka locale, the En field for every
// other real locale — same contentLocale() rule as the rest of this
// codebase's DB/CMS content), never a different locale's override and
// never fabricated. `fallback` is the page's own existing static/i18n copy
// for this exact locale (already correctly localized via next-i18next),
// used only when NEITHER the per-locale override NOR the ka/en pair has
// anything for this field.
export function resolveLocalizedField(
  locale: SiteLocale,
  fallback: string,
  localized: ToolCatalogLocalizedText | undefined,
  kaDefault?: string,
  enDefault?: string
): string {
  const override = localized?.[locale];
  if (override && override.trim()) return override;
  const pairDefault = locale === 'ka' ? kaDefault : enDefault;
  if (pairDefault && pairDefault.trim()) return pairDefault;
  return fallback;
}
