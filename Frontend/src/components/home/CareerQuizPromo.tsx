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
      <div className="relative overflow-hidden rounded-xl border border-cdc-border bg-cdc-surface px-6 py-8 sm:px-9 sm:py-9 flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
        <span className="relative w-12 h-12 shrink-0 rounded-xl bg-cdc-primary-soft flex items-center justify-center text-cdc-primary-ink">
          <Sparkles className="w-7 h-7" aria-hidden="true" />
        </span>
        <div className="relative flex-1">
          <h2 style={{ lineHeight: 1.3 }} className="text-xl md:text-2xl font-bold text-cdc-ink mb-2">{t('careerQuizBannerTitle')}</h2>
          <p className="text-sm text-cdc-muted max-w-2xl">{t('careerQuizBannerSubtitle')}</p>
        </div>
        <Link
          href="/career-test"
          className="relative inline-flex items-center justify-center gap-2 shrink-0 rounded-lg bg-cdc-ink px-5 py-3 text-sm font-semibold text-cdc-surface no-underline hover:opacity-90 transition-opacity"
        >
          {String(t('careerQuizBannerCta')).replace(/\s*→\s*$/, '')}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
