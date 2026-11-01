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

// Slugs that already have their own hand-built card on /tools or
// /marketplace. Any other ACTIVE / COMING_SOON entry an admin adds in
// pages/admin/tools.tsx is rendered by /tools as a generic CMS card.
export const BUILT_IN_TOOL_SLUGS = [
  'childrens-book',
  'media-studio',
  'educator-hub',
  'proctoring',
  'english-tutor',
  'smart-reader',
  'enterprise-ai',
  'exam-screening',
  'cyber-sentinel',
  'ag-saia',
];

export function customToolEntries(tools: ToolCatalogEntry[] | undefined): ToolCatalogEntry[] {
  return (tools ?? []).filter(
    (t) =>
      t.status !== 'DISABLED' &&
      !BUILT_IN_TOOL_SLUGS.includes(t.slug.trim()) &&
      Boolean((t.titleKa ?? '').trim() || (t.titleEn ?? '').trim()),
  );
}
