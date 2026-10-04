import { Crown, Mic, BookOpen, ShieldCheck, GraduationCap, LucideIcon } from 'lucide-react';
import { ToolCatalogCategory } from '../types/siteContent';

// Single canonical registry of every real AI Tool / AI Teacher / Children's
// Book — previously duplicated (and already drifted) across three places:
// marketplace/index.tsx's SAAS_TOOLS (6 entries), courses/index.tsx's
// AI_TEACHERS (1 entry), and admin/tools.tsx's KNOWN_TOOLS (4 entries, a
// stale subset of SAAS_TOOLS missing smart-reader and childrens-book).
// Every one of those three now imports from here instead of keeping its
// own copy — a future AI Tool/Teacher needs exactly one new entry, in
// exactly one place, to show up everywhere (admin CMS, marketplace card,
// courses card, and the new public /products/[slug] detail page).
//
// `route` is where an AUTHENTICATED user actually lands (the real
// dashboard tool) — unauthenticated visitors hit the auth modal first (see
// each page's own goToAiTeacher/goToSaasTool-style handler), same
// pre-existing behavior this registry doesn't change. smart-reader has no
// standalone page of its own (it's a homepage-embedded feature), so its
// route is the homepage anchor it already used.
export interface ProductCatalogRegistryEntry {
  slug: string;
  route: string;
  category: ToolCatalogCategory;
  icon: LucideIcon;
  accent: string; // Tailwind gradient classes, e.g. "from-purple-500 to-cyan-600"
}

export const PRODUCT_CATALOG_REGISTRY: ProductCatalogRegistryEntry[] = [
  { slug: 'educator-hub', route: '/dashboard/tools/educator-hub', category: 'AI_TOOL', icon: Crown, accent: 'from-amber-500 to-purple-600' },
  { slug: 'media-studio', route: '/dashboard/tools/media-studio', category: 'AI_TOOL', icon: Mic, accent: 'from-cyan-500 to-purple-600' },
  { slug: 'smart-reader', route: '/#ai-tools', category: 'AI_TOOL', icon: BookOpen, accent: 'from-cyan-500 to-emerald-600' },
  { slug: 'proctoring', route: '/dashboard/tools/proctored-exam', category: 'AI_TOOL', icon: ShieldCheck, accent: 'from-cyan-500 to-purple-600' },
  { slug: 'english-tutor', route: '/dashboard/english-tutor', category: 'AI_TEACHER', icon: GraduationCap, accent: 'from-purple-500 to-cyan-600' },
  { slug: 'childrens-book', route: '/dashboard/tools/childrens-book', category: 'DIGITAL_PRODUCT_LINK', icon: BookOpen, accent: 'from-pink-500 to-purple-600' },
];

export function findRegistryEntry(slug: string): ProductCatalogRegistryEntry | undefined {
  return PRODUCT_CATALOG_REGISTRY.find((e) => e.slug === slug);
}
