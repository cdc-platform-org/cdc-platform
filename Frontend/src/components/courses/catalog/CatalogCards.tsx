/**
 * Result cards for the /courses catalog (course, live training, AI teacher).
 * 2026-11 redesign: EDUPRO-style cards — inset rounded media with a type
 * badge, chips, title + rating, short text, mentor row, price and actions —
 * all on cdc-* tokens so dark mode needs no extra classes. Data loading,
 * filtering and checkout stay in pages/courses/index.tsx.
 */
import Link from 'next/link';
import { Calendar, Clock, PlayCircle, Users } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { ComponentType, KeyboardEvent } from 'react';
import { Course } from '../../../types/lms';
import { LiveTraining } from '../../../types/liveTraining';
import { formatPrice, getSaleCountdownLabel } from '../../../utils/coursePricing';
import { courseLanguageBadge } from '../../../utils/courseLanguage';
import LearningRatingSummary from '../../shared/LearningRatingSummary';

type T = TFunction<'courses', undefined>;
type Lang = 'ka' | 'en';

const cardClass = 'vip-card h-full p-4 sm:p-5 flex flex-col';
const mediaClass = 'relative block w-full aspect-video overflow-hidden rounded-xl bg-cdc-primary-soft no-underline';
const typeBadge = 'absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-lg text-white shadow';

function MentorRow({ name, title, avatarUrl }: { name: string; title: string | null; avatarUrl: string | null }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="w-9 h-9 rounded-full object-cover ring-2 ring-cdc-border shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-cdc-primary text-white flex items-center justify-center text-xs font-bold shrink-0">{name.slice(0, 2)}</div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-cdc-ink truncate">{name}</p>
        {title && <p className="text-xs text-cdc-muted truncate">{title}</p>}
      </div>
    </div>
  );
}

