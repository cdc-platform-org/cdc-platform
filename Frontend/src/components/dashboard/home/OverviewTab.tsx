/**
 * Overview tab of /dashboard (the default landing panel). 2026-11 redesign
 * in the EDUPRO app style: "Hi, NAME" greeting with a search bar, a brand
 * banner (continue the in-progress course, or discover courses), four stat
 * tiles that jump to their tab, a compact purchases panel and the
 * freelancer-exam nudge for students. All colours from cdc-* tokens.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowRight, Award, GraduationCap, Receipt, Search, Sparkles, Wallet } from 'lucide-react';
import MyPurchasesPanel, { purchasedBooks } from '../MyPurchasesPanel';
import { User } from '../../../types/auth';
import { MyCourseWithProgress } from '../../../types/lms';
import { WalletSummary } from '../../../services/walletService';
import { DigitalProduct } from '../../../services/productService';
import { SupportedLocale } from '../../../utils/locale';
import { DashboardStrings } from './dashboardDict';
import { DashboardTab, FreelancerExamCard, formatGel } from './dashboardShared';

interface OverviewTabProps {
  t: DashboardStrings;
  lang: SupportedLocale;
  user: User | null | undefined;
  courses: MyCourseWithProgress[];
  wallet: WalletSummary | null;
  certificatesEarned: number;
  purchasesLabel: string;
  purchasesCount: number;
  ownedBooks: ReturnType<typeof purchasedBooks>;
  purchasedProducts: DigitalProduct[];
  onDownloadProduct: (productId: string) => void;
  downloadingProductId: string | null;
  productDownloadError: string | null;
  setActiveTab: (tab: DashboardTab) => void;
}

export default function OverviewTab({
  t,
  lang,
  user,
  courses,
  wallet,
  certificatesEarned,
  purchasesLabel,
  purchasesCount,
  ownedBooks,
  purchasedProducts,
  onDownloadProduct,
  downloadingProductId,
  productDownloadError,
  setActiveTab,
}: OverviewTabProps) {
  const router = useRouter();
  const ka = lang === 'ka';
  const [query, setQuery] = useState('');
  // The banner points at whichever enrolled course still has work left.
  const inProgressCourse = courses.find((c) => c.progress.percent < 100);
  const firstName = user?.name ? user.name.split(' ')[0] : '';

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/courses');
  };

  const stats = [
    { label: purchasesLabel, value: String(purchasesCount), icon: Receipt, onClick: () => setActiveTab('purchases') },
    { label: t.statCourses, value: String(courses.length), icon: GraduationCap, onClick: () => setActiveTab('courses') },
    { label: t.statCerts, value: String(certificatesEarned), icon: Award, onClick: () => setActiveTab('courses') },
    { label: t.statWallet, value: wallet ? formatGel(wallet.earningsBalance) : '—', icon: Wallet, onClick: () => setActiveTab('wallet') },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting + search (EDUPRO home) */}
      <div>
        <h1 style={{ lineHeight: 1.3 }} className="text-2xl sm:text-3xl font-extrabold text-cdc-ink">
          {ka ? 'გამარჯობა' : 'Hi'}{firstName ? `, ${firstName}` : ''} 
        </h1>
        <p className="mt-1 text-sm text-cdc-muted">{ka ? 'რისი სწავლა გინდა დღეს?' : 'What would you like to learn today?'}</p>
        <form onSubmit={onSearch} className="mt-4 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cdc-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ka ? 'მოძებნე კურსი...' : 'Search for courses...'}
            aria-label={ka ? 'ძებნა' : 'Search'}
            className="w-full rounded-2xl border border-cdc-border bg-cdc-surface shadow-card pl-12 pr-16 py-3.5 text-base text-cdc-ink placeholder:text-cdc-muted focus:outline-none focus:ring-2 focus:ring-cdc-primary/40"
          />
          <button type="submit" aria-label={ka ? 'ძებნა' : 'Search'} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-cdc-primary text-white flex items-center justify-center border-none cursor-pointer hover:bg-cdc-primary-hover">
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </form>
      </div>

      {/* Brand banner: continue learning, or discover courses */}
      <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-violet-700 via-indigo-700 to-cyan-700 p-6 sm:p-8 text-white">
        <div className="pointer-events-none absolute -right-16 -bottom-16 w-64 h-64 rounded-full bg-white/10" aria-hidden="true" />
        <div className="pointer-events-none absolute right-24 -top-10 w-32 h-32 rounded-full bg-white/10" aria-hidden="true" />
        {inProgressCourse ? (
          <div className="relative max-w-xl">
            <p className="text-sm font-semibold text-white/80">{ka ? 'გააგრძელე სწავლა' : 'Continue learning'}</p>
            <h2 style={{ lineHeight: 1.3 }} className="mt-1 text-xl sm:text-2xl font-extrabold">{inProgressCourse.course.title}</h2>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-white/25 overflow-hidden">
                <div className="h-full rounded-full bg-white" style={{ width: `${inProgressCourse.progress.percent}%` }} />
              </div>
              <span className="text-sm font-bold">{inProgressCourse.progress.percent}%</span>
            </div>
            <Link href={`/courses/${inProgressCourse.course.id}/learn`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-violet-800 no-underline hover:bg-violet-50">
              {t.continue}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="relative max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              CDC Academy
            </span>
            <h2 style={{ lineHeight: 1.3 }} className="mt-3 text-xl sm:text-2xl font-extrabold">
              {ka ? 'დაიწყე ახალი ციფრული პროფესია' : 'Start a new digital profession'}
            </h2>
            <p className="mt-2 text-sm text-white/85">{ka ? 'ვიდეო კურსები, ლაივ ტრენინგები და AI მასწავლებლები ერთ სივრცეში.' : 'Video courses, live trainings and AI teachers in one place.'}</p>
            <Link href="/courses" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-violet-800 no-underline hover:bg-violet-50">
              {t.browseCourses}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={stat.onClick}
            className="vip-card text-left p-4 sm:p-5 cursor-pointer"
          >
            <span className="w-10 h-10 rounded-xl bg-cdc-primary-soft text-cdc-primary-ink flex items-center justify-center mb-3">
              <stat.icon className="w-5 h-5" aria-hidden="true" />
            </span>
            <p className="text-2xl font-extrabold text-cdc-ink">{stat.value}</p>
            <p className="text-xs text-cdc-muted mt-0.5">{stat.label}</p>
          </button>
        ))}
      </div>

      <MyPurchasesPanel
        compact
        lang={lang}
        books={ownedBooks}
        courses={courses}
        products={purchasedProducts}
        onDownloadProduct={onDownloadProduct}
        downloadingProductId={downloadingProductId}
        productDownloadError={productDownloadError}
        onSeeAll={() => setActiveTab('purchases')}
      />

      {user?.role === 'Student' && !user.isVerifiedGraduate && <FreelancerExamCard user={user} t={t} />}
    </div>
  );
}
