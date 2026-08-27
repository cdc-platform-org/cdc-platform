import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import LaunchKitDrawer from '../../src/components/admin/LaunchKitDrawer';
import { getMyInstructorCourses } from '../../src/services/instructorCourseService';
import { getMySubmissions, DigitalProduct } from '../../src/services/productService';
import { InstructorCourse } from '../../src/types/instructor';

// ============================================================
// AI MARKETING & LAUNCH KITS — a Mentor's own Instructor Studio courses and
// any digital products the current user has submitted, in one list, each
// with a "Generate Sales Launch Kit" button. Free for every creator, no
// credit/subscription gate — see routes/creatorMarketing.ts's own comment.
// Deliberately lists BOTH courses and products together rather than two
// separate pages, since the same person is often both a Mentor and a
// digital-product seller and shouldn't have to visit two places.
// ============================================================

type Row =
  | { kind: 'course'; id: string; title: string; status: string }
  | { kind: 'product'; id: string; title: string; status: string };

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
  PENDING_REVIEW: 'text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400',
  NEEDS_REVISION: 'text-orange-700 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-400',
  PUBLISHED: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400',
  REJECTED: 'text-red-700 bg-red-50 dark:bg-red-500/10 dark:text-red-400',
  ARCHIVED: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
  PENDING: 'text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400',
  APPROVED: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400',
};

function MarketingContent() {
  const [courses, setCourses] = useState<InstructorCourse[] | null>(null);
  const [products, setProducts] = useState<DigitalProduct[] | null>(null);
  const [drawerTarget, setDrawerTarget] = useState<{ target: { courseId: string } | { productId: string }; title: string } | null>(null);

  const load = useCallback(async () => {
    const [myCourses, myProducts] = await Promise.all([
      getMyInstructorCourses().catch(() => []),
      getMySubmissions().catch(() => []),
    ]);
    setCourses(myCourses);
    setProducts(myProducts);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows: Row[] = [
    ...(courses ?? []).map((c): Row => ({ kind: 'course', id: c.id, title: c.title, status: c.status })),
    ...(products ?? []).map((p): Row => ({ kind: 'product', id: p.id, title: p.title, status: p.status ?? 'PENDING' })),
  ];

  const loading = courses === null || products === null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <BackButton fallbackHref="/dashboard" className="mb-4 text-slate-400 hover:text-slate-100" />
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h1 className="text-2xl font-black">AI მარკეტინგი & Launch Kits</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          გაუშვით AI-გენერირებული გაყიდვების კომპლექტი თქვენი კურსებისთვის ან პროდუქტებისთვის — უფასოდ, შეზღუდვების გარეშე.
        </p>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">იტვირთება…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-500 dark:text-slate-400">
            თქვენ ჯერ არ გაქვთ შექმნილი კურსი ან პროდუქტი.{' '}
            <Link href="/dashboard/instructor-studio" className="text-cyan-600 dark:text-cyan-400 hover:underline">
              შექმენით კურსი
            </Link>{' '}
            ან დაამატეთ ციფრული პროდუქტი დაფაზე.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={`${row.kind}-${row.id}`}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3 flex-wrap"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{row.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{row.kind === 'course' ? 'კურსი' : 'ციფრული პროდუქტი'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${STATUS_BADGE[row.status] ?? STATUS_BADGE.DRAFT}`}>
                    {row.status.replace('_', ' ')}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDrawerTarget({
                        target: row.kind === 'course' ? { courseId: row.id } : { productId: row.id },
                        title: row.title,
                      })
                    }
                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-purple-600 px-3 py-2 rounded-lg border-none cursor-pointer hover:opacity-90"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Launch Kit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />

      {drawerTarget && (
        <LaunchKitDrawer
          target={drawerTarget.target}
          title={drawerTarget.title}
          scope="creator"
          onClose={() => setDrawerTarget(null)}
        />
      )}
    </div>
  );
}

export default function InstructorMarketingPage() {
  return (
    <ProtectedRoute>
      <MarketingContent />
    </ProtectedRoute>
  );
}
