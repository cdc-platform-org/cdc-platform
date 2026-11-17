/**
 * Course card shared by the home page, featured rail and /courses catalog.
 * Design v2 (2026-11-17) adds Domestika/Skillshare patterns: stacked status
 * badges (Bestseller from real enrollments via `bestseller`, New, -X%), a
 * red "-X%" + crossed-out old price next to the current price, and a
 * full-width Buy button. Price/sale/new state comes from useCourseDisplayPrice.
 */
import Link from 'next/link';
import { Bookmark, Play, ShoppingCart, Star, Users } from 'lucide-react';
import { useTranslation } from 'next-i18next';
import type { Course } from '../../types/lms';
import { formatPrice } from '../../utils/coursePricing';
import { courseLanguageBadge } from '../../utils/courseLanguage';
import { useCourseDisplayPrice } from '../../hooks/useCourseDisplayPrice';
import { useCourseWishlist } from '../../hooks/useCourseWishlist';

export interface CourseCardProps {
  course: Course;
  lang: 'ka' | 'en';
  enrolling?: boolean;
  onEnroll?: (course: Course) => void;
  /** Mark as the list's bestseller (see utils/courseBadges.ts). */
  bestseller?: boolean;
}

export default function CourseCard({ course, lang, enrolling = false, onEnroll, bestseller = false }: CourseCardProps) {
  const { t } = useTranslation('courses');
  const price = useCourseDisplayPrice(course);
  const { saved, toggle } = useCourseWishlist(course.id);
  const title = (lang === 'en' && course.titleEn) || course.title;
  const image = course.thumbnailUrl || course.coverImageUrl;
  const href = `/courses/${course.id}`;
  const action = `${t(price.currentPrice === 0 ? 'enrollFree' : 'detailPage.buy')}${price.currentPrice > 0 ? ` · ${formatPrice(price.currentPrice)}` : ''}`;
  return (
    <article data-course-card={course.id} className="learning-course-card group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-cdc-border bg-cdc-surface">
      <div className="relative">
        <Link href={href} aria-label={title} className="relative block aspect-video overflow-hidden bg-cdc-primary-soft">
          {image ? <img src={image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 motion-reduce:transition-none group-hover:scale-105" /> : <span className="flex h-full items-center justify-center text-cdc-primary-ink"><Play className="h-10 w-10" /></span>}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-8 text-[11px] font-medium text-white flex justify-between gap-2"><span>{course.category}</span><span>{courseLanguageBadge(course.language, lang)}</span></div>
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {bestseller && <span className="rounded-md bg-amber-400 px-2 py-1 text-[10px] font-extrabold text-amber-950 shadow-sm">{lang === 'ka' ? 'ბესტსელერი' : 'Bestseller'}</span>}
            {price.isNew && !bestseller && <span className="rounded-md bg-emerald-500 px-2 py-1 text-[10px] font-extrabold text-white shadow-sm">{t('detailPage.new')}</span>}
            {price.saleActive && <span className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-extrabold text-white shadow-sm">−{course.discountPercent}%</span>}
          </div>
        </Link>
        <button type="button" onClick={toggle} aria-pressed={saved} aria-label={t(saved ? 'academy.unsave' : 'academy.save', { title })} title={t('academy.deviceSaved')} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-cdc-surface text-cdc-ink shadow-sm hover:text-cdc-primary-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-cdc-primary"><Bookmark className={`h-4 w-4 ${saved ? 'fill-current text-cdc-primary-ink' : ''}`} /></button>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <Link href={href} className="text-cdc-ink no-underline hover:text-cdc-primary-ink"><h3 className="line-clamp-2 min-h-[2.8em] text-base font-bold leading-[1.4] tracking-tight">{title}</h3></Link>
        <div className="mt-2 min-h-[2.5rem] text-xs text-cdc-muted"><p className="truncate font-medium text-cdc-ink">{course.mentorName || t('academy.cdcTeam')}</p>{course.mentorTitle && <p className="mt-0.5 truncate">{course.mentorTitle}</p>}</div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-cdc-muted">
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{course.enrolledCount ?? 0} {t('academy.students')}</span>
          {course.averageRating != null && <span className="inline-flex items-center gap-1 font-semibold text-cdc-ink"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{course.averageRating.toFixed(1)} <span className="font-normal text-cdc-muted">({course.reviewCount ?? 0})</span></span>}
        </div>
        <div className="mt-auto pt-4">
          <div className="mb-3 flex min-h-7 items-baseline gap-2">{price.saleActive && course.discountPercent ? <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">−{course.discountPercent}%</span> : null}{price.saleActive && <s className="text-xs text-cdc-muted">{formatPrice(course.originalPrice)}</s>}<span className="ml-auto text-lg font-extrabold tracking-tight text-cdc-ink">{price.currentPrice === 0 ? t('priceFree') : formatPrice(price.currentPrice)}</span></div>
          {onEnroll ? <button type="button" onClick={() => onEnroll({ ...course, ...price })} disabled={enrolling || course.isFull} className="learning-primary w-full disabled:cursor-not-allowed disabled:opacity-60"><ShoppingCart className="h-4 w-4" />{course.isFull ? t('soldOut') : enrolling ? t('listEnrolling') : action}</button> : <Link href={href} className="learning-primary w-full no-underline">{t('viewDetails')}</Link>}
        </div>
      </div>
    </article>
  );
}

export function CourseCardSkeleton({ label }: { label: string }) {
  return <div role="status" aria-label={label} className="rounded-xl border border-cdc-border overflow-hidden bg-cdc-surface"><div className="aspect-video bg-cdc-primary-soft animate-pulse motion-reduce:animate-none" /><div className="p-4 space-y-3"><div className="h-5 w-4/5 bg-cdc-bg rounded animate-pulse" /><div className="h-4 w-1/2 bg-cdc-bg rounded" /><div className="h-10 bg-cdc-bg rounded mt-6" /></div></div>;
}
