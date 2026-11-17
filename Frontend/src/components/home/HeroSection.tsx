/**
 * Home page hero, design v2 "Aurora" (2026-11-17): night band with the
 * logo's violet/cyan glow, white headline (CMS override first, then the
 * courses `academy.*` copy), CTAs, a short stats row and the event-photo
 * slideshow (HeroSlideshow) in a glowing glass frame. The featured-course
 * rail renders under the band. Layout/visuals live in HeroSection.module.css.
 */
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { ArrowRight, ArrowUpRight, Play } from 'lucide-react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type { Course } from '../../types/lms';
import type { HomepageContent } from '../../types/siteContent';
import type { Tutorial } from '../../types/tutorial';
import FeaturedCourseRail from '../courses/FeaturedCourseRail';
import HeroSlideshow from './HeroSlideshow';
import styles from './HeroSection.module.css';

interface HeroSectionProps {
  courses: Course[];
  coursesLoading: boolean;
  t: TFunction<'home', undefined>;
  cms: HomepageContent | null;
  translate: (geo: ReactNode, eng: ReactNode) => ReactNode;
  promoVideo: Tutorial | null;
  setShowPromoVideo: Dispatch<SetStateAction<boolean>>;
}

export default function HeroSection({ courses, coursesLoading, t, cms, translate, promoVideo, setShowPromoVideo }: HeroSectionProps) {
  const { t: tc } = useTranslation('courses');
  const { locale } = useRouter();
  const ka = locale === 'ka';
  // Real figures only: graduates come from the CMS stats (same source as the
  // achievements block), the rest are product facts.
  const graduates = cms?.stats?.[0] ? translate(cms.stats[0].valueKa, cms.stats[0].valueEn) : '200+';
  const stats = [
    { value: graduates, label: ka ? 'კურსდამთავრებული' : 'graduates' },
    { value: '24/7', label: ka ? 'AI მასწავლებელი' : 'AI tutor' },
    { value: '2023', label: ka ? 'დაარსდა' : 'founded' },
  ];
  return (
    <section className={styles.hero} data-home-hero>
      <div className={`${styles.band} cdc-aurora`}>
        <div className={`${styles.gridLines} cdc-aurora-grid`} aria-hidden="true" />
        <div className={styles.grid}>
          <div className={styles.copy}>
            <p className={`${styles.eyebrow} cdc-glass`}><span aria-hidden="true" />{tc('academy.eyebrow')}</p>
            <h1 className={styles.heading}>
              {cms?.heroTitleKa || cms?.heroTitleEn ? (
                translate(cms.heroTitleKa || cms.heroTitleEn, cms.heroTitleEn || cms.heroTitleKa)
              ) : (
                <>
                  {t('heroHeadingBefore')} <span className="cdc-gradient-text">{t('heroHeadingHighlight')}</span> {t('heroHeadingAfter')}
                </>
              )}
            </h1>
            <p className={styles.description}>
              {cms?.heroSubtitleKa || cms?.heroSubtitleEn
                ? translate(cms.heroSubtitleKa || cms.heroSubtitleEn, cms.heroSubtitleEn || cms.heroSubtitleKa)
                : tc('academy.intro')}
            </p>
            <div className={styles.actions}>
              <a href="#courses" className={styles.primary}>{tc('academy.browse')}<ArrowRight size={17} aria-hidden="true" /></a>
              <Link href="/auth/register" className={`${styles.secondary} cdc-glass`}>{t('heroCtaJoin')}</Link>
              {promoVideo && (
                <button type="button" onClick={() => setShowPromoVideo(true)} className={styles.video}>
                  <Play size={15} aria-hidden="true" />{t('heroCtaWatchDemo')}
                </button>
              )}
            </div>
            <dl className={styles.stats}>
              {stats.map((s) => (
                <div key={s.label}><dt className="sr-only">{s.label}</dt><dd className="m-0"><strong>{s.value}</strong><span>{s.label}</span></dd></div>
              ))}
            </dl>
          </div>
          <figure className={styles.figure}>
            <div className={styles.glow} aria-hidden="true" />
            <div className={`${styles.frame} cdc-glass`}>
              <div className={styles.slideshow}><HeroSlideshow alt={ka ? 'CDC — სტუდენტები და ტრენინგები' : 'CDC — students and trainings'} /></div>
              <figcaption className={`${styles.caption} cdc-glass`}>
                <span>Center of Digital Careers</span>
                <Link href="/about/gallery">{t('seeAllPhotos')}<ArrowUpRight size={15} aria-hidden="true" /></Link>
              </figcaption>
            </div>
          </figure>
        </div>
      </div>
      <div className={styles.featured}><FeaturedCourseRail courses={courses} loading={coursesLoading} lang={ka ? 'ka' : 'en'} /></div>
    </section>
  );
}
