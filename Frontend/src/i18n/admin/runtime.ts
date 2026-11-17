// Admin-panel translation runtime. The admin panel has its own KA/EN switch
// (separate from the public site's next-i18next locale), stored in
// localStorage under `cdc_admin_lang`. Page copy is written in English in the
// source and wrapped in `at('English text')`; the Georgian text lives in
// ./ka/*.ts keyed by that same English string (gettext-style), so EN never
// needs a second copy and a missing KA entry simply falls back to English.
//
// The language is a tiny external store (not React state) so that `at()` can
// be called anywhere — page bodies, label maps, toasts — without threading a
// hook through every component. _app.tsx re-keys the admin page when the
// language changes (see useAdminLangVersion), which re-renders everything.
//
// The sidebar/nav vocabulary still lives in src/data/adminDict.ts.
import { useSyncExternalStore } from 'react';
import { KA } from './ka';

export type AdminLang = 'ka' | 'en';

const STORAGE_KEY = 'cdc_admin_lang';
// Georgian is the platform's primary language — an admin who never touched
// the switch sees KA.
const DEFAULT_LANG: AdminLang = 'ka';

function readStoredLang(): AdminLang {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'ka' || stored === 'en' ? stored : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

let currentLang: AdminLang = readStoredLang();
// Bumped only by an explicit switch, never by the initial read, so the
// first render does not remount the page (and refetch its data) for nothing.
let version = 0;
const listeners = new Set<() => void>();

export function getAdminLang(): AdminLang {
  return currentLang;
}

export function setAdminLang(next: AdminLang) {
  if (next === currentLang) return;
  currentLang = next;
  version += 1;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* private mode — the choice just won't persist */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAdminLangValue(): AdminLang {
  return useSyncExternalStore(subscribe, getAdminLang, () => DEFAULT_LANG);
}

export function useAdminLangVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

/** Translate an English UI string for the admin panel. */
export function at(text: string): string {
  if (currentLang !== 'ka') return text;
  return KA[text] ?? text;
}

/**
 * Translate a string with placeholders: atf('Showing {0} of {1}', a, b).
 * The KA entry uses the same {n} placeholders, in whatever order Georgian
 * word order needs.
 */
export function atf(template: string, ...args: unknown[]): string {
  return at(template).replace(/\{(\d+)\}/g, (m, i) => {
    const v = args[Number(i)];
    return v === undefined || v === null ? '' : String(v);
  });
}

/**
 * Translate an enum-ish status value shown as a badge (PENDING, APPROVED,
 * in_progress …). Unknown values are shown as they are.
 */
export function atEnum(value: unknown): string {
  if (typeof value !== 'string' || !value) return value === undefined || value === null ? '' : String(value);
  if (currentLang !== 'ka') return value;
  return KA[`enum:${value.toUpperCase()}`] ?? KA[value] ?? value;
}

export function adminLocale(): string {
  return currentLang === 'ka' ? 'ka-GE' : 'en-US';
}
