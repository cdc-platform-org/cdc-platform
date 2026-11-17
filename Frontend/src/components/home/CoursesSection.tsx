/** Homepage learning catalog; shares course cards with the full catalog. */
import Link from 'next/link';
import { Bot, Check, Sparkles } from 'lucide-react';
import CourseCard, { CourseCardSkeleton } from '../courses/CourseCard';
import { bestsellerId } from '../../utils/courseBadges';
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
  const topId = bestsellerId(courses);
  const categories = Array.from(new Set(courses.map((c) => c.category))).filter(Boolean).sort();
  return (
    <section id="courses" className="max-w-7xl mx-auto py-16 sm:py-24 scroll-mt-24">
      <SectionHeader title={t('coursesHeading')} action={{ href: '/courses', label: t('viewAllCourses') }} />
      {/* Category pills (Skillshare-style): one tap to a filtered catalog. */}
      {categories.length > 1 && (
        <div className="-mt-4 mb-8 flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <Link key={cat} href={`/courses?category=${encodeURIComponent(cat)}`} className="shrink-0 rounded-full border border-cdc-border bg-cdc-surface px-4 py-2 text-sm font-semibold text-cdc-ink no-underline hover:border-cdc-primary/40 hover:bg-cdc-primary-soft transition-colors">
              {cat}
            </Link>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
        {/* IMIAKO — the AI English Tutor is its own always-on product, not a
            row from the `courses` API, so it's the first grid cell and is
            rendered regardless of the catalog's loading/empty state. */}
        <Link
          href="/dashboard/english-tutor"
          className="relative overflow-hidden rounded-[1.25rem] p-6 sm:p-8 flex flex-col justify-between no-underline text-white cdc-aurora shadow-card-hover"
        >
          <span className="absolute top-4 right-4 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-white/15 text-white">
            {t('imiakoBadgeFreeTrial')}
          </span>
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-white/10 text-white/80">
              <Bot className="w-3.5 h-3.5" aria-hidden="true" />
              {t('imiakoBadgeAiCourse')}
            </span>
            <h3 className="text-xl font-extrabold mt-5 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-300 shrink-0" aria-hidden="true" />
              {t('imiakoCardTitle')}
            </h3>
            <ul className="text-sm leading-relaxed text-white/75 mb-6 space-y-2 list-none pl-0">
              {(['imiakoFeature1', 'imiakoFeature2', 'imiakoFeature3'] as const).map((key) => (
                <li key={key} className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-cyan-300" aria-hidden="true" />
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold mb-4 text-white/90">{t('imiakoPricing')}</p>
            <span className="block text-center py-3 rounded-xl font-bold text-sm bg-white text-violet-900">{t('imiakoCta')}</span>
          </div>
        </Link>

        {coursesLoading ? (
          Array.from({ length: 3 }, (_, i) => <CourseCardSkeleton key={i} label={t('coursesLoading')} />)
        ) : courses.length === 0 ? (
          <p className="col-span-full text-center text-cdc-muted text-sm">{t('coursesEmpty')}</p>
        ) : (
          courses.map(course => <CourseCard key={course.id} course={course} lang={contentLang} enrolling={enrollingId === course.id} onEnroll={handleEnroll} bestseller={course.id === topId} />)
        )}
      </div>
    </section>
  );
}
