/**
 * Coloring-page credit packs and limits (single source of truth for prices).
 * Exports: COLORING_PACKS, ColoringPack, findColoringPack, COLORING_LIMITS.
 *
 * Prices approved by the owner on 2026-11-14. Our Azure cost is about
 * $0.06–0.08 per page (gpt-image-2 medium 1024x1536 + Content Safety), so
 * even the biggest pack keeps a healthy margin. Single pages are not sold:
 * card fees would eat a 1 GEL charge.
 */

export interface ColoringPack {
  id: string;
  credits: number;
  priceTetri: number;
}

export const COLORING_PACKS: readonly ColoringPack[] = [
  { id: 'pack-10', credits: 10, priceTetri: 500 },
  { id: 'pack-30', credits: 30, priceTetri: 1200 },
  { id: 'pack-100', credits: 100, priceTetri: 3000 },
];

export function findColoringPack(id: string): ColoringPack | undefined {
  return COLORING_PACKS.find((p) => p.id === id);
}

export const COLORING_LIMITS = {
  topicMaxLength: 200,
  pagesPerHour: 20,
  // A GENERATING row older than this is treated as dead (process restart)
  // so it never blocks the user's next attempt.
  staleGeneratingMs: 5 * 60 * 1000,
} as const;
