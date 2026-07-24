import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProtectedRoute from '../src/components/auth/ProtectedRoute';
import SiteHeader from '../src/components/layout/SiteHeader';
import SiteFooter from '../src/components/layout/SiteFooter';
import { useAuth } from '../src/context/AuthContext';
import { MyCourseWithProgress } from '../src/types/lms';
import { getMyCourses, downloadCertificate } from '../src/services/courseService';
import { AssignedGig, GigStatus } from '../src/types/community';
import { getAssignedGigs, requestMentorHelp } from '../src/services/gigService';
import {
  getWalletSummary,
  getMyPayoutRequests,
  createPayoutRequest,
  WalletSummary,
  PayoutRequestRow,
} from '../src/services/walletService';

type Tab = 'overview' | 'courses' | 'wallet' | 'gigs';

const dict = {
  ka: {
    title: 'პირადი კაბინეტი',
    tabOverview: '📊 მიმოხილვა',
    tabCourses: '🎓 კურსები & სერტიფიკატები',
    tabWallet: '💰 საფულე & გადახდები',
    tabGigs: '💼 ჩემი გიგები',
    tabSettings: '⚙️ პარამეტრები',
    logout: 'გასვლა',
    loading: 'იტვირთება…',
    // Overview
    statCourses: 'ჩარიცხული კურსები',
    statWallet: 'საფულის ბალანსი',
    statGigs: 'აქტიური გიგები',
    statCerts: 'მიღებული სერტიფიკატები',
    progressTitle: 'კურსის პროგრესი',
    noCourses: 'თქვენ ჯერ არცერთ კურსზე არ ხართ ჩარიცხული.',
    browseCourses: 'კურსების დათვალიერება',
    // Courses tab
    coursesTitle: 'ჩემი კურსები & სერტიფიკატები',
    progress: 'პროგრესი',
    continue: 'გაგრძელება',
    downloadCert: '🎓 სერტიფიკატის ჩამოტვირთვა',
    generating: 'გენერირდება…',
    certLocked: 'სერტიფიკატი ხელმისაწვდომი იქნება კურსის დასრულების შემდეგ',
    // Wallet tab
    walletTitle: 'საფულე & გადახდები',
    availableBalance: 'ხელმისაწვდომი ბალანსი',
    escrowBalance: 'ესქროუში დაბლოკილი თანხა',
    requestPayout: 'გატანის მოთხოვნა',
    amount: 'თანხა (₾)',
    iban: 'IBAN',
    ibanHint: 'ცარიელი დატოვების შემთხვევაში გამოყენებული იქნება პარამეტრებში შენახული IBAN.',
    submit: 'მოთხოვნის გაგზავნა',
    submitting: 'იგზავნება…',
    payoutHistory: 'გატანების ისტორია',
    noPayouts: 'გატანის მოთხოვნები ჯერ არ არის.',
    // Gigs tab
    gigsTitle: 'ჩემი გიგები / სამუშაო სივრცე',
    noGigs: 'თქვენ ჯერ არცერთ გიგზე არ ხართ დანიშნული.',
    browseGigs: 'გიგების დათვალიერება',
    budget: 'ბიუჯეტი',
    chat: 'ჩატი დამკვეთთან',
    mentorHelp: '🆘 CDC მენტორის დახმარების მოთხოვნა',
    mentorRequested: '✅ მენტორის დახმარება მოთხოვნილია',
    firstOrderBadge: 'პირველი შეკვეთა',
    // Confirm modal (shared with learn.tsx)
    confirmTitle: 'გთხოვთ შეამოწმოთ!',
    confirmBody: 'სერტიფიკატზე დაიბეჭდება სახელი და გვარი:',
    confirmChangeHint: 'თუ გსურთ სახელის შეცვლა, გადადით პროფილის პარამეტრებში.',
    confirmDownload: 'დადასტურება და ჩამოტვირთვა',
    confirmChangeName: 'სახელის შეცვლა (პროფილში გადასვლა)',
    confirmCancel: 'გაუქმება',
  },
  en: {
    title: 'Dashboard',
    tabOverview: '📊 Overview',
    tabCourses: '🎓 My Courses & Certificates',
    tabWallet: '💰 Wallet & Payouts',
    tabGigs: '💼 My Gigs / Workspace',
    tabSettings: '⚙️ Account Settings',
    logout: 'Log Out',
    loading: 'Loading…',
    statCourses: 'Enrolled Courses',
    statWallet: 'Wallet Balance',
    statGigs: 'Active Gigs',
    statCerts: 'Certificates Earned',
    progressTitle: 'Course Progress',
    noCourses: "You're not enrolled in any courses yet.",
    browseCourses: 'Browse Courses',
    coursesTitle: 'My Courses & Certificates',
    progress: 'Progress',
    continue: 'Continue',
    downloadCert: '🎓 Download Certificate',
    generating: 'Generating…',
    certLocked: 'The certificate unlocks once the course is complete.',
    walletTitle: 'Wallet & Payouts',
    availableBalance: 'Available Balance',
    escrowBalance: 'Held in Escrow',
    requestPayout: 'Request a Payout',
    amount: 'Amount (₾)',
    iban: 'IBAN',
    ibanHint: 'Leave blank to use the IBAN saved in your account settings.',
    submit: 'Submit Request',
    submitting: 'Submitting…',
    payoutHistory: 'Payout History',
    noPayouts: 'No payout requests yet.',
    gigsTitle: 'My Gigs / Workspace',
    noGigs: "You're not assigned to any gigs yet.",
    browseGigs: 'Browse Gigs',
    budget: 'Budget',
    chat: 'Chat with client',
    mentorHelp: '🆘 Request CDC Mentor Help',
    mentorRequested: '✅ Mentor help requested',
    firstOrderBadge: 'First Order',
    confirmTitle: 'Please double-check!',
    confirmBody: 'This name will be printed on your certificate:',
    confirmChangeHint: 'To change it, go to your account settings.',
    confirmDownload: 'Confirm & Download',
    confirmChangeName: 'Change Name (Go to Settings)',
    confirmCancel: 'Cancel',
  },
};

