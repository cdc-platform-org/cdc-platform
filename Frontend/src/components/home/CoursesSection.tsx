/** Homepage learning catalog; shares course cards with the full catalog. */
import Link from 'next/link';
import { Bot, Check, Sparkles } from 'lucide-react';
import CourseCard, { CourseCardSkeleton } from '../courses/CourseCard';
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
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
          Array.from({ length: 3 }, (_, i) => <CourseCardSkeleton key={i} label={t('coursesLoading')} />)
        ) : courses.length === 0 ? (
          <p className="col-span-full text-center text-cdc-muted text-sm">{t('coursesEmpty')}</p>
        ) : (
          courses.map(course => <CourseCard key={course.id} course={course} lang={contentLang} enrolling={enrollingId === course.id} onEnroll={handleEnroll} />)
        )}
      </div>
    </section>
  );
}
