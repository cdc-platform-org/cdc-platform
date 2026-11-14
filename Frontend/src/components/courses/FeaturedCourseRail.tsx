import { useMemo, useRef } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslation } from 'next-i18next';
import type { Course } from '../../types/lms';
import CourseCard, { CourseCardSkeleton } from './CourseCard';

export default function FeaturedCourseRail({ courses, lang, loading = false }: { courses: Course[]; lang: 'ka' | 'en'; loading?: boolean }) {
  const { t } = useTranslation('courses');
  const rail = useRef<HTMLDivElement>(null);
  const featured = useMemo(() => [...courses].sort((a, b) => (b.enrolledCount || 0) - (a.enrolledCount || 0)).slice(0, 8), [courses]);
  if (!loading && !featured.length) return null;
  const move = (direction: number) => rail.current?.scrollBy({ left: direction * rail.current.clientWidth * 0.8, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  return <section className="mt-10 sm:mt-14 text-left" aria-label={t('academy.featured')}>
    <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-base font-bold">{t('academy.featured')}</h2><div className="flex gap-2">{[-1, 1].map(direction => <button key={direction} type="button" onClick={() => move(direction)} aria-label={t(direction < 0 ? 'academy.previous' : 'academy.next')} className="rounded-full border border-cdc-border p-2 text-cdc-ink hover:bg-cdc-primary-soft">{direction < 0 ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}</button>)}</div></div>
    <div ref={rail} className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-5">{loading ? Array.from({length:4},(_,i)=><div key={i} className="w-[80%] sm:w-[44%] lg:w-[calc((100%-60px)/4)] shrink-0"><CourseCardSkeleton label={t('loading')} /></div>) : featured.map(course => <div key={course.id} className="w-[80%] sm:w-[44%] lg:w-[calc((100%-60px)/4)] shrink-0 snap-start"><CourseCard course={course} lang={lang} /></div>)}</div>
  </section>;
}
