/** Editorial academy hero with CMS copy, CDC photo cover and featured courses. */
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import FeaturedCourseRail from '../courses/FeaturedCourseRail';
import type { Course } from '../../types/lms';
import { ArrowRight, Play, Sparkles } from 'lucide-react';
import HeroSlideshow from './HeroSlideshow';
import { HomepageContent } from '../../types/siteContent';
import { Tutorial } from '../../types/tutorial';
import type { TFunction } from 'i18next';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

interface HeroSectionProps {
  courses: Course[];
  coursesLoading: boolean;
  t: TFunction<"home", undefined>;
  cms: HomepageContent | null;
  translate: (geo: React.ReactNode, eng: React.ReactNode) => ReactNode;
  promoVideo: Tutorial | null;
  setShowPromoVideo: Dispatch<SetStateAction<boolean>>;
}

export default function HeroSection({ courses, coursesLoading, t, cms, translate, promoVideo, setShowPromoVideo }: HeroSectionProps) {
  const { t: tc } = useTranslation('courses');
  const { locale } = useRouter();
  return (
    <section className="relative pt-12 sm:pt-20 pb-6">
      <div className="max-w-7xl mx-auto text-center">
        <span className="cdc-eyebrow mb-6">
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          {tc('academy.eyebrow')}
        </span>

        {/* Inline line-height (not a `leading-*` utility): Georgian
            descenders on ვ/ჯ/ყ/ღ/პ/ხ clip below ~1.2 in these fonts. */}
        <h1 style={{ lineHeight: 1.3 }} className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-cdc-ink">
          {cms?.heroTitleKa || cms?.heroTitleEn ? (
            translate(cms.heroTitleKa || cms.heroTitleEn, cms.heroTitleEn || cms.heroTitleKa)
          ) : (
            tc('academy.headline')
          )}
        </h1>

        <p className="mt-5 text-lg sm:text-2xl font-bold text-cdc-accent">
          {cms?.heroSubtitleKa || cms?.heroSubtitleEn
            ? translate(cms.heroSubtitleKa || cms.heroSubtitleEn, cms.heroSubtitleEn || cms.heroSubtitleKa)
            : t('heroSubtitle')}
        </p>

        <p className="mt-4 max-w-3xl mx-auto text-sm sm:text-lg leading-relaxed text-cdc-muted">{tc('academy.intro')}</p>

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
          <HeroSlideshow alt={locale === 'ka' ? 'CDC — სტუდენტები და ტრენინგები' : 'CDC — students and trainings'} />
        </div>
      </div>
      <FeaturedCourseRail courses={courses} loading={coursesLoading} lang={locale === 'ka' ? 'ka' : 'en'} />
    </section>
  );
}
