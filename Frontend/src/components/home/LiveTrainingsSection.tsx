/**
 * Homepage live trainings & workshops (hidden when none are scheduled).
 */
import Link from 'next/link';
import { Calendar, Clock, Users } from 'lucide-react';
import LearningRatingSummary from '../shared/LearningRatingSummary';
import { formatPrice } from '../../utils/coursePricing';
import { LiveTraining } from '../../types/liveTraining';
import type { TFunction } from 'i18next';

interface LiveTrainingsSectionProps {
  liveTrainingsLoading: boolean;
  liveTrainings: LiveTraining[];
  t: TFunction<"home", undefined>;
  darkMode: boolean;
  contentLang: "ka" | "en";
}

export default function LiveTrainingsSection({ liveTrainingsLoading, liveTrainings, t, darkMode, contentLang }: LiveTrainingsSectionProps) {
  return (
    <>
      {/* 🎤 LIVE TRAININGS & WORKSHOPS — scheduled one-off sessions, separate
          from the self-paced Courses catalog above (see LiveTraining's own
          schema comment: a lead-capture callback flow, not a purchase). Only
          rendered once there's at least one published session, same
          "don't show an empty section" posture as the gallery preview above. */}
      {!liveTrainingsLoading && liveTrainings.length > 0 && (
        <section className="max-w-7xl mx-auto py-16 sm:py-28 px-0 sm:px-6">
          <h2 className="section-title text-center mb-6 text-2xl md:text-[2.15rem] font-black tracking-wide">{t('liveTrainingsHeading')}</h2>
          <p className="text-center mb-8 sm:mb-16 text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">{t('liveTrainingsSubtitle')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
            {liveTrainings.slice(0, 3).map((tr) => (
              <Link
                key={tr.id}
                href={`/live-trainings/${tr.id}`}
                className={`rounded-3xl border overflow-hidden flex flex-col transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] no-underline text-current ${darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200/80'}`}
              >
                <div className="relative w-full aspect-video overflow-hidden bg-slate-900">
                  {tr.saleActive && (
                    <span className="absolute top-3 right-3 z-10 text-xs font-black text-white px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 shadow-lg shadow-rose-500/30">
                      {tr.discountBadgeText || `-${tr.discountPercent}%`}
                    </span>
                  )}
                  {tr.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tr.thumbnailUrl} alt="" className="w-full h-full object-cover object-center" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                      <Calendar className="w-8 h-8 text-cyan-500/40" />
                    </div>
                  )}
                </div>
                <div className="p-5 sm:p-8 flex-1 flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-cyan-400 bg-cyan-500/10 border-cyan-500/20 self-start mb-4">
                    {tr.category}
                  </span>
                  <h3 className="text-lg font-black mb-2 hover:text-cyan-500 transition-colors line-clamp-2">
                    {(contentLang === 'en' && tr.titleEn) || tr.title}
                  </h3>
                  <LearningRatingSummary {...tr} lang={contentLang} />
                  <p className="text-xs md:text-sm text-slate-400 leading-relaxed font-medium mb-6 line-clamp-2 flex-1">
                    {(contentLang === 'en' && tr.descriptionEn) || tr.description}
                  </p>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {new Date(tr.scheduledAt).toLocaleString()}
                    </div>
                    <span className="text-xs font-black text-cyan-500">
                      {tr.saleActive && tr.currentPrice != null ? (
                        <>
                          <s className="text-slate-500 font-normal mr-1">{formatPrice(tr.price!)}</s>
                          <span className="text-rose-400">{formatPrice(tr.currentPrice)}</span>
                        </>
                      ) : tr.price ? (
                        formatPrice(tr.price)
                      ) : (
                        t('liveTrainingsFree')
                      )}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-bold ${tr.isFull ? 'text-red-500' : 'text-cyan-500'}`}>
                    <Users className="w-3 h-3" />
                    {tr.isFull ? t('liveTrainingsFull') : t('liveTrainingsSeatsRemaining', { count: tr.seatsRemaining, total: tr.maxCapacity })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/live-trainings"
              className="inline-flex items-center gap-2 border font-black text-sm px-6 py-3 rounded-xl transition no-underline border-cyan-500/40 text-cyan-500 hover:bg-cyan-500/10"
            >
              {t('liveTrainingsViewAll')} →
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
