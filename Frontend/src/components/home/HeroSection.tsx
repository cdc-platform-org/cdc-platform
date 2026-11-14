/**
 * Homepage hero (2026-11 redesign): light, centred headline block with the
 * key word in a soft violet highlight box, two CTAs, then the cover — an
 * auto-advancing photo slideshow (HeroSlideshow.tsx) framed as a large
 * rounded card. Layout inspired by the Figma e-learning template, colours
 * from the CDC logo via cdc-* tokens (works in dark mode too). Copy comes
 * from the CMS override first, then the `home` translations.
 */
import Link from 'next/link';
import { ArrowRight, Play, Sparkles } from 'lucide-react';
import HeroSlideshow from './HeroSlideshow';
import { HomepageContent } from '../../types/siteContent';
import { Tutorial } from '../../types/tutorial';
import type { TFunction } from 'i18next';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

interface HeroSectionProps {
  t: TFunction<"home", undefined>;
  cms: HomepageContent | null;
  translate: (geo: React.ReactNode, eng: React.ReactNode) => ReactNode;
  promoVideo: Tutorial | null;
  setShowPromoVideo: Dispatch<SetStateAction<boolean>>;
}

export default function HeroSection({ t, cms, translate, promoVideo, setShowPromoVideo }: HeroSectionProps) {
  return (
    <section className="relative pt-12 sm:pt-20 pb-6">
      <div className="max-w-5xl mx-auto text-center">
        <span className="cdc-eyebrow mb-6">
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          {t('heroBadge')}
        </span>

        {/* Inline line-height (not a `leading-*` utility): Georgian
            descenders on ვ/ჯ/ყ/ღ/პ/ხ clip below ~1.2 in these fonts. */}
        <h1 style={{ lineHeight: 1.3 }} className="text-[2rem] sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-cdc-ink">
          {cms?.heroTitleKa || cms?.heroTitleEn ? (
            translate(cms.heroTitleKa || cms.heroTitleEn, cms.heroTitleEn || cms.heroTitleKa)
          ) : (
            <>
              {t('heroHeadingBefore')}{' '}
              <span className="inline-block rounded-2xl bg-cdc-primary-soft px-3 text-cdc-primary-ink">{t('heroHeadingHighlight')}</span>{' '}
              {t('heroHeadingAfter')}
            </>
          )}
        </h1>

        <p className="mt-5 text-lg sm:text-2xl font-bold text-cdc-accent">
          {cms?.heroSubtitleKa || cms?.heroSubtitleEn
            ? translate(cms.heroSubtitleKa || cms.heroSubtitleEn, cms.heroSubtitleEn || cms.heroSubtitleKa)
            : t('heroSubtitle')}
        </p>

        <p className="mt-4 max-w-3xl mx-auto text-sm sm:text-lg leading-relaxed text-cdc-muted">{t('heroDescription')}</p>

        <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <a href="#courses" className="vip-btn-primary px-7 py-3.5 text-base no-underline">
            {t('heroCtaCourses')}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
          <Link href="/auth/register" className="vip-btn-secondary px-7 py-3.5 text-base no-underline">
            {t('heroCtaJoin')}
          </Link>
          {/* Only rendered once an admin has actually featured a tutorial
              (/admin/tutorials) — never a placeholder for a missing video. */}
          {promoVideo && (
            <button type="button" onClick={() => setShowPromoVideo(true)} className="vip-btn-secondary px-7 py-3.5 text-base cursor-pointer">
              <Play size={16} className="fill-current" aria-hidden="true" />
              {t('heroCtaWatchDemo')}
            </button>
          )}
        </div>
      </div>

      {/* Cover: auto-advancing photo slideshow of CDC events, framed as a
          big rounded card (see HeroSlideshow for loading/motion rules). */}
      <div className="max-w-6xl mx-auto mt-10 sm:mt-16 rounded-[28px] border border-cdc-border bg-cdc-surface p-2 sm:p-3 shadow-card-hover">
        <div className="relative overflow-hidden rounded-[22px] aspect-[4/3] sm:aspect-video bg-slate-900">
          <HeroSlideshow alt="CDC — სტუდენტები და ტრენინგები / students and trainings" />
        </div>
      </div>
    </section>
  );
}