export function CatalogCourseCard({ course, lang, t, enrolling, onEnroll }: { course: Course; lang: Lang; t: T; enrolling: boolean; onEnroll: (c: Course) => void }) {
  const countdown = course.saleActive ? getSaleCountdownLabel(course.discountEndDate, lang) : null;
  const href = `/courses/${course.id}`;
  return (
    <div className={cardClass}>
      <Link href={href} className={mediaClass}>
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.thumbnailUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-cdc-primary-ink">
            <PlayCircle className="w-10 h-10" aria-hidden="true" />
          </span>
        )}
        <span className={`${typeBadge} bg-cdc-primary`}>{t('badgeVideoCourse')}</span>
        {course.saleActive && (
          <span className="absolute top-3 right-3 text-xs font-bold text-white px-2.5 py-1 rounded-lg bg-rose-600">
            {course.discountBadgeText || `-${course.discountPercent}% ${t('saleOffSuffix')}`}
          </span>
        )}
      </Link>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="cdc-chip">{course.category}</span>
        <span className="cdc-chip">{courseLanguageBadge(course.language, lang)}</span>
      </div>
      <Link href={href} className="block no-underline text-current mt-3">
        <h3 className="text-lg font-bold text-cdc-ink hover:text-cdc-primary-ink transition-colors">{course.title}</h3>
        <LearningRatingSummary {...course} lang={lang} />
      </Link>
      <p className="mt-2 text-sm leading-relaxed text-cdc-muted line-clamp-3">{course.description}</p>
      {course.mentorName && <MentorRow name={course.mentorName} title={course.mentorTitle} avatarUrl={course.mentorAvatarUrl} />}

      <div className="mt-auto pt-5">
        {countdown && (
          <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            {countdown}
          </p>
        )}
        <div className="flex items-baseline gap-2 mb-4">
          {course.saleActive && <s className="text-sm text-cdc-muted">{formatPrice(course.originalPrice)}</s>}
          <span className="text-xl font-extrabold text-cdc-ink">{formatPrice(course.currentPrice)}</span>
        </div>
        <div className="flex gap-2">
          <Link href={href} className="vip-btn-secondary flex-1 whitespace-nowrap no-underline">
            {t('viewDetails')}
          </Link>
          <button type="button" onClick={() => onEnroll(course)} disabled={enrolling} className="vip-btn-primary flex-1 whitespace-nowrap cursor-pointer disabled:opacity-60">
            {enrolling ? t('listEnrolling') : t('enroll')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CatalogLiveTrainingCard({ training: tr, lang, t }: { training: LiveTraining; lang: Lang; t: T }) {
  const href = `/live-trainings/${tr.id}`;
  const seatsLabel = tr.seatsRemaining === 1 ? t('liveTrainingSeatsLeft', { count: tr.seatsRemaining }) : t('liveTrainingSeatsLeftPlural', { count: tr.seatsRemaining });
  const price = tr.currentPrice ?? tr.price;
  return (
    <div className={cardClass}>
      <Link href={href} className={mediaClass}>
        {tr.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tr.thumbnailUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-cdc-primary-ink">
            <Calendar className="w-10 h-10" aria-hidden="true" />
          </span>
        )}
        <span className={`${typeBadge} bg-rose-600`}>{t('badgeLiveTraining')}</span>
      </Link>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="cdc-chip">{tr.category}</span>
        <span className="cdc-chip">{courseLanguageBadge(tr.language, lang)}</span>
      </div>
      <Link href={href} className="block no-underline text-current mt-3">
        <h3 className="text-lg font-bold text-cdc-ink hover:text-cdc-primary-ink transition-colors">{tr.title}</h3>
        <LearningRatingSummary {...tr} lang={lang} />
      </Link>
      <p className="mt-2 text-sm leading-relaxed text-cdc-muted line-clamp-3">{tr.description}</p>
      <p className="mt-4 flex items-center gap-1.5 text-sm text-cdc-muted">
        <Calendar className="w-4 h-4 text-cdc-primary-ink" aria-hidden="true" />
        {new Date(tr.scheduledAt).toLocaleString(lang === 'ka' ? 'ka-GE' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
      </p>

      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-cdc-muted">
            <Users className="w-3.5 h-3.5" aria-hidden="true" />
            {tr.isFull ? t('liveTrainingFull') : seatsLabel}
          </span>
          <span className="text-xl font-extrabold text-cdc-ink whitespace-nowrap">
            {tr.saleActive && <s className="text-sm font-normal text-cdc-muted mr-2">{formatPrice(tr.price ?? 0)}</s>}
            {price ? formatPrice(price) : t('priceFree')}
          </span>
        </div>
        <Link href={href} className="vip-btn-primary w-full no-underline">
          {t('viewDetails')}
        </Link>
      </div>
    </div>
  );
}

export function CatalogAiTeacherCard({
  title, desc, badge, imageUrl, icon: Icon, t, onOpen,
}: {
  title: string; desc: string; badge: string; imageUrl: string | null; icon: ComponentType<{ className?: string }>; t: T; onOpen: () => void;
}) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={onKeyDown} className={`${cardClass} group cursor-pointer`}>
      <div className={mediaClass}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-700 via-indigo-700 to-cyan-700">
            <Icon className="w-10 h-10 text-white" />
          </span>
        )}
        <span className={`${typeBadge} bg-cdc-accent`}>{t('tabAiTeachers')}</span>
      </div>
      <span className="cdc-chip self-start mt-4">{badge}</span>
      <h3 className="mt-3 text-lg font-bold text-cdc-ink group-hover:text-cdc-primary-ink transition-colors">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-cdc-muted line-clamp-3">{desc}</p>
      <div className="mt-auto pt-5 flex items-center justify-between gap-2">
        <span className="text-xl font-extrabold text-cdc-ink">{t('priceFree')}</span>
        <span className="vip-btn-primary">{t('aiTeachersLaunchCta')}</span>
      </div>
    </div>
  );
}
