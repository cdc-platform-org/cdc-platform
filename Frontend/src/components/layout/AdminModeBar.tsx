import Link from 'next/link';
import { useRouter } from 'next/router';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const STRINGS = {
  ka: { label: 'ადმინისტრატორის რეჟიმი', back: '↩ ადმინ პანელში დაბრუნება' },
  en: { label: 'Admin Mode', back: '↩ Back to Admin Panel' },
};

// Sticky reminder shown to any admin-team member browsing the public/
// student site (not while they're actually inside /admin, which has its
// own chrome) — lets them jump back without hunting for a way in. Rendered
// globally in _app.tsx rather than per-page, so it follows them regardless
// of which public page they're on.
export default function AdminModeBar() {
  const router = useRouter();
  const { user } = useAuth();
  const lang = router.locale === 'ka' ? 'ka' : 'en';
  const t = STRINGS[lang];

  if (!user?.adminRole || router.pathname.startsWith('/admin')) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[70] bg-slate-900 text-white border-t border-cyan-500/30 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-center gap-3 text-xs sm:text-sm font-bold flex-wrap">
        <span className="flex items-center gap-1.5 text-amber-400">
          <ShieldAlert className="w-4 h-4" />
          {t.label}
        </span>
        <Link href="/admin" className="text-cyan-400 hover:text-cyan-300 no-underline">
          {t.back}
        </Link>
      </div>
    </div>
  );
}
