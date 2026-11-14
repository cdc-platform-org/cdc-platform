/**
 * Homepage course catalog (#courses) with pricing, sale countdowns and
 * enroll buttons. 2026-11 redesign: Figma-style course cards (inset photo,
 * chips, title, short text, price, full-width actions) on cdc-* tokens.
 * The IMIAKO AI tutor is a separate product hand-placed as the first card.
 */
import Link from 'next/link';
import { Bot, Check, Clock, GraduationCap, Sparkles } from 'lucide-react';
import { formatPrice, getSaleCountdownLabel } from '../../utils/coursePricing';
import LearningRatingSummary from '../shared/LearningRatingSummary';
import SectionHeader from './SectionHeader';
import { Course } from '../../types/lms';
import type { TFunction } from 'i18next';

interface CoursesSectionProps {
  t: TFunction<"home", undefined>;
  // Kept for the existing call site; styling is token-based now.
  darkMode?: boolean;
  coursesLoading: boolean;
  courses: Course[];
  contentLang: "ka" | "en";
  handleEnroll: (course: Course) => void;
  enrollingId: string | null;
}

export default function CoursesSection({ t, coursesLoading, courses, contentLang, handleEnroll, enrollingId }: CoursesSectionProps) {
  return (
    <section id="courses" className="max-w-7xl mx-auto py-16 sm:py-24 scroll-mt-24">
      <SectionHeader title={t('coursesHeading')} action={{ href: '/courses', label: t('viewAllCourses') }} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* IMIAKO — the AI English Tutor is its own always-on product, not a
            row from the `courses` API, so it's the first grid cell and is
            rendered regardless of the catalog's loading/empty state. */}
        <Link
          href="/dashboard/english-tutor"
          className="relative overflow-hidden rounded-card p-6 sm:p-8 flex flex-col justify-between no-underline text-white bg-gradient-to-br from-violet-700 via-indigo-700 to-cyan-700 shadow-card-hover transition-transform duration-300 hover:-translate-y-0.5"
        >
          <span className="absolute top-4 right-4 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur">
            {t('imiakoBadgeFreeTrial')}
          </span>
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/15">
              <Bot className="w-3.5 h-3.5" aria-hidden="true" />
              {t('imiakoBadgeAiCourse')}
            </span>
            <h3 className="text-xl font-extrabold mt-5 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-300 shrink-0" aria-hidden="true" />
              {t('imiakoCardTitle')}
            </h3>
            <ul className="text-sm leading-relaxed text-white/85 mb-6 space-y-2 list-none pl-0">
              {(['imiakoFeature1', 'imiakoFeature2', 'imiakoFeature3'] as const).map((key) => (
                <li key={key} className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-cyan-200" aria-hidden="true" />
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold mb-4 text-white/90">{t('imiakoPricing')}</p>
            <span className="block text-center py-3 rounded-xl font-bold text-sm bg-white text-violet-800">{t('imiakoCta')}</span>
          </div>
        </Link>

        {coursesLoading ? (
          <p className="col-span-full text-center text-cdc-muted text-sm">{t('coursesLoading')}</p>
        ) : courses.length === 0 ? (
          <p className="col-span-full text-center text-cdc-muted text-sm">{t('coursesEmpty')}</p>
        ) : (
          courses.map((course) => {
            const countdown = course.saleActive ? getSaleCountdownLabel(course.discountEndDate, contentLang) : null;
            const image = course.thumbnailUrl || course.coverImageUrl;
            return (
              <div key={course.id} className="vip-card p-4 sm:p-5 flex flex-col">
                <Link href={`/courses/${course.id}`} className="relative block overflow-hidden rounded-xl aspect-[16/10] bg-cdc-primary-soft no-underline">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-cdc-primary-ink">
                      <GraduationCap className="w-10 h-10" aria-hidden="true" />
                    </span>
                  )}
                  {course.saleActive && (
                    <span className="absolute top-3 right-3 text-xs font-bold text-white px-2.5 py-1 rounded-lg bg-rose-600">
                      {course.discountBadgeText || `-${course.discountPercent}%`}
                    </span>
                  )}
                </Link>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="cdc-chip">{course.category}</span>
                  {course.mentorName && <span className="ml-auto text-xs font-semibold text-cdc-ink truncate max-w-[50%]">{course.mentorName}</span>}
                </div>

                <Link href={`/courses/${course.id}`} className="block no-underline text-current mt-3">
                  <h3 className="text-lg font-bold text-cdc-ink hover:text-cdc-primary-ink transition-colors">{course.title}</h3>
                  <LearningRatingSummary {...course} lang={contentLang} />
                </Link>
                <p className="mt-2 text-sm leading-relaxed text-cdc-muted line-clamp-3 flex-1">{course.description}</p>

                {countdown && (
                  <p className="mt-4 text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    {countdown}
                  </p>
                )}
                <div className="mt-4 flex items-baseline gap-2">
                  {course.saleActive && <s className="text-sm text-cdc-muted">{formatPrice(course.originalPrice)}</s>}
                  <span className="text-xl font-extrabold text-cdc-ink">{formatPrice(course.currentPrice)}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/courses/${course.id}`} className="vip-btn-secondary flex-1 no-underline">
                    {t('viewDetails')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleEnroll(course)}
                    disabled={enrollingId === course.id}
                    className="vip-btn-primary flex-1 cursor-pointer disabled:opacity-60"
                  >
                    {enrollingId === course.id ? t('enrolling') : t('enroll')}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
