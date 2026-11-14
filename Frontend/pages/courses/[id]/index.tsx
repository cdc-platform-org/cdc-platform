/** Course detail: trailer, responsive purchase panel, curriculum and reviews.
 * Checkout and enrollment use the existing course payment services.
 */
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { BookOpen, Clock, Lock, RefreshCw, X, Play, Users, Check } from 'lucide-react';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import MarkdownContent from '../../../src/components/shared/MarkdownContent';
import CourseVideoPlayer from '../../../src/components/courses/CourseVideoPlayer';
import { useEscapeToClose } from '../../../src/hooks/useEscapeToClose';
import { Course, SyllabusSection, SyllabusLesson } from '../../../src/types/lms';
import { getCourse, getProgressSummary, getSyllabus } from '../../../src/services/courseService';
import { checkoutCourse, validatePromoCode, PromoValidationResult } from '../../../src/services/paymentService';
import CoursePurchaseCard, { CourseCtaButton } from '../../../src/components/courses/detail/CoursePurchaseCard';
import CourseSyllabus from '../../../src/components/courses/detail/CourseSyllabus';
import { checkoutCourseStripe, stripeWithBogFallback } from '../../../src/services/stripePaymentService';
import CheckoutGatewayPicker, { useCheckoutGateway } from '../../../src/components/payments/CheckoutGatewayPicker';
import { courseLanguageBadge } from '../../../src/utils/courseLanguage';
import { useAuth } from '../../../src/context/AuthContext';
import { useAuthModal } from '../../../src/context/AuthModalContext';
import { parseVideoUrl } from '../../../src/components/shared/VideoEmbed';
import CoursePreviewPlayer from '../../../src/components/courses/CoursePreviewPlayer';
import CourseDetailTabs, { type DetailTab } from '../../../src/components/courses/detail/CourseDetailTabs';
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
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [playingTrailer, setPlayingTrailer] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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
  const shell = 'learning-surface -mx-4 sm:-mx-6 px-4 sm:px-6 min-h-screen flex flex-col bg-cdc-bg text-cdc-ink';

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
  // The API owns course sale eligibility; also expire a sale while this page stays open.
  const saleActive = course.saleActive && (!course.discountEndDate || now === null || new Date(course.discountEndDate).getTime() > now);
  const pricedCourse = { ...course, saleActive, currentPrice: saleActive ? course.currentPrice : course.originalPrice };
  const effectivePrice = appliedPromo ? Math.min(appliedPromo.discountedAmount, pricedCourse.currentPrice) : pricedCourse.currentPrice;
  const ctaProps = { course: pricedCourse, t, enrolled, processing, effectivePrice, now, onEnroll: handleEnroll };
  const isNew = now !== null && now >= new Date(course.createdAt).getTime() && now - new Date(course.createdAt).getTime() < 30 * 86400000;
  const heroImage = course.coverImageUrl || course.thumbnailUrl;
  const title = (lang === 'en' && course.titleEn) || course.title;
  const description = (lang === 'en' && course.descriptionEn) || course.description;

  return (
    <div className={shell}>
      <SEOHead
        title={title}
        description={course.description.replace(/[#*`_>-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200)}
        ogImage={course.thumbnailUrl ?? undefined}
        ogType="product"
      />
      <SiteHeader />
      <div className="max-w-7xl mx-auto py-8 sm:py-12 pb-40 lg:pb-28 flex-1 w-full">
        <Link href="/courses" className="text-sm font-semibold text-cdc-muted hover:text-cdc-ink no-underline">
          {t('backToCourses')}
        </Link>

        <div id="course" className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,65fr)_minmax(300px,35fr)] gap-8 xl:gap-12 items-start scroll-mt-28">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <div id="trailer" className="relative aspect-video overflow-hidden rounded-xl bg-cdc-surface border border-cdc-border scroll-mt-28">
              {playingTrailer && course.introVideoUrl && parseVideoUrl(course.introVideoUrl) ? <CoursePreviewPlayer url={course.introVideoUrl} title={title} /> : <>
                {heroImage && <img src={heroImage} alt={title} className="absolute inset-0 h-full w-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                {course.introVideoUrl && parseVideoUrl(course.introVideoUrl) ? <button type="button" onClick={() => setPlayingTrailer(true)} aria-label={t('detailPage.watchTrailer')} className="absolute inset-0 group flex flex-col gap-4 items-center justify-center text-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-cdc-primary focus-visible:-outline-offset-4">
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-cdc-primary shadow-xl transition-transform group-hover:scale-110"><Play className="h-8 w-8 fill-current ml-1" /></span>
                  <span className="text-sm font-bold">{t('detailPage.watchTrailer')}</span>
                </button> : <p className="absolute bottom-6 left-6 text-white text-sm">{t('detailPage.trailerUnavailable')}</p>}
              </>}
            </div>
            <div className="pt-7">
              <div className="flex flex-wrap gap-2"><span className="cdc-chip text-cdc-primary-ink">{course.category}</span><span className="cdc-chip">{courseLanguageBadge(course.language, lang)}</span></div>

            </div>
          </div>
          <aside className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-24 min-w-0">
            <CoursePurchaseCard {...ctaProps} lang={lang} appliedPromo={appliedPromo} promoInput={promoInput} setPromoInput={setPromoInput} applyingPromo={applyingPromo} promoError={promoError} onApplyPromo={handleApplyPromo} onRemovePromo={() => { setAppliedPromo(null); setPromoInput(''); }}
              topSlot={<div className="mb-6"><span className="inline-flex rounded bg-cdc-primary-soft text-cdc-primary-ink px-2 py-1 text-[10px] font-bold">{t(isNew ? 'detailPage.new' : 'detailPage.courseAccess')}</span><h1 className="blog-heading-safe mt-3 text-2xl xl:text-3xl font-extrabold leading-tight">{title}</h1><LearningRatingSummary {...course} lang={lang} /><p className="mt-3 text-sm text-cdc-muted">{course.mentorName}<span className="block mt-1 text-xs">{course.mentorTitle}</span></p><p className="mt-3 inline-flex gap-2 text-xs text-cdc-muted"><Users className="h-3.5 w-3.5" />{t('detailPage.students', { count: course.enrolledCount })}</p></div>}
              ctaSlot={!enrolled && !course.isFull && effectivePrice > 0 ? <CheckoutGatewayPicker lang={lang} gateway={gateway} onChange={setGateway} stripeEnabled={stripeEnabled} disabled={processing} /> : null}
              bottomSlot={<><dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-cdc-border pt-5 text-xs">{[[t('academy.duration'), formatTotalDuration(totalDurationSeconds, lang)], [t('academy.lessons'), String(totalLessonCount)], [t('academy.language'), courseLanguageBadge(course.language, lang)], [t('academy.level'), t('academy.levelUnknown')]].map(([label, value]) => <div key={label}><dt className="text-cdc-muted">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>)}</dl><div className="mt-6 rounded-lg border border-cdc-primary/30 p-5"><p className="text-base font-extrabold text-cdc-primary-ink">{t('detailPage.subscription')}</p><p className="mt-2 text-xs text-cdc-muted">{t('academy.subscriptionNote')}</p><Link href="/contact?subject=course-subscription" className="mt-4 flex justify-center rounded-md border border-cdc-primary px-5 py-3 text-sm font-bold text-cdc-primary-ink no-underline">{t('detailPage.subscribe')}</Link></div></>}

            />
          </aside>
          <div className="min-w-0 space-y-10 lg:col-start-1 lg:row-start-2">
            {error && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-red-600 dark:text-red-300">{error}</p>}
            <CourseDetailTabs value={detailTab} onChange={setDetailTab} />
            <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" hidden={detailTab !== 'overview'} className="space-y-10">
            <section id="details" className="scroll-mt-28 border-t border-cdc-border pt-8">
              <h2 className="text-2xl font-extrabold mb-5">{t('detailPage.learn')}</h2>
              {course.skillsTaught?.length > 0 && <ul className="grid sm:grid-cols-2 gap-4 mb-6">{course.skillsTaught.map(skill => <li key={skill} className="flex gap-3"><Check className="h-5 w-5 shrink-0 text-cdc-primary-ink" />{skill}</li>)}</ul>}
              <MarkdownContent content={description} />
              <div className="mt-6 flex flex-wrap gap-5 text-sm text-cdc-muted"><span className="inline-flex gap-2 items-center"><BookOpen className="h-4 w-4" />{totalLessonCount} {t('courseLessons')}</span><span className="inline-flex gap-2 items-center"><Clock className="h-4 w-4" />{formatTotalDuration(totalDurationSeconds, lang)}</span></div>
            </section>

            <section id="instructor" className="scroll-mt-28 border-t border-cdc-border pt-8"><h2 className="text-2xl font-extrabold mb-5">{t('mentor')}</h2>
              {course.mentorName ? <div className="flex items-center gap-5 rounded-xl bg-cdc-surface border border-cdc-border p-6">{course.mentorAvatarUrl && <img src={course.mentorAvatarUrl} alt={course.mentorName} className="h-24 w-24 rounded-2xl object-cover" />}<div><h3 className="text-xl font-bold">{course.mentorName}</h3><p className="mt-2 text-cdc-muted">{course.mentorTitle || t('mentor')}</p></div></div> : <p className="text-cdc-muted">{t('detailPage.instructorSoon')}</p>}
            </section>

            <section className="border-t border-cdc-border pt-8"><h2 className="text-2xl font-extrabold mb-5">{t('detailPage.faq')}</h2>{['access', 'preview', 'payment'].map(key => <details key={key} className="border-b border-cdc-border py-5"><summary className="cursor-pointer font-bold">{t(`detailPage.faqItems.${key}.question`)}</summary><p className="pt-3 text-sm leading-relaxed text-cdc-muted">{t(`detailPage.faqItems.${key}.answer`)}</p></details>)}</section>
            </div>
            <div id="panel-curriculum" role="tabpanel" aria-labelledby="tab-curriculum" hidden={detailTab !== 'curriculum'}>            <section id="lessons" className="scroll-mt-28 border-t border-cdc-border pt-8"><h2 className="text-2xl font-extrabold mb-5">{t('syllabus')}</h2><CourseSyllabus syllabus={syllabus} enrolled={enrolled} t={t} onPreview={setPreviewLesson} onLocked={() => setShowPaywall(true)} /></section></div>
            <div id="panel-projects" role="tabpanel" aria-labelledby="tab-projects" hidden={detailTab !== 'projects'} className="rounded-xl border border-dashed border-cdc-border p-8 text-center"><h2 className="text-xl font-bold">{t('academy.projects')}</h2><p className="mt-3 text-sm text-cdc-muted">{t('academy.projectsEmpty')}</p></div>
            <div id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews" hidden={detailTab !== 'reviews'}>            <section className="border-t border-cdc-border pt-8"><h2 className="text-2xl font-extrabold mb-5">{t('detailPage.reviews')}</h2><LearningRatingsSection target="courses" targetId={course.id} lang={lang} onChange={(summary) => setCourse(current => current ? { ...current, ...summary } : current)} /></section></div>
          </div>
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



      <SiteFooter />
      <nav aria-label={t('detailPage.navigation')} className="fixed inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[min(760px,calc(100%-24px))] z-40 rounded-xl border border-white/10 bg-neutral-900/95 text-white backdrop-blur-xl shadow-xl" style={{ bottom: 'calc(var(--tabbar-h, 0px) + 12px)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 sm:gap-6">
          <div className="flex-1 min-w-0 flex items-center gap-5 overflow-x-auto whitespace-nowrap text-xs sm:text-sm font-bold">{['course', 'trailer', 'details', 'lessons', 'instructor'].map(id => <a key={id} href={`#${id}`} onClick={() => setDetailTab(id === 'lessons' ? 'curriculum' : 'overview')} className="py-2 text-white/70 hover:text-white no-underline">{t(`detailPage.nav.${id}`)}</a>)}</div>
          <CourseCtaButton {...ctaProps} showPrice className="shrink-0 text-xs sm:text-sm" />
        </div>
      </nav>
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
