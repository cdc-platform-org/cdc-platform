import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type AdminLang = 'ka' | 'en';

interface AdminLangContextValue {
  lang: AdminLang;
  setLang: (lang: AdminLang) => void;
  toggleLang: () => void;
}

const AdminLangContext = createContext<AdminLangContextValue | undefined>(undefined);

const STORAGE_KEY = 'cdc_admin_lang';

export function AdminLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AdminLang>('en');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'ka' || stored === 'en') setLangState(stored);
  }, []);

  const setLang = (next: AdminLang) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const toggleLang = () => setLang(lang === 'ka' ? 'en' : 'ka');

  return <AdminLangContext.Provider value={{ lang, setLang, toggleLang }}>{children}</AdminLangContext.Provider>;
}

export function useAdminLang(): AdminLangContextValue {
  const context = useContext(AdminLangContext);
  if (context === undefined) {
    throw new Error('useAdminLang must be used within an AdminLangProvider');
  }
  return context;
}
