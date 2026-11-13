/**
 * Homepage course catalog (#courses) with pricing, sale countdowns and enroll buttons.
 */
import Link from 'next/link';
import { Bot, Clock, Sparkles } from 'lucide-react';
import { formatPrice, getSaleCountdownLabel } from '../../utils/coursePricing';
import LearningRatingSummary from '../shared/LearningRatingSummary';
import { Course } from '../../types/lms';
import type { TFunction } from 'i18next';

interface CoursesSectionProps {
  t: TFunction<"home", undefined>;
  darkMode: boolean;
  coursesLoading: boolean;
  courses: Course[];
  contentLang: "ka" | "en";
  handleEnroll: (course: Course) => void;
  enrollingId: string | null;
}

export default function CoursesSection({ t, darkMode, coursesLoading, courses, contentLang, handleEnroll, enrollingId }: CoursesSectionProps) {
  return (
    <>
      {/* 📚 COURSES CATALOG */}
      <section id="courses" className="max-w-7xl mx-auto py-16 sm:py-28 px-0 sm:px-6">
        <h2 className="section-title text-center mb-10 sm:mb-16 text-2xl md:text-[2.15rem] font-black tracking-wide">{t('coursesHeading')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
          {/* IMIAKO — the AI English Tutor is its own always-on product, not
              a row from the `courses` API, so it's hand-placed as the first
              grid cell (== top of the grid, first grid child, no CSS
              reordering needed) rather than living inside courses.map below.
              Rendered unconditionally, independent of coursesLoading/
              courses.length, so it's never hidden behind the loading state
              and is still the one course-like card shown when the real
              catalog is empty. */}
          <Link
            href="/dashboard/english-tutor"
            className={`relative overflow-hidden rounded-3xl p-5 sm:p-8 flex flex-col justify-between no-underline text-current transition-all duration-300 transform hover:scale-[1.02] border-2 border-transparent bg-origin-border shadow-[0_0_30px_rgba(168,85,247,0.25)] hover:shadow-[0_0_40px_rgba(168,85,247,0.4)] ${darkMode ? 'bg-[#0e1422]' : 'bg-white'}`}
            style={{
              backgroundImage: `linear-gradient(${darkMode ? '#0e1422' : '#ffffff'}, ${darkMode ? '#0e1422' : '#ffffff'}), linear-gradient(135deg, #fbbf24, #a855f7, #06b6d4)`,
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
            }}
          >
            <span className="absolute top-3 right-3 z-10 text-[10px] font-black uppercase tracking-widest text-white px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 shadow-lg shadow-purple-500/30">
              {t('imiakoBadgeFreeTrial')}
            </span>
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-purple-400 bg-purple-500/10 border-purple-500/20">
                <Bot className="w-3 h-3" />
                {t('imiakoBadgeAiCourse')}
              </span>
              <h3 className="text-lg font-black mt-5 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                {t('imiakoCardTitle')}
              </h3>
              <ul className="text-xs md:text-sm text-slate-400 leading-relaxed font-medium mb-6 space-y-2 list-none pl-0">
                <li className="flex gap-2">
                  <span className="text-cyan-400 shrink-0">✓</span>
                  {t('imiakoFeature1')}
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-400 shrink-0">✓</span>
                  {t('imiakoFeature2')}
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-400 shrink-0">✓</span>
                  {t('imiakoFeature3')}
                </li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-black mb-4 bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 bg-clip-text text-transparent">
                {t('imiakoPricing')}
              </p>
              <span className="block text-center py-3.5 bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 text-white rounded-xl font-black text-xs shadow-md">
                {t('imiakoCta')}
              </span>
            </div>
          </Link>

          {coursesLoading ? (
            <p className="col-span-full text-center text-slate-400 text-sm">{t('coursesLoading')}</p>
          ) : courses.length === 0 ? (
            <p className="col-span-full text-center text-slate-400 text-sm">{t('coursesEmpty')}</p>
          ) : (
            courses.map((course) => {
              const countdown = course.saleActive ? getSaleCountdownLabel(course.discountEndDate, contentLang) : null;
              return (
                <div
                  key={course.id}
                  className={`relative overflow-hidden border rounded-3xl p-5 sm:p-8 flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200/80'}`}
                >
                  {course.saleActive && (
                    <span className="absolute top-3 right-3 z-10 text-xs font-black text-white px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 shadow-lg shadow-rose-500/30">
                      {course.discountBadgeText || `-${course.discountPercent}%`}
                    </span>
                  )}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-purple-400 bg-purple-500/10 border-purple-500/20">
                      {course.category}
                    </span>
                    <Link href={`/courses/${course.id}`} className="block no-underline text-current">
                      <h3 className="text-lg font-black mt-5 mb-3 hover:text-cyan-500 transition-colors">{course.title}</h3>
                      <LearningRatingSummary {...course} lang={contentLang} />
                    </Link>
                    <p className="text-xs md:text-sm text-slate-400 leading-relaxed font-medium mb-6 line-clamp-3">{course.description}</p>

                    {course.mentorName && (
                      <div className={`p-4 rounded-2xl border flex items-center space-x-4 mb-6 ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                        {course.mentorAvatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={course.mentorAvatarUrl}
                            alt={course.mentorName}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white text-sm font-black shrink-0">
                            {course.mentorName.slice(0, 2)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">{course.mentorName}</h4>
                          {course.mentorTitle && <p className="text-xs text-slate-400 font-bold truncate">{course.mentorTitle}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    {countdown && (
                      <p className="text-[11px] font-bold text-rose-400 mb-3 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {countdown}
                      </p>
                    )}
                    <div className="flex items-baseline gap-2 mb-4">
                      {course.saleActive && <s className="text-sm text-slate-500">{formatPrice(course.originalPrice)}</s>}
                      <span className="text-xl font-black">{formatPrice(course.currentPrice)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/courses/${course.id}`}
                        className={`flex-1 text-center py-3.5 rounded-xl font-black text-xs no-underline transition-colors ${darkMode ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}
                      >
                        {t('viewDetails')}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleEnroll(course)}
                        disabled={enrollingId === course.id}
                        className="flex-1 text-center py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-black text-xs cursor-pointer border-none shadow-md duration-150 hover:shadow-lg disabled:opacity-60"
                      >
                        {enrollingId === course.id ? t('enrolling') : t('enroll')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
