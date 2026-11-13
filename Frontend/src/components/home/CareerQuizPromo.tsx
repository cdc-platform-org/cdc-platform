/**
 * Homepage AI career quiz promo banner, shown right before the course catalog.
 */
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { TFunction } from 'i18next';

interface CareerQuizPromoProps {
  t: TFunction<"home", undefined>;
  darkMode: boolean;
}

export default function CareerQuizPromo({ t, darkMode }: CareerQuizPromoProps) {
  return (
    <>
      {/* 🎯 AI CAREER QUIZ PROMO — placed right before the course catalog so a
          visitor who isn't sure which course fits them gets offered a
          personalized recommendation before being asked to browse the full
          list themselves. mt-16/mb-16 (was a `-mt-4` that pulled this up far
          enough to overlap the gallery section's "See All Photos" link right
          above it) give it real breathing room on both sides instead. */}
      <section className="max-w-5xl mx-auto px-0 sm:px-6 mt-12 sm:mt-16 mb-12 sm:mb-16">
        <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-purple-600/10 to-cyan-500/10 p-6 sm:p-8 md:p-12 text-center">
          <Sparkles className="w-8 h-8 text-cyan-400 mx-auto mb-4" />
          <h2 className="text-xl md:text-2xl font-black tracking-wide mb-3">{t('careerQuizBannerTitle')}</h2>
          {/* Explicit light/dark colors rather than relying on inherited
              text color — the card's translucent gradient reads as a pale
              wash over a light background in light mode, and the previous
              fixed text-slate-400 was too low-contrast against it. */}
          <p className={`text-sm md:text-base mb-7 max-w-xl mx-auto ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {t('careerQuizBannerSubtitle')}
          </p>
          <Link
            href="/career-test"
            className="inline-flex items-center gap-2 font-black text-sm md:text-base px-7 py-3.5 rounded-xl text-white bg-gradient-to-r from-cyan-500 to-purple-600 no-underline hover:opacity-90 transition-opacity shadow-[0_0_25px_rgba(34,211,238,0.25)]"
          >
            {t('careerQuizBannerCta')} →
          </Link>
        </div>
      </section>
    </>
  );
}
