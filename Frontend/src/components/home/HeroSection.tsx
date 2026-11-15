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
  return <section className={styles.hero} data-home-hero>
    <div className={styles.grid}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}><span aria-hidden="true" />{tc('academy.eyebrow')}</p>
        <h1 className={styles.heading}>
          {cms?.heroTitleKa || cms?.heroTitleEn
            ? translate(cms.heroTitleKa || cms.heroTitleEn, cms.heroTitleEn || cms.heroTitleKa)
            : tc('academy.headline')}
        </h1>
        <p className={styles.description}>
          {cms?.heroSubtitleKa || cms?.heroSubtitleEn
            ? translate(cms.heroSubtitleKa || cms.heroSubtitleEn, cms.heroSubtitleEn || cms.heroSubtitleKa)
            : tc('academy.intro')}
        </p>
        <div className={styles.actions}>
          <a href="#courses" className={styles.primary}>{tc('academy.browse')}<ArrowRight size={17} aria-hidden="true" /></a>
          <Link href="/auth/register" className={styles.secondary}>{t('heroCtaJoin')}</Link>
          {promoVideo && <button type="button" onClick={() => setShowPromoVideo(true)} className={styles.video}><Play size={15} aria-hidden="true" />{t('heroCtaWatchDemo')}</button>}
        </div>
      </div>
      <figure className={styles.figure}>
        <div className={styles.slideshow}><HeroSlideshow alt={locale === 'ka' ? 'CDC — სტუდენტები და ტრენინგები' : 'CDC — students and trainings'} /></div>
        <figcaption className={styles.caption}><span>Center of Digital Careers</span><Link href="/about/gallery">{t('seeAllPhotos')}<ArrowUpRight size={15} aria-hidden="true" /></Link></figcaption>
      </figure>
    </div>
    <div className={styles.featured}><FeaturedCourseRail courses={courses} loading={coursesLoading} lang={locale === 'ka' ? 'ka' : 'en'} /></div>
  </section>;
}
