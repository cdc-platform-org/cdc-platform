import Link from 'next/link';
import { Gift } from 'lucide-react';

// "🎁 Gift this" — sends the visitor to /gift-cards with the amount set to
// this item's current price and the item named on the card as a suggestion.
// The card itself still works on every product (it's an ALL-products code).
interface Props {
  priceMinor: number; // tetri
  itemTitle: string;
  itemPath: string; // same-site path, e.g. /courses/abc
  lang: 'ka' | 'en' | string;
  variant?: 'light' | 'dark';
  design?: 'classic' | 'birthday' | 'celebration' | 'kids';
  className?: string;
}

export default function GiftThisButton({ priceMinor, itemTitle, itemPath, lang, variant = 'light', design, className = '' }: Props) {
  if (!priceMinor || priceMinor <= 0) return null;
  const gel = Math.min(1000, Math.max(5, Math.ceil(priceMinor / 100)));
  const href = { pathname: '/gift-cards', query: { amount: String(gel), item: itemTitle.slice(0, 150), url: itemPath, ...(design ? { design } : {}) } };
  const label = lang === 'ka' ? 'აჩუქე' : 'Gift this';
  const cls =
    variant === 'dark'
      ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
      : 'border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:border-pink-500/30 dark:bg-pink-500/10 dark:text-pink-300';
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold no-underline transition ${cls} ${className}`}
      title={lang === 'ka' ? 'იყიდე სასაჩუქრე ბარათი ამ პროდუქტისთვის' : 'Buy a gift card for this'}
    >
      <Gift className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}
