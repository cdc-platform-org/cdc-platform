import { useSyncExternalStore } from 'react';

const key = 'cdc-course-wishlist';
const eventName = 'cdc-course-wishlist-change';
function snapshot() {
  try { return window.localStorage.getItem(key) || '[]'; } catch { return '[]'; }
}
function subscribe(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener(eventName, notify);
  return () => { window.removeEventListener('storage', notify); window.removeEventListener(eventName, notify); };
}
function parse(value: string): string[] {
  try { const data: unknown = JSON.parse(value); return Array.isArray(data) ? data.filter((id): id is string => typeof id === 'string') : []; } catch { return []; }
}
/** Device-local bookmarks, synchronized between cards and browser tabs. */
export function useCourseWishlist(id: string) {
  const value = useSyncExternalStore(subscribe, snapshot, () => '[]');
  const saved = parse(value).includes(id);
  const toggle = () => {
    const current = parse(snapshot());
    const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
    try { window.localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event(eventName)); } catch { /* Storage can be disabled by the browser. */ }
  };
  return { saved, toggle };
}
