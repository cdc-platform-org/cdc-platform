import Link from 'next/link';
import { SupportedLocale } from '../../utils/locale';

interface VideoTutorialLinkProps {
  href?: string;
  label?: string;
  lang: SupportedLocale;
  className?: string;
}

// Shared "🎥 Watch tutorial" out-link to /tutorials, standardizing the
// identical markup that used to be duplicated inline (dashboard.tsx's
// product-submission form, PostingForm.tsx's gig/vacancy form) with slightly
// different copy each time. `label` overrides the default ka/en-fallback
// copy for a call site that needs different wording; every other caller just
// passes `lang` and gets the site's standard tutorial-link copy for free.
export default function VideoTutorialLink({ href = '/tutorials', label, lang, className }: VideoTutorialLinkProps) {
  return (
    <Link
      href={href}
      target="_blank"
      className={className ?? 'text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline whitespace-nowrap shrink-0'}
    >
      🎥 {label ?? (lang === 'ka' ? 'ვიდეო ინსტრუქცია' : 'Watch tutorial')}
    </Link>
  );
}
