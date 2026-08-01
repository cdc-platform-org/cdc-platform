import { useRouter } from 'next/router';
import { ChevronLeft } from 'lucide-react';

interface BackButtonProps {
  // Where to go if there's no browser history to go back to (e.g. the user
  // landed directly on this page from an external link or a new tab).
  fallbackHref?: string;
  label?: string;
  className?: string;
}

const DEFAULT_LABEL: Record<string, string> = {
  ka: 'უკან დაბრუნება',
  en: 'Back',
};

export default function BackButton({ fallbackHref = '/', label, className = '' }: BackButtonProps) {
  const router = useRouter();
  const resolvedLabel = label ?? DEFAULT_LABEL[router.locale === 'en' ? 'en' : 'ka'];

  const handleClick = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
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
