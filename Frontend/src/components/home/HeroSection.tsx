/**
 * Home page hero "Neon Studio" (2026-11-18): CDC-logo-inspired night/day sky
 * with a moving neon grid, the slogan, CTAs, stats and a live code-editor
 * window (HeroCodeDemo). Georgian on `ka`, English on every other locale.
 * Texts can be overridden from /admin/cms/homepage (hero title, subtitle,
 * kicker); the defaults below apply when nothing is set. Under the band: the
 * event-photo slideshow and the featured-course rail.
 */
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowRight, Play } from 'lucide-react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type { Course } from '../../types/lms';
import type { HomepageContent } from '../../types/siteContent';
import type { Tutorial } from '../../types/tutorial';
import FeaturedCourseRail from '../courses/FeaturedCourseRail';
import HeroSlideshow from './HeroSlideshow';
import HeroCodeDemo from './HeroCodeDemo';
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

const COPY = {
  ka: {
    kicker: 'CDC — ავტომატიზირებული სასწავლო პლატფორმა',
    lead: 'ისწავლე, განვითარდი, გახდი',
    highlight: 'ვერიფიცირებული პროფესიონალი',
    sub: 'ყოველი უნარი AI-ით შემოწმებული, ყოველი სერტიფიკატი ონლაინ გადამოწმებადი. ისწავლე კოდი, დიზაინი და AI პრაქტიკაში და პირველი შეკვეთა ჩვენივე პლატფორმაზე მიიღე.',
    start: 'დაიწყე უფასოდ',
    browse: 'კურსების ნახვა',
    graduates: 'კურსდამთავრებული',
    mentor: 'AI მენტორი',
    certs: 'გადამოწმებადი სერტიფიკატი',
    life: 'Center of Digital Careers',
    lifeLink: 'ყველა ფოტო',
  },
  en: {
    kicker: 'CDC — Automated Learning Platform',
    lead: 'Learn, grow, become a',
    highlight: 'verified professional',
    sub: 'Every skill AI-checked, every certificate verifiable online. Learn code, design and AI hands-on and land your first project on our own platform.',
    start: 'Start for free',
    browse: 'Browse courses',
    graduates: 'graduates',
    mentor: 'AI mentor',
    certs: 'verifiable certificates',
    life: 'Center of Digital Careers',
    lifeLink: 'All photos',
  },
} as const;

export default function HeroSection({ courses, coursesLoading, cms, translate, promoVideo, setShowPromoVideo }: HeroSectionProps) {
  const { locale } = useRouter();
  const lang: 'ka' | 'en' = locale === 'ka' ? 'ka' : 'en';
  const c = COPY[lang];
  const graduates = cms?.stats?.[0] ? translate(cms.stats[0].valueKa, cms.stats[0].valueEn) : '200+';
  const cmsTitle = cms?.heroTitleKa || cms?.heroTitleEn;
  const cmsSub = cms?.heroSubtitleKa || cms?.heroSubtitleEn;
  const cmsKicker = cms?.heroKickerKa || cms?.heroKickerEn;

  return (
    <section className={styles.hero} data-home-hero>
      <div className={styles.band}>
        <div className={styles.sky} aria-hidden="true" />
        <div className={styles.stars} aria-hidden="true" />
        <div className={styles.floor} aria-hidden="true"><div className={styles.plane} /></div>
        <div className={styles.wrap}>
          <div>
            <p className={styles.kicker}><i aria-hidden="true" />{cmsKicker ? translate(cms?.heroKickerKa || cms?.heroKickerEn, cms?.heroKickerEn || cms?.heroKickerKa) : c.kicker}</p>
            <h1 className={styles.title}>
              {cmsTitle ? (
                translate(cms?.heroTitleKa || cms?.heroTitleEn, cms?.heroTitleEn || cms?.heroTitleKa)
              ) : (
                <>{c.lead} <span className={styles.chrome}>{c.highlight}</span></>
              )}
            </h1>
            <p className={styles.sub}>{cmsSub ? translate(cms?.heroSubtitleKa || cms?.heroSubtitleEn, cms?.heroSubtitleEn || cms?.heroSubtitleKa) : c.sub}</p>
            <div className={styles.ctas}>
              <Link href="/auth/register" className={`${styles.cta} ${styles.main}`}>{c.start}<ArrowRight size={17} aria-hidden="true" /></Link>
              {promoVideo ? (
                <button type="button" onClick={() => setShowPromoVideo(true)} className={`${styles.cta} ${styles.alt}`}><Play size={15} aria-hidden="true" />{lang === 'ka' ? 'ნახე როგორ მუშაობს' : 'See how it works'}</button>
              ) : (
                <a href="#courses" className={`${styles.cta} ${styles.alt}`}>{c.browse}</a>
              )}
            </div>
            <dl className={styles.stats}>
              {[{ v: graduates, l: c.graduates }, { v: '24/7', l: c.mentor }, { v: '100%', l: c.certs }].map((s) => (
                <div key={s.l}><dt className="sr-only">{s.l}</dt><dd className="m-0"><b>{s.v}</b><span>{s.l}</span></dd></div>
              ))}
            </dl>
          </div>
          <HeroCodeDemo lang={lang} />
        </div>
      </div>
      <div className={styles.after}>
        <div className={styles.life}>
          <HeroSlideshow alt={c.life} />
          <div className={styles.lifeCap}>{c.life} · <Link href="/about/gallery" className="text-white underline">{c.lifeLink}</Link></div>
        </div>
        <div className="mt-10"><FeaturedCourseRail courses={courses} loading={coursesLoading} lang={lang} /></div>
      </div>
    </section>
  );
}
