import { useRouter } from 'next/router';
import { ChevronLeft } from 'lucide-react';
import { resolveLocale } from '../../utils/locale';

interface BackButtonProps {
  // Where to go if there's no browser history to go back to (e.g. the user
  // landed directly on this page from an external link or a new tab).
  fallbackHref?: string;
  label?: string;
  className?: string;
  // Skip router.back() entirely and always navigate to fallbackHref — for
  // pages (e.g. /dashboard) that want this button to be an explicit "go
  // home" action regardless of where the user came from.
  forceFallback?: boolean;
}

const DEFAULT_LABEL = {
  ka: 'უკან დაბრუნება',
  en: 'Back',
  de: 'Zurück',
  es: 'Atrás',
  fr: 'Retour',
  uk: 'Назад',
};

export default function BackButton({ fallbackHref = '/', label, className = '', forceFallback = false }: BackButtonProps) {
  const router = useRouter();
  const resolvedLabel = label ?? DEFAULT_LABEL[resolveLocale(router.locale)];

  const handleClick = () => {
    if (!forceFallback && typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group inline-flex items-center gap-1.5 bg-transparent p-0 border-none shadow-none rounded-none cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-400 transition-all duration-200 hover:text-blue-600 dark:hover:text-blue-400 ${className}`}
    >
      <ChevronLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
      {resolvedLabel}
    </button>
  );
}
