/**
 * Homepage AI career quiz promo banner, shown right before the course
 * catalog so an undecided visitor is offered a recommendation first.
 * 2026-11 redesign: solid brand-violet banner card (cdc-* tokens).
 */
import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { TFunction } from 'i18next';

interface CareerQuizPromoProps {
  t: TFunction<"home", undefined>;
  // Kept for the existing call site; styling is token-based now.
  darkMode?: boolean;
}

export default function CareerQuizPromo({ t }: CareerQuizPromoProps) {
  return (
    <section className="max-w-7xl mx-auto mt-16 sm:mt-24">
      <div className="relative overflow-hidden rounded-card bg-cdc-primary px-6 py-10 sm:px-12 sm:py-12 flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
        {/* soft decorative glow, purely visual */}
        <div className="pointer-events-none absolute -right-20 -top-20 w-72 h-72 rounded-full bg-cyan-400/30 blur-3xl" aria-hidden="true" />
        <span className="relative w-14 h-14 shrink-0 rounded-2xl bg-white/15 flex items-center justify-center text-white">
          <Sparkles className="w-7 h-7" aria-hidden="true" />
        </span>
        <div className="relative flex-1">
          <h2 style={{ lineHeight: 1.3 }} className="text-xl md:text-2xl font-extrabold text-white mb-2">{t('careerQuizBannerTitle')}</h2>
          <p className="text-sm md:text-base text-white/85 max-w-2xl">{t('careerQuizBannerSubtitle')}</p>
        </div>
        <Link
          href="/career-test"
          className="relative inline-flex items-center justify-center gap-2 shrink-0 rounded-xl bg-white px-6 py-3.5 text-sm md:text-base font-bold text-violet-800 no-underline hover:bg-violet-50 transition-colors"
        >
          {String(t('careerQuizBannerCta')).replace(/\s*→\s*$/, '')}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
