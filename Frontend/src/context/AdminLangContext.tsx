// Thin React wrapper over the admin language store in src/i18n/admin/runtime.ts
// (kept so existing `useAdminLang()` callers — AdminLayout, users.tsx — keep
// working). The store, not this context, is the source of truth.
import { ReactNode } from 'react';
import { AdminLang, setAdminLang, useAdminLangValue } from '../i18n/admin';

export type { AdminLang };

interface AdminLangContextValue {
  lang: AdminLang;
  setLang: (lang: AdminLang) => void;
  toggleLang: () => void;
}

export function AdminLangProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAdminLang(): AdminLangContextValue {
  const lang = useAdminLangValue();
  return {
    lang,
    setLang: setAdminLang,
    toggleLang: () => setAdminLang(lang === 'ka' ? 'en' : 'ka'),
  };
}
