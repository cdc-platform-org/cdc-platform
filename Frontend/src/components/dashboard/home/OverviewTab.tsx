/**
 * Overview tab of /dashboard (the default landing panel): greeting, four
 * stat tiles that jump to their tab, a compact purchases panel, the
 * "continue learning" card and the freelancer-exam nudge for students.
 */
import Link from 'next/link';
import { Award, Bot, GraduationCap, Receipt, Wallet } from 'lucide-react';
import MyPurchasesPanel, { purchasedBooks } from '../MyPurchasesPanel';
import { User } from '../../../types/auth';
import { MyCourseWithProgress } from '../../../types/lms';
import { WalletSummary } from '../../../services/walletService';
import { DigitalProduct } from '../../../services/productService';
import { SupportedLocale } from '../../../utils/locale';
import { DashboardStrings } from './dashboardDict';
import { DashboardTab, FreelancerExamCard, ProgressBar, formatGel } from './dashboardShared';

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
  // Points the "continue" card at whichever enrolled course still has work
  // left — falls back to the first enrolled course if everything's already
  // complete, so the card still links somewhere valid.
  const inProgressCourse = courses.find((c) => c.progress.percent < 100) ?? courses[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold">
          {lang === 'ka' ? 'გამარჯობა' : 'Hello'}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: purchasesLabel, value: String(purchasesCount), icon: Receipt, onClick: () => setActiveTab('purchases') },
          { label: t.statCourses, value: String(courses.length), icon: GraduationCap, onClick: () => setActiveTab('courses') },
          { label: t.statCerts, value: String(certificatesEarned), icon: Award, onClick: () => setActiveTab('courses') },
          { label: t.statWallet, value: wallet ? formatGel(wallet.earningsBalance) : '—', icon: Wallet, onClick: () => setActiveTab('wallet') },
        ].map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={stat.onClick}
            className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 cursor-pointer hover:border-cyan-400/60 transition"
          >
            <stat.icon className="w-4 h-4 text-slate-500 dark:text-slate-400 mb-2" />
            <p className="text-xl font-black text-slate-900 dark:text-white">{stat.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</p>
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

      {inProgressCourse && inProgressCourse.progress.percent < 100 && (
        <Link
          href={`/courses/${inProgressCourse.course.id}/learn`}
          className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 no-underline text-current hover:border-cyan-400/60 transition"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{inProgressCourse.course.title}</p>
            <div className="mt-2"><ProgressBar percent={inProgressCourse.progress.percent} /></div>
          </div>
          <span className="shrink-0 text-xs font-bold text-cyan-600 dark:text-cyan-400 whitespace-nowrap">
            {lang === 'ka' ? 'გაგრძელება →' : 'Continue →'}
          </span>
        </Link>
      )}

      {user?.role === 'Student' && !user.isVerifiedGraduate && <FreelancerExamCard user={user} t={t} />}
    </div>
  );
}
