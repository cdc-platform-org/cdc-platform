import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { useAuth } from '../../../src/context/AuthContext';
import { useAuthModal } from '../../../src/context/AuthModalContext';
import { Course } from '../../../src/types/lms';
import { getCourse, getProgressSummary } from '../../../src/services/courseService';
import { checkoutCourse } from '../../../src/services/paymentService';
import { formatPrice, getSaleCountdownLabel } from '../../../src/utils/coursePricing';

const dict = {
  ka: {
    loading: 'იტვირთება…',
    notFound: 'კურსი ვერ მოიძებნა.',
    enroll: 'ჩარიცხვა →',
    enrolling: 'გადამისამართება…',
    continueLearning: 'სწავლის გაგრძელება →',
    backToCourses: '← ყველა კურსი',
    mentor: 'ლექტორი',
    signInToEnroll: { ka: 'გთხოვთ გაიაროთ ავტორიზაცია კურსზე ჩასარიცხად', en: 'Please sign in to enroll in a course' },
  },
  en: {
    loading: 'Loading…',
    notFound: 'Course not found.',
    enroll: 'Enroll Now →',
    enrolling: 'Redirecting…',
    continueLearning: 'Continue Learning →',
    backToCourses: '← All Courses',
    mentor: 'Instructor',
    signInToEnroll: { ka: 'გთხოვთ გაიაროთ ავტორიზაცია კურსზე ჩასარიცხად', en: 'Please sign in to enroll in a course' },
  },
};

export default function CourseDetailPage() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const courseId = typeof router.query.id === 'string' ? router.query.id : null;
  const { isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [course, setCourse] = useState<Course | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const courseData = await getCourse(courseId);
      setCourse(courseData);
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
  }, [courseId, isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  const startCheckout = async () => {
    if (!courseId) return;
    setError(null);
    setProcessing(true);
    try {
      const { redirectUrl } = await checkoutCourse(courseId);
      window.location.href = redirectUrl;
    } catch {
      setError(lang === 'en' ? 'Unable to start checkout. Please try again.' : 'გადახდის დაწყება ვერ მოხერხდა.');
      setProcessing(false);
    }
  };

  const handleEnroll = () => {
    if (!isAuthenticated) {
      // Guests never proceed to checkout directly — sign in first, then
      // resume straight into BOG checkout for this exact course.
      openAuthModal({ message: t.signInToEnroll, onSuccess: startCheckout });
      return;
    }
    startCheckout();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">{t.loading}</div>;
  }
  if (notFound || !course) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300 text-sm">{t.notFound}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
      <Head>
        <title>{course.title} | CDC</title>
      </Head>
      <div className="max-w-3xl mx-auto">
        <Link href="/courses" className="text-sm text-slate-400 hover:text-white no-underline">
          {t.backToCourses}
        </Link>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-purple-300 bg-purple-500/10 border-purple-500/20">
              {course.category}
            </span>
            {course.saleActive && (
              <span className="text-[10px] font-black text-white px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500">
                -{course.discountPercent}% {lang === 'ka' ? '' : 'OFF'}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            {course.saleActive && <s className="text-sm text-slate-500">{formatPrice(course.originalPrice)}</s>}
            <span className="text-lg font-black text-cyan-300">{formatPrice(course.currentPrice)}</span>
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-black mt-4 mb-4">{course.title}</h1>
        <p className="text-slate-300 leading-relaxed mb-8">{course.description}</p>

        {course.mentorName && (
          <div className="flex items-center gap-4 mb-8 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white text-sm font-black shrink-0">
              {course.mentorName.slice(0, 2)}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">{t.mentor}</p>
              <p className="text-sm font-bold text-white">{course.mentorName}</p>
              {course.mentorTitle && <p className="text-xs text-slate-400">{course.mentorTitle}</p>}
            </div>
          </div>
        )}

        {error && <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">{error}</div>}

        {course.saleActive && getSaleCountdownLabel(course.discountEndDate, lang) && (
          <p className="text-xs font-bold text-rose-400 mb-3">⏳ {getSaleCountdownLabel(course.discountEndDate, lang)}</p>
        )}
        <div className="flex items-center justify-between p-6 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-baseline gap-3">
            {course.saleActive && <s className="text-lg text-slate-500">{formatPrice(course.originalPrice)}</s>}
            <span className="text-3xl font-black text-white">{formatPrice(course.currentPrice)}</span>
          </div>
          {enrolled ? (
            <Link
              href={`/courses/${course.id}/learn`}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black px-6 py-3.5 rounded-xl text-sm uppercase tracking-widest no-underline shadow-lg hover:shadow-xl transition-all"
            >
              {t.continueLearning}
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleEnroll}
              disabled={processing}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black px-6 py-3.5 rounded-xl text-sm uppercase tracking-widest shadow-lg hover:shadow-xl transition-all disabled:opacity-60"
            >
              {processing ? t.enrolling : t.enroll}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
