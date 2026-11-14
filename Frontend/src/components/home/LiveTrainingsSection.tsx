/**
 * Homepage live trainings & workshops (hidden when none are scheduled).
 * 2026-11 redesign: same card language as CoursesSection, cdc-* tokens.
 */
import Link from 'next/link';
import { Calendar, Clock, Users } from 'lucide-react';
import LearningRatingSummary from '../shared/LearningRatingSummary';
import SectionHeader from './SectionHeader';
import { formatPrice } from '../../utils/coursePricing';
import { LiveTraining } from '../../types/liveTraining';
import type { TFunction } from 'i18next';

interface LiveTrainingsSectionProps {
  liveTrainingsLoading: boolean;
  liveTrainings: LiveTraining[];
  t: TFunction<"home", undefined>;
  // Kept for the existing call site; styling is token-based now.
  darkMode?: boolean;
  contentLang: "ka" | "en";
}

const stripArrow = (label: string) => label.replace(/\s*→\s*$/, '');

export default function LiveTrainingsSection({ liveTrainingsLoading, liveTrainings, t, contentLang }: LiveTrainingsSectionProps) {
  // Scheduled one-off sessions (a lead-capture callback flow, not a
  // purchase). Only rendered once at least one session is published.
  if (liveTrainingsLoading || liveTrainings.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto pb-16 sm:pb-24">
      <SectionHeader
        title={t('liveTrainingsHeading')}
        subtitle={t('liveTrainingsSubtitle')}
        action={{ href: '/live-trainings', label: stripArrow(t('liveTrainingsViewAll')) }}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {liveTrainings.slice(0, 3).map((tr) => (
          <Link key={tr.id} href={`/live-trainings/${tr.id}`} className="vip-card p-4 sm:p-5 flex flex-col no-underline text-current">
            <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-cdc-primary-soft">
              {tr.saleActive && (
                <span className="absolute top-3 right-3 z-10 text-xs font-bold text-white px-2.5 py-1 rounded-lg bg-rose-600">
                  {tr.discountBadgeText || `-${tr.discountPercent}%`}
                </span>
              )}
              {tr.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tr.thumbnailUrl} alt="" loading="lazy" className="w-full h-full object-cover object-center" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-cdc-primary-ink">
                  <Calendar className="w-9 h-9" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="cdc-chip">{tr.category}</span>
              <span className="cdc-chip">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {new Date(tr.scheduledAt).toLocaleString()}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-bold text-cdc-ink line-clamp-2">{(contentLang === 'en' && tr.titleEn) || tr.title}</h3>
            <LearningRatingSummary {...tr} lang={contentLang} />
            <p className="mt-2 text-sm leading-relaxed text-cdc-muted line-clamp-2 flex-1">{(contentLang === 'en' && tr.descriptionEn) || tr.description}</p>
            <div className="mt-4 pt-4 border-t border-cdc-border flex items-center justify-between gap-2">
              <span className={`flex items-center gap-1.5 text-xs font-bold ${tr.isFull ? 'text-red-600 dark:text-red-400' : 'text-cdc-muted'}`}>
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                {tr.isFull ? t('liveTrainingsFull') : t('liveTrainingsSeatsRemaining', { count: tr.seatsRemaining, total: tr.maxCapacity })}
              </span>
              <span className="text-base font-extrabold text-cdc-ink">
                {tr.saleActive && tr.currentPrice != null ? (
                  <>
                    <s className="text-cdc-muted font-normal text-sm mr-1">{formatPrice(tr.price!)}</s>
                    {formatPrice(tr.currentPrice)}
                  </>
                ) : tr.price ? (
                  formatPrice(tr.price)
                ) : (
                  t('liveTrainingsFree')
                )}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
