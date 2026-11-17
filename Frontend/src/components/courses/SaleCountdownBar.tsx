/**
 * Domestika-style "this price won't last" strip with a live countdown.
 * Shown only when a real course sale is running: it picks the active sale
 * that ends soonest (course.saleActive + discountEndDate in the future) and
 * hides itself when that time passes. No sale → renders nothing.
 * Used on the home page and /courses.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Timer } from 'lucide-react';
import { Course } from '../../types/lms';

const COPY = {
  ka: { text: 'ფასდაკლება დიდხანს არ გაგრძელდება', days: 'დღე', cta: 'ნახე კურსები' },
  en: { text: "This price won't last long", days: 'd', cta: 'See courses' },
} as const;

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const pad = (n: number) => String(n).padStart(2, '0');

export default function SaleCountdownBar({ courses, lang, href = '/courses' }: { courses: Course[]; lang: 'ka' | 'en'; href?: string }) {
  const endsAt = useMemo(() => {
    const now = Date.now();
    const ends = courses
      .filter((c) => c.saleActive && c.discountEndDate)
      .map((c) => new Date(c.discountEndDate as string).getTime())
      .filter((t) => t > now);
    return ends.length ? Math.min(...ends) : null;
  }, [courses]);

  // Clock starts after mount so server and client HTML match.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  if (!endsAt || now === null || endsAt <= now) return null;
  const { d, h, m, s } = split(endsAt - now);
  const c = COPY[lang];

  return (
    <div className="-mx-4 sm:-mx-6 bg-cdc-ink text-cdc-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-2 font-bold">
          <Timer className="w-4 h-4 text-rose-400" aria-hidden="true" />
          <span className="hidden sm:inline">{c.text}</span>
        </span>
        <span className="font-mono text-base font-bold tabular-nums" aria-live="off">
          {d > 0 && `${d}${c.days} `}
          {pad(h)}:{pad(m)}:{pad(s)}
        </span>
        <Link href={href} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white no-underline hover:bg-rose-700">
          {c.cta}
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