const GIG_STATUS_BADGE: Record<GigStatus, string> = {
  open: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30',
  assigned: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  submitted: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
};

const PAYOUT_STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  APPROVED: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  REJECTED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  PAID: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
};

function formatGel(minorUnits: number): string {
  return `${(minorUnits / 100).toFixed(2)} ₾`;
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
      <div
        className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<MyCourseWithProgress[]>([]);
  const [gigs, setGigs] = useState<AssignedGig[]>([]);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestRow[]>([]);

  const [downloadingCourseId, setDownloadingCourseId] = useState<string | null>(null);
  const [confirmCourseId, setConfirmCourseId] = useState<string | null>(null);
  const [requestingMentorFor, setRequestingMentorFor] = useState<string | null>(null);

  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutIban, setPayoutIban] = useState('');
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  useEffect(() => {
    // Clients get their own dedicated dashboard — this one is student-focused.
    if (user?.role === 'Client') {
      router.replace('/dashboard/client');
    }
  }, [user?.role, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [coursesData, gigsData, walletData, payoutData] = await Promise.all([
        getMyCourses(),
        getAssignedGigs(),
        getWalletSummary(),
        getMyPayoutRequests(),
      ]);
      setCourses(coursesData);
      setGigs(gigsData);
      setWallet(walletData);
      setPayoutRequests(payoutData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (user?.payoutIban) setPayoutIban(user.payoutIban);
  }, [user?.payoutIban]);

  // Same legal-name precedence as the certificate generator and learn.tsx's
  // confirmation modal — keeps every "what name prints on the cert" surface
  // in sync with a single rule.
  const certificateNameKa =
    user?.legalFirstNameKa && user?.legalLastNameKa ? `${user.legalFirstNameKa} ${user.legalLastNameKa}` : user?.name ?? '';
  const certificateNameEn =
    user?.legalFirstNameEn && user?.legalLastNameEn ? `${user.legalFirstNameEn} ${user.legalLastNameEn}` : null;

  const handleDownloadCertificate = async (courseId: string, courseTitle: string) => {
    setDownloadingCourseId(courseId);
    try {
      const blob = await downloadCertificate(courseId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${courseTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingCourseId(null);
      setConfirmCourseId(null);
    }
  };

  const handleRequestMentorHelp = async (gigId: string) => {
    setRequestingMentorFor(gigId);
    try {
      const updated = await requestMentorHelp(gigId);
      setGigs((prev) => prev.map((g) => (g.id === gigId ? updated : g)));
    } finally {
      setRequestingMentorFor(null);
    }
  };

  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutError(null);
    const minorAmount = Math.round(Number(payoutAmount) * 100);
    if (!minorAmount || minorAmount < 100) {
      setPayoutError(lang === 'ka' ? 'შეიყვანეთ სწორი თანხა.' : 'Enter a valid amount.');
      return;
    }
    setPayoutSubmitting(true);
    try {
      await createPayoutRequest(minorAmount, payoutIban || undefined);
      setPayoutAmount('');
      const [walletData, payoutData] = await Promise.all([getWalletSummary(), getMyPayoutRequests()]);
      setWallet(walletData);
      setPayoutRequests(payoutData);
    } catch (err: any) {
      setPayoutError(err?.response?.data?.message ?? (lang === 'ka' ? 'მოთხოვნის გაგზავნა ვერ მოხერხდა.' : 'Unable to submit request.'));
    } finally {
      setPayoutSubmitting(false);
    }
  };

  const certificatesEarned = courses.filter((c) => c.hasCertificate).length;
  const activeGigsCount = gigs.filter((g) => g.status === 'assigned' || g.status === 'submitted').length;
  const escrowBalance = gigs
    .filter((g) => g.transaction?.status === 'HELD_IN_ESCROW')
    .reduce((sum, g) => sum + (g.transaction?.netAmount ?? 0), 0);

  const confirmCourse = courses.find((c) => c.course.id === confirmCourseId)?.course ?? null;

  const NAV: { key: Tab; label: string }[] = [
    { key: 'overview', label: t.tabOverview },
    { key: 'courses', label: t.tabCourses },
    { key: 'wallet', label: t.tabWallet },
    { key: 'gigs', label: t.tabGigs },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{t.title} | CDC Platform</title>
      </Head>

      <SiteHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-12 grid md:grid-cols-4 gap-6 md:gap-8 flex-1 w-full">
        {/* SIDE MENU */}
        <div className="space-y-2 md:sticky md:top-24 self-start">
          {NAV.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={`w-full text-left p-3.5 rounded-xl text-xs font-bold transition border ${
                activeTab === item.key
                  ? 'bg-slate-900 dark:bg-cyan-600 text-white border-transparent shadow-sm'
                  : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
          <Link
            href="/dashboard/settings"
            className="block w-full text-left p-3.5 rounded-xl text-xs font-bold transition border bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 no-underline"
          >
            {t.tabSettings}
          </Link>
          <button
            type="button"
            onClick={logout}
            className="w-full text-left p-3.5 rounded-xl text-xs font-bold transition border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 bg-transparent"
          >
            {t.logout}
          </button>
        </div>

        {/* CONTENT */}
        <div className="md:col-span-3 space-y-6">
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.loading}</p>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: t.statCourses, value: String(courses.length), color: 'text-cyan-600 dark:text-cyan-400' },
                      { label: t.statWallet, value: wallet ? formatGel(wallet.earningsBalance) : '—', color: 'text-emerald-600 dark:text-emerald-400' },
                      { label: t.statGigs, value: String(activeGigsCount), color: 'text-purple-600 dark:text-purple-400' },
                      { label: t.statCerts, value: String(certificatesEarned), color: 'text-amber-600 dark:text-amber-400' },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5"
                      >
                        <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h2 className="text-sm font-extrabold tracking-wide mb-3">{t.progressTitle}</h2>
                    {courses.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-10 text-center">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.noCourses}</p>
                        <Link
                          href="/courses"
                          className="inline-block text-xs font-bold text-white bg-slate-900 dark:bg-cyan-600 px-4 py-2.5 rounded-xl no-underline"
                        >
                          {t.browseCourses}
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {courses.map(({ course, progress }) => (
                          <div
                            key={course.id}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4"
                          >
                            <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
                              <span className="text-slate-800 dark:text-slate-200">{course.title}</span>
                              <span>{progress.percent}%</span>
                            </div>
                            <ProgressBar percent={progress.percent} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'courses' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-extrabold tracking-wide mb-2">{t.coursesTitle}</h2>
                  {courses.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-10 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.noCourses}</p>
                      <Link
                        href="/courses"
                        className="inline-block text-xs font-bold text-white bg-slate-900 dark:bg-cyan-600 px-4 py-2.5 rounded-xl no-underline"
                      >
                        {t.browseCourses}
                      </Link>
                    </div>
                  ) : (
                    courses.map(({ course, progress, hasCertificate }) => (
                      <div
                        key={course.id}
                        className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4"
                      >
                        <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-wide">{course.title}</h3>
                        <div>
                          <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                            <span>{t.progress}</span>
                            <span>{progress.percent}%</span>
                          </div>
                          <ProgressBar percent={progress.percent} />
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 pt-2">
                          <Link
                            href={`/courses/${course.id}/learn`}
                            className="text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            {t.continue}
                          </Link>
                          {progress.percent >= 100 ? (
                            <button
                              type="button"
                              onClick={() => setConfirmCourseId(course.id)}
                              disabled={downloadingCourseId === course.id}
                              className="bg-slate-950 hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition disabled:opacity-60"
                            >
                              {downloadingCourseId === course.id ? t.generating : t.downloadCert}
                            </button>
                          ) : (
                            !hasCertificate && (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 self-center">{t.certLocked}</span>
                            )
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'wallet' && wallet && (
                <div className="space-y-8">
                  <h2 className="text-lg font-extrabold tracking-wide">{t.walletTitle}</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t.availableBalance}</p>
                      <p className="text-3xl font-black text-cyan-600 dark:text-cyan-300">{formatGel(wallet.earningsBalance)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t.escrowBalance}</p>
                      <p className="text-3xl font-black text-amber-600 dark:text-amber-300">{formatGel(escrowBalance)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
                    <h3 className="text-sm font-bold mb-1">{t.requestPayout}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">{t.ibanHint}</p>
                    {payoutError && (
                      <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-600 dark:text-red-300">
                        {payoutError}
                      </div>
                    )}
                    <form onSubmit={handlePayoutSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder={t.amount}
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <input
                        placeholder={t.iban}
                        value={payoutIban}
                        onChange={(e) => setPayoutIban(e.target.value)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <button
                        type="submit"
                        disabled={payoutSubmitting}
                        className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                      >
                        {payoutSubmitting ? t.submitting : t.submit}
                      </button>
                    </form>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold mb-4">{t.payoutHistory}</h3>
                    {payoutRequests.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-500">{t.noPayouts}</p>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-xs">
                          <tbody>
                            {payoutRequests.map((r) => (
                              <tr key={r.id} className="border-b last:border-0 border-slate-200 dark:border-slate-800">
                                <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{formatGel(r.amount)}</td>
                                <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">{r.iban}</td>
                                <td className="px-4 py-3 text-slate-500 dark:text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${PAYOUT_STATUS_BADGE[r.status]}`}>
                                    {r.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'gigs' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-extrabold tracking-wide mb-2">{t.gigsTitle}</h2>
                  {gigs.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-10 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.noGigs}</p>
                      <Link
                        href="/gigs"
                        className="inline-block text-xs font-bold text-white bg-slate-900 dark:bg-cyan-600 px-4 py-2.5 rounded-xl no-underline"
                      >
                        {t.browseGigs}
                      </Link>
                    </div>
                  ) : (
                    gigs.map((gig) => (
                      <div
                        key={gig.id}
                        className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3"
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-wide">{gig.title}</h3>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                              {t.budget}: {formatGel(gig.budgetAmount)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${GIG_STATUS_BADGE[gig.status]}`}>
                              {gig.status}
                            </span>
                            {gig.isFirstOrder && (
                              <span className="text-[10px] font-bold uppercase px-2 py-1 rounded border bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30">
                                {t.firstOrderBadge}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 pt-2">
                          <Link
                            href={`/messages/${gig.postedById}`}
                            className="text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            {t.chat}
                          </Link>
                          {gig.isFirstOrder &&
                            (gig.mentorHelpRequestedAt ? (
                              <span className="text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                {t.mentorRequested}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRequestMentorHelp(gig.id)}
                                disabled={requestingMentorFor === gig.id}
                                className="text-xs font-bold px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition disabled:opacity-60"
                              >
                                {t.mentorHelp}
                              </button>
                            ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {confirmCourse && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmCourseId(null)}
        >
          <div
            className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">{t.confirmTitle}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t.confirmBody}</p>
            <p className="text-lg font-bold text-cyan-600 dark:text-cyan-300 mb-1">{certificateNameKa}</p>
            {certificateNameEn && <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{certificateNameEn}</p>}
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-6">{t.confirmChangeHint}</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleDownloadCertificate(confirmCourse.id, confirmCourse.title)}
                disabled={downloadingCourseId === confirmCourse.id}
                className="w-full text-sm font-bold px-4 py-3 rounded-xl bg-slate-950 dark:bg-cyan-600 text-white hover:bg-slate-800 dark:hover:bg-cyan-500 transition disabled:opacity-60"
              >
                {downloadingCourseId === confirmCourse.id ? t.generating : t.confirmDownload}
              </button>
              <Link
                href="/dashboard/settings"
                className="w-full text-center text-sm font-bold px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.confirmChangeName}
              </Link>
              <button
                type="button"
                onClick={() => setConfirmCourseId(null)}
                className="w-full text-sm font-bold px-4 py-3 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-transparent"
              >
                {t.confirmCancel}
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteFooter lang={lang === 'ka' ? 'GEO' : 'ENG'} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
