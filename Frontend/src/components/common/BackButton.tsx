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
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors bg-transparent border-none cursor-pointer p-0 ${className}`}
    >
      <ChevronLeft className="w-4 h-4" />
      {resolvedLabel}
    </button>
  );
}
