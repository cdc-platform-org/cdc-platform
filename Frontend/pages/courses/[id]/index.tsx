/**
 * Course detail page (/courses/[id]): loads the course + syllabus, enrollment
 * state, promo codes and checkout (BOG for ka, Stripe otherwise). 2026-11
 * EDUPRO-style layout: hero media with an overlapping info card, Overview /
 * Syllabus tabs, sticky purchase card and a mobile bottom CTA — the pieces
 * live in src/components/courses/detail/.
 */
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { BookOpen, Clock, Lock, RefreshCw, X } from 'lucide-react';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import MarkdownContent from '../../../src/components/shared/MarkdownContent';
import CourseVideoPlayer from '../../../src/components/courses/CourseVideoPlayer';
import VideoTutorialLink from '../../../src/components/shared/VideoTutorialLink';
import { useEscapeToClose } from '../../../src/hooks/useEscapeToClose';
import { Course, SyllabusSection, SyllabusLesson } from '../../../src/types/lms';
import { getCourse, getProgressSummary, getSyllabus } from '../../../src/services/courseService';
import { checkoutCourse, validatePromoCode, PromoValidationResult } from '../../../src/services/paymentService';
import CoursePurchaseCard, { CourseCtaButton, CourseMobileCta } from '../../../src/components/courses/detail/CoursePurchaseCard';
import CourseSyllabus from '../../../src/components/courses/detail/CourseSyllabus';
import { checkoutCourseStripe, stripeWithBogFallback } from '../../../src/services/stripePaymentService';
import CheckoutGatewayPicker, { useCheckoutGateway } from '../../../src/components/payments/CheckoutGatewayPicker';
import { formatPrice } from '../../../src/utils/coursePricing';
import { courseLanguageBadge } from '../../../src/utils/courseLanguage';
import { useAuth } from '../../../src/context/AuthContext';
import { useAuthModal } from '../../../src/context/AuthModalContext';
import SocialShareButtons from '../../../src/components/shared/SocialShareButtons';
import GiftThisButton from '../../../src/components/giftCards/GiftThisButton';
import SuccessStoriesCarousel from '../../../src/components/shared/SuccessStoriesCarousel';
import CourseLeaderboard from '../../../src/components/shared/CourseLeaderboard';
import CourseHeroBanner from '../../../src/components/shared/CourseHeroBanner';
import VideoEmbed from '../../../src/components/shared/VideoEmbed';
import VIPAudioNarrator from '../../../src/components/ui/VIPAudioNarrator';
import SEOHead from '../../../src/components/seo/SEOHead';
import LearningRatingsSection from '../../../src/components/shared/LearningRatingsSection';
import LearningRatingSummary from '../../../src/components/shared/LearningRatingSummary';
import { localizePromoError } from '../../../src/components/shared/PromoCodeField';

function formatTotalDuration(totalSeconds: number, lang: 'ka' | 'en'): string {
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return lang === 'ka' ? `${minutes} წუთი` : `${minutes} min`;
  if (minutes === 0) return lang === 'ka' ? `${hours} სთ` : `${hours}h`;
  return lang === 'ka' ? `${hours} სთ ${minutes} წთ` : `${hours}h ${minutes}m`;
}

