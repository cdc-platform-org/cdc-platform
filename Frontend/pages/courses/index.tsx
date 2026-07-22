import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';
import { Course } from '../../src/types/lms';
import { getCourses } from '../../src/services/courseService';
import { checkoutCourse } from '../../src/services/paymentService';

const dict = {
  ka: {
    title: 'კურსები',
    subtitle: 'აირჩიე კურსი და დაიწყე ციფრული პროფესიის შესწავლა.',
    enroll: 'ჩარიცხვა →',
    enrolling: 'იტვირთება…',
    viewDetails: 'ვრცლად',
    loading: 'იტვირთება…',
    empty: 'კურსები ჯერ არ არის დამატებული.',
    signInToEnroll: { ka: 'გთხოვთ გაიაროთ ავტორიზაცია კურსზე ჩასარიცხად', en: 'Please sign in to enroll in a course' },
  },
  en: {
    title: 'Courses',
    subtitle: 'Pick a course and start building a digital career.',
    enroll: 'Enroll Now →',
    enrolling: 'Loading…',
    viewDetails: 'View Details',
    loading: 'Loading…',
    empty: 'No courses have been published yet.',
    signInToEnroll: { ka: 'გთხოვთ გაიაროთ ავტორიზაცია კურსზე ჩასარიცხად', en: 'Please sign in to enroll in a course' },
  },
};

function formatPrice(minorUnits: number): string {
  return `${(minorUnits / 100).toFixed(0)} ₾`;
}

export default function CoursesPage() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const { isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCourses();
      setCourses(data.filter((c) => c.published));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleEnroll = async (course: Course) => {
    if (!isAuthenticated) {
      openAuthModal({ message: t.signInToEnroll });
      return;
    }
    setError(null);
    setEnrollingId(course.id);
    try {
      const { redirectUrl } = await checkoutCourse(course.id);
      window.location.href = redirectUrl;
    } catch {
      setError(lang === 'en' ? 'Unable to start checkout. Please try again.' : 'გადახდის დაწყება ვერ მოხერხდა.');
      setEnrollingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
      <Head>
        <title>{t.title} | CDC</title>
      </Head>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-black mb-2">{t.title}</h1>
        <p className="text-slate-400 mb-10">{t.subtitle}</p>

        {error && <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">{error}</div>}

        {loading ? (
          <p className="text-slate-400 text-sm">{t.loading}</p>
        ) : courses.length === 0 ? (
          <p className="text-slate-400 text-sm">{t.empty}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(34,211,238,0.15)]"
              >
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-purple-300 bg-purple-500/10 border-purple-500/20">
                    {course.category}
                  </span>
                  <Link href={`/courses/${course.id}`} className="block no-underline text-current">
                    <h3 className="text-lg font-black mt-4 mb-2 text-white hover:text-cyan-300 transition-colors">{course.title}</h3>
                  </Link>
                  <p className="text-sm text-slate-400 leading-relaxed mb-6 line-clamp-3">{course.description}</p>
                  {course.mentorName && (
                    <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-slate-800/60 border border-slate-800">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                        {course.mentorName.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate">{course.mentorName}</p>
                        {course.mentorTitle && <p className="text-[11px] text-slate-500 truncate">{course.mentorTitle}</p>}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xl font-black text-white">{formatPrice(course.price)}</span>
                  <div className="flex gap-2">
                    <Link
                      href={`/courses/${course.id}`}
                      className="text-xs font-bold text-slate-300 hover:text-white px-3 py-2.5 rounded-lg border border-slate-700 no-underline"
                    >
                      {t.viewDetails}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleEnroll(course)}
                      disabled={enrollingId === course.id}
                      className="text-xs font-black text-white px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-60"
                    >
                      {enrollingId === course.id ? t.enrolling : t.enroll}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
