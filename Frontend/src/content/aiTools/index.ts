// Lazy loader for the AI tool catalog copy. Each locale is its own chunk,
// so a tool page downloads only the visitor's language (falls back to English).
import { useEffect, useState } from 'react';
import type { AiToolsLocale } from './types';

export type { AiToolsLocale, AiToolKey, AiToolUnit, AiToolCopy } from './types';

const loaders: Record<string, () => Promise<{ default: AiToolsLocale }>> = {
  en: () => import('./en'),
  ka: () => import('./ka'),
  de: () => import('./de'),
  es: () => import('./es'),
  fr: () => import('./fr'),
  uk: () => import('./uk'),
  tr: () => import('./tr'),
  az: () => import('./az'),
  hy: () => import('./hy'),
};

const cache = new Map<string, AiToolsLocale>();

export async function loadAiToolsCopy(locale: string | undefined): Promise<AiToolsLocale> {
  const key = locale && loaders[locale] ? locale : 'en';
  const hit = cache.get(key);
  if (hit) return hit;
  const copy = (await loaders[key]()).default;
  cache.set(key, copy);
  return copy;
}

/** Copy for the given locale; null until the chunk has loaded. */
export function useAiToolsCopy(locale: string | undefined): AiToolsLocale | null {
  const [copy, setCopy] = useState<AiToolsLocale | null>(() => cache.get(locale && loaders[locale] ? locale : 'en') ?? null);
  useEffect(() => {
    let active = true;
    loadAiToolsCopy(locale).then(value => { if (active) setCopy(value); }).catch(() => { /* keep previous copy */ });
    return () => { active = false; };
  }, [locale]);
  return copy;
}

/** "29 ₾" / "29 GEL" from tetri. */
export function formatGel(copy: AiToolsLocale, minor: number): string {
  const value = (minor / 100).toFixed(2).replace(/\.00$/, '');
  return copy.currency === '₾' ? `${value} ₾` : `${value} ${copy.currency}`;
}

export function formatDate(copy: AiToolsLocale, iso: string | Date | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(copy.intl, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return new Date(iso).toISOString().slice(0, 10);
  }
}