export default function CourseDetailPage({ initialCourse }: { initialCourse: Course | null }) {
  const router = useRouter();
  // Drives ka/en-only data (checkoutCourse's receipt language, course.language
  // badges, sale countdown, formatTotalDuration) — falls back to English for
  // de/es/fr/uk visitors rather than Georgian.
  const lang = router.locale === 'ka' ? 'ka' : 'en';
  const { gateway, setGateway, stripeEnabled } = useCheckoutGateway(lang);
  const { t } = useTranslation('courses');
  const courseId = typeof router.query.id === 'string' ? router.query.id : null;
  const { isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [course, setCourse] = useState<Course | null>(initialCourse);
  const [syllabus, setSyllabus] = useState<SyllabusSection[]>([]);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(!initialCourse);
  const [notFound, setNotFound] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewLesson, setPreviewLesson] = useState<SyllabusLesson | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoValidationResult | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'syllabus'>('overview');

  useEscapeToClose(!!previewLesson, () => setPreviewLesson(null));
  useEscapeToClose(showPaywall, () => setShowPaywall(false));

  const load = useCallback(async () => {
    if (!courseId) return;
    if (!initialCourse) setLoading(true);
    setNotFound(false);
    try {
      const [courseData, syllabusData] = await Promise.all([getCourse(courseId), getSyllabus(courseId).catch(() => [])]);
      setCourse(courseData);
      setSyllabus(syllabusData);
      if (isAuthenticated) {
        try {
          await getProgressSummary(courseId);
          setEnrolled(true);
        } catch {
          setEnrolled(false);
        }
      } else {
        setEnrolled(false);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [courseId, isAuthenticated, initialCourse]);

  useEffect(() => {
    load();
  }, [load]);

  const startCheckout = async () => {
    if (!courseId) return;
    setError(null);
    setProcessing(true);
    try {
      // Buyer-chosen gateway (CheckoutGatewayPicker): BOG/GEL or Stripe/USD.
      const result =
        gateway === 'bog'
          ? await checkoutCourse(courseId, appliedPromo?.code, lang)
          : await stripeWithBogFallback(
              () => checkoutCourseStripe(courseId, appliedPromo?.code, 'usd'),
              () => checkoutCourse(courseId, appliedPromo?.code, 'en'),
            );
      if (result.enrolled) {
        router.push(`/courses/${courseId}/learn`);
        return;
      }
      window.location.href = result.redirectUrl!;
    } catch (err: any) {
      const serverMessage = err?.response?.data?.message;
      setError(serverMessage || t('checkoutError'));
      setProcessing(false);
    }
  };

  const handleApplyPromo = async () => {
    if (!courseId || !promoInput.trim()) return;
    if (!isAuthenticated) {
      openAuthModal({ message: t('signInToEnroll') });
      return;
    }
    setPromoError(null);
    setApplyingPromo(true);
    try {
      const result = await validatePromoCode(promoInput.trim(), 'COURSE', courseId);
      setAppliedPromo(result);
    } catch (err: any) {
      setPromoError(localizePromoError(err?.response?.data?.message, lang) ?? t('promoInvalid'));
    } finally {
      setApplyingPromo(false);
    }
  };

  const handleEnroll = () => {
    if (!isAuthenticated) {
      // Guests never proceed to checkout directly — sign in first, then
      // resume straight into BOG checkout for this exact course.
      openAuthModal({ message: t('signInToEnroll'), onSuccess: startCheckout });
      return;
    }
    startCheckout();
  };

  const allLessons = syllabus.flatMap((s) => s.lessons);
  const totalLessonCount = allLessons.length;
  const totalDurationSeconds = allLessons.reduce((sum, l) => sum + l.durationSeconds, 0);
  const shell = '-mx-4 sm:-mx-6 px-4 sm:px-6 min-h-screen flex flex-col bg-cdc-bg text-cdc-ink';

  if (loading) {
    return (
      <div className={shell}>
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center text-sm text-cdc-muted">{t('loading')}</div>
        <SiteFooter />
      </div>
    );
  }
  if (notFound || !course) {
    return (
      <div className={shell}>
        <SiteHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-sm text-cdc-muted">
          <p>{t('notFound')}</p>
          <BackButton fallbackHref="/courses" className="text-cdc-muted hover:text-cdc-ink" />
        </div>
        <SiteFooter />
      </div>
    );
  }

  // What the buy button actually charges right now — a 100% discount promo
  // brings this to 0 just as much as a course that's simply free on its
  // own, so both cases get the same "activate for free" label/copy.
  const effectivePrice = appliedPromo ? appliedPromo.discountedAmount : course.currentPrice;
  const ctaProps = { course, t, enrolled, processing, effectivePrice, onEnroll: handleEnroll };
  const heroImage = course.coverImageUrl || course.thumbnailUrl;
  const description = (lang === 'en' && course.descriptionEn) || course.description;

  return (
    <div className={shell}>
      <SEOHead
        title={course.title}
        description={course.description.replace(/[#*`_>-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200)}
        ogImage={course.thumbnailUrl ?? undefined}
        ogType="product"
      />
      <SiteHeader />
      <div className="max-w-7xl mx-auto py-8 sm:py-12 pb-32 lg:pb-12 flex-1 w-full">
        <Link href="/courses" className="text-sm font-semibold text-cdc-muted hover:text-cdc-ink no-underline">
          {t('backToCourses')}
        </Link>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
          <div className="min-w-0">
            {/* Hero media + overlapping info card (EDUPRO course detail). */}
            {heroImage ? (
              course.coverImageUrl ? (
                <div className="overflow-hidden rounded-card">
                  <CourseHeroBanner src={course.coverImageUrl} alt={course.title} />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroImage} alt="" className="w-full aspect-video object-cover rounded-card" />
              )
            ) : (
              <div className="w-full aspect-[21/9] rounded-card bg-gradient-to-br from-violet-700 via-indigo-700 to-cyan-700" aria-hidden="true" />
            )}

            <div className="vip-card hover:translate-y-0 relative -mt-10 mx-3 sm:mx-6 p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="cdc-chip text-cdc-primary-ink">{course.category}</span>
                <span className="cdc-chip">{courseLanguageBadge(course.language, lang)}</span>
              </div>
              <h1 style={{ lineHeight: 1.3 }} className="blog-heading-safe mt-4 text-2xl md:text-4xl font-extrabold text-cdc-ink">{course.title}</h1>
              <LearningRatingSummary {...course} lang={lang} />
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-cdc-muted">
                {totalLessonCount > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-cdc-primary-ink" aria-hidden="true" />
                    {totalLessonCount} {t('courseLessons')}
                  </span>
                )}
                {totalDurationSeconds > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-cdc-primary-ink" aria-hidden="true" />
                    {formatTotalDuration(totalDurationSeconds, lang)}
                  </span>
                )}
                <span className="ml-auto text-xl font-extrabold text-cdc-ink">{formatPrice(course.currentPrice)}</span>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <SocialShareButtons title={course.title} lang={lang} />
                <GiftThisButton priceMinor={course.currentPrice} itemTitle={course.title} itemPath={`/courses/${course.id}`} lang={lang} />
              </div>
            </div>

            {/* About / Curriculum tabs */}
            <div className="mt-8 grid grid-cols-2 gap-1 p-1 rounded-2xl bg-cdc-surface border border-cdc-border">
              {(['overview', 'syllabus'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`py-2.5 rounded-xl text-sm font-bold border-none cursor-pointer transition-colors ${
                    activeTab === tab ? 'bg-cdc-primary text-white' : 'bg-transparent text-cdc-muted hover:text-cdc-ink'
                  }`}
                >
                  {t(tab)}
                </button>
              ))}
            </div>

            {error && <div className="mt-6 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</div>}

            <div className="mt-6">
              {activeTab === 'overview' ? (
                <>
                  <div className="mb-4">
                    <VIPAudioNarrator text={description} speechLang={lang === 'ka' ? 'ka-GE' : 'en-US'} lang={lang} stripMarkdown />
                  </div>
                  <div className="vip-card hover:translate-y-0 p-5 sm:p-7">
                    <MarkdownContent content={description} />
                  </div>
                  {course.introVideoUrl && (
                    <div className="mt-6 overflow-hidden rounded-card">
                      <VideoEmbed url={course.introVideoUrl} title={course.title} />
                    </div>
                  )}
                  {course.mentorName && (
                    <div className="mt-6">
                      <h2 className="text-lg font-bold text-cdc-ink mb-3">{t('mentor')}</h2>
                      <div className="vip-card hover:translate-y-0 p-4 flex items-center gap-4">
                        {course.mentorAvatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={course.mentorAvatarUrl} alt={course.mentorName} className="w-14 h-14 rounded-full object-cover ring-2 ring-cdc-border shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-cdc-primary text-white flex items-center justify-center text-sm font-bold shrink-0">{course.mentorName.slice(0, 2)}</div>
                        )}
                        <div className="min-w-0">
                          <p className="text-base font-bold text-cdc-ink">{course.mentorName}</p>
                          {course.mentorTitle && <p className="text-sm text-cdc-muted">{course.mentorTitle}</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <CourseSyllabus syllabus={syllabus} enrolled={enrolled} t={t} onPreview={setPreviewLesson} onLocked={() => setShowPaywall(true)} />
              )}
            </div>

            <CourseLeaderboard courseId={course.id} lang={lang} />
            <LearningRatingsSection target="courses" targetId={course.id} lang={lang} onChange={(summary) => setCourse((current) => current ? { ...current, averageRating: summary.averageRating, reviewCount: summary.reviewCount } : current)} />
          </div>

          <aside className="lg:sticky lg:top-24">
            <CoursePurchaseCard
              {...ctaProps}
              lang={lang}
              appliedPromo={appliedPromo}
              promoInput={promoInput}
              setPromoInput={setPromoInput}
              applyingPromo={applyingPromo}
              promoError={promoError}
              onApplyPromo={handleApplyPromo}
              onRemovePromo={() => { setAppliedPromo(null); setPromoInput(''); }}
              topSlot={!enrolled ? <div className="flex justify-end mb-3"><VideoTutorialLink lang={lang} /></div> : null}
              ctaSlot={!enrolled && !course.isFull && effectivePrice > 0 ? (
                <CheckoutGatewayPicker lang={lang} gateway={gateway} onChange={setGateway} stripeEnabled={stripeEnabled} disabled={processing} />
              ) : null}
            />
          </aside>
        </div>
      </div>

      {previewLesson && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreviewLesson(null)}>
          <div className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-white">{previewLesson.title}</p>
              <button type="button" onClick={() => setPreviewLesson(null)} aria-label={t('locked')} className="text-white/70 hover:text-white bg-transparent border-none cursor-pointer p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <CourseVideoPlayer embedUrl={previewLesson.embedUrl} title={previewLesson.title} />
          </div>
        </div>
      )}

      {showPaywall && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPaywall(false)}>
          <div className="max-w-md w-full vip-card hover:translate-y-0 p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <span className="mx-auto mb-3 w-14 h-14 rounded-full bg-cdc-primary-soft text-cdc-primary-ink flex items-center justify-center">
              <Lock className="w-6 h-6" aria-hidden="true" />
            </span>
            <h3 className="text-base font-bold text-cdc-ink mb-2">{t('paywallTitle')}</h3>
            <p className="text-sm text-cdc-muted mb-6">{t('paywallBody')}</p>
            <CourseCtaButton
              {...ctaProps}
              onEnroll={() => { setShowPaywall(false); handleEnroll(); }}
              className="w-full"
            />
            {!course.isFull && (
              <p className="mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400" title={t('refundGuaranteeDetail') as string}>
                <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {t('refundGuarantee')}
              </p>
            )}
          </div>
        </div>
      )}

      <SuccessStoriesCarousel lang={lang} />

      <SiteFooter />
      <CourseMobileCta {...ctaProps} />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale, params }) => {
  const courseId = typeof params?.id === 'string' ? params.id : null;
  // Fetched here (not just client-side via `load()`) so SEOHead below renders
  // real og:title/og:description/og:image in the initial server HTML —
  // social-media crawlers (Facebook/LinkedIn/Slack/WhatsApp) don't execute
  // client JS, so a client-only fetch left every share preview blank/generic.
  const initialCourse = courseId ? await getCourse(courseId).catch(() => null) : null;
  return {
    props: {
      initialCourse,
      ...(await serverSideTranslations(locale ?? 'ka', ['courses'])),
    },
  };
};
