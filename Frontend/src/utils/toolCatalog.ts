import { ToolCatalogEntry } from '../types/siteContent';

// Shared by /tools, /marketplace, and any future page that renders one of
// the admin-editable SaaS tool cards (see pages/admin/tools.tsx) — a field
// only overrides the page's own static/i18n default when it's actually
// been set to a non-empty value, so an admin can edit just e.g. the badge
// without having to also fill in every other field.
export function findToolEntry(tools: ToolCatalogEntry[] | undefined, slug: string): ToolCatalogEntry | undefined {
  return tools?.find((t) => t.slug === slug);
}

export function overrideText(fallback: string, override?: string): string {
  return override && override.trim() ? override : fallback;
}

export function overrideList(fallback: string[], override?: string[]): string[] {
  return override && override.length > 0 ? override : fallback;
}
