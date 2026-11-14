/**
 * /dashboard — the signed-in user's main hub (students, mentors, sellers).
 *
 * This file owns data loading and which panel is visible; each panel and
 * dialog lives in src/components/dashboard/home/:
 *   DashboardSidebar  – left navigation
 *   OverviewTab / CoursesTab / WalletTab / GigsTab / ProductsTab – the panels
 *   CertificateModals / MentorshipRequestModal – dialogs
 *   use*.ts           – state + handlers for forms that must survive tab switches
 *   dashboardDict.ts  – UI strings per locale
 *
 * Clients are redirected to /dashboard/client (their own dashboard).
 */
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import ProtectedRoute from '../src/components/auth/ProtectedRoute';
import SiteHeader from '../src/components/layout/SiteHeader';
import SiteFooter from '../src/components/layout/SiteFooter';
import LaunchKitDrawer from '../src/components/admin/LaunchKitDrawer';
import AiMarketingAssistantDrawer from '../src/components/dashboard/AiMarketingAssistantDrawer';
import MyPurchasesPanel, { purchasedBooks } from '../src/components/dashboard/MyPurchasesPanel';
import ProductDownloadList from '../src/components/store/ProductDownloadList';
import { listMyBooks, BookListItem } from '../src/services/childrensBookService';
import { useAuth } from '../src/context/AuthContext';
import { MyCourseWithProgress } from '../src/types/lms';
import { getMyCourses } from '../src/services/courseService';
import { AssignedGig } from '../src/types/community';
import { getAssignedGigs, requestMentorHelp } from '../src/services/gigService';
import { getTrainerMe } from '../src/services/trainerWorkspaceService';
import { getWalletSummary, getMyPayoutRequests, WalletSummary, PayoutRequestRow } from '../src/services/walletService';
import { getMyPayments, downloadInvoice, MyPaymentRow } from '../src/services/paymentService';
import { getProducts, getProductDownload, ProductDownload, DigitalProduct } from '../src/services/productService';
import { resolveLocale } from '@/src/utils/locale';
import { dashboardDict } from '../src/components/dashboard/home/dashboardDict';
import { DashboardTab } from '../src/components/dashboard/home/dashboardShared';
import DashboardSidebar from '../src/components/dashboard/home/DashboardSidebar';
import OverviewTab from '../src/components/dashboard/home/OverviewTab';
import CoursesTab from '../src/components/dashboard/home/CoursesTab';
import WalletTab from '../src/components/dashboard/home/WalletTab';
import GigsTab from '../src/components/dashboard/home/GigsTab';
import ProductsTab from '../src/components/dashboard/home/ProductsTab';
import CertificateModals from '../src/components/dashboard/home/CertificateModals';
import MentorshipRequestModal from '../src/components/dashboard/home/MentorshipRequestModal';
import { useProductSubmission } from '../src/components/dashboard/home/useProductSubmission';
import { useCertificateDownload } from '../src/components/dashboard/home/useCertificateDownload';
import { useMentorshipRequest } from '../src/components/dashboard/home/useMentorshipRequest';
import { useWalletPayout } from '../src/components/dashboard/home/useWalletPayout';

/** Triggers a browser download of a Blob under the given file name. */
function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function DashboardContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dashboardDict[lang];
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  // IAKO Trainer Tools — sidebar entry only when the signed-in user has an
  // active TrainerProfile (server-verified via GET /trainer/me, see
  // trainerWorkspaceService.ts). Deliberately not a Role check — a Mentor or
  // admin without a TrainerProfile must not see it.
  const [isTrainer, setIsTrainer] = useState(false);

  // ── Data loaded once on mount (see load() below) ──
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<MyCourseWithProgress[]>([]);
  const [gigs, setGigs] = useState<AssignedGig[]>([]);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestRow[]>([]);
  const [payments, setPayments] = useState<MyPaymentRow[]>([]);
  const [purchasedProducts, setPurchasedProducts] = useState<DigitalProduct[]>([]);
  const [myBooks, setMyBooks] = useState<BookListItem[]>([]);

  // ── Download / small action state ──
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [downloadingProductId, setDownloadingProductId] = useState<string | null>(null);
  const [productDownloadError, setProductDownloadError] = useState<string | null>(null);
  const [productDownloadList, setProductDownloadList] = useState<ProductDownload | null>(null);
  const [requestingMentorFor, setRequestingMentorFor] = useState<string | null>(null);
  const [launchKitTarget, setLaunchKitTarget] = useState<{ productId: string; title: string } | null>(null);
  const [showAiMarketingAssistant, setShowAiMarketingAssistant] = useState(false);

  // isVerifiedGraduate covers both "passed the freelancer exam" and "CDC
  // course graduate" (see Backend's freelancerExam.ts/courses.ts — same
  // flag, not two separate booleans); admin-team members can submit too.
  const canSubmitProduct = !!user && (user.isVerifiedGraduate || !!user.adminRole);

  // ── Feature hooks (state kept here so it survives switching tabs) ──
  const submission = useProductSubmission({ user, t, activeTab, canSubmitProduct });
  const cert = useCertificateDownload({ user, t });
  const mentorship = useMentorshipRequest({ lang, t });
  const payout = useWalletPayout({ user, lang, setWallet, setPayoutRequests });

  useEffect(() => {
    getTrainerMe().then((result) => setIsTrainer(result.isTrainer)).catch(() => setIsTrainer(false));
  }, []);

  useEffect(() => {
    // Clients get their own dedicated dashboard — this one is student-
    // facing. Mentors are NOT redirected: a Mentor is still a regular
    // platform user underneath (Mentor is a value of the same single `role`
    // field Student/Client use), so their courses/wallet/products/settings
    // are just as real. They see this dashboard plus the Mentor Workspace
    // sidebar link.
    if (user?.role === 'Client') {
      router.replace('/dashboard/client');
    }
  }, [user?.role, router]);

  // Deep-link support for SiteHeader's "My Courses" menu item
  // (/dashboard?tab=courses) and same-page CTA cards like
  // DigitalStoreCTACard (/dashboard?tab=products) — re-syncs whenever the
  // query param itself changes, not just on initial mount. A same-page
  // query-only transition never changes router.isReady, so router.query.tab
  // must be a dependency too. That's safe against fighting the tab buttons'
  // own setActiveTab — a button click never changes the URL.
  useEffect(() => {
    const queryTab = router.query.tab;
    if (queryTab === 'purchases' || queryTab === 'courses' || queryTab === 'wallet' || queryTab === 'gigs') {
      setActiveTab(queryTab);
    } else if (queryTab === 'products') {
      // Purchased products now live under "My purchases"; the products tab
      // itself is only the seller workspace, so a non-seller following an
      // old ?tab=products link lands on their purchases instead.
      setActiveTab(canSubmitProduct ? 'products' : 'purchases');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.tab, canSubmitProduct]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // allSettled, not all: with Promise.all a single failing request
      // (e.g. the forum quota) rejected the whole batch and left every
      // section empty — including the user's purchases.
      const [coursesRes, gigsRes, walletRes, payoutRes, paymentsRes, productsRes, booksRes] = await Promise.allSettled([
        getMyCourses(),
        getAssignedGigs(),
        getWalletSummary(),
        getMyPayoutRequests(),
        getMyPayments(),
        getProducts(),
        listMyBooks(),
      ]);
      if (coursesRes.status === 'fulfilled') setCourses(coursesRes.value);
      if (gigsRes.status === 'fulfilled') setGigs(gigsRes.value);
      if (walletRes.status === 'fulfilled') setWallet(walletRes.value);
      if (payoutRes.status === 'fulfilled') setPayoutRequests(payoutRes.value);
      if (paymentsRes.status === 'fulfilled') setPayments(paymentsRes.value);
      if (productsRes.status === 'fulfilled') setPurchasedProducts(productsRes.value.filter((p) => p.purchased));
      if (booksRes.status === 'fulfilled') setMyBooks(booksRes.value);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownloadInvoice = async (paymentId: string) => {
    setInvoiceError(null);
    setDownloadingInvoiceId(paymentId);
    try {
      saveBlob(await downloadInvoice(paymentId), `invoice-${paymentId}.pdf`);
    } catch {
      setInvoiceError(t.invoiceDownloadFailed);
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const handleDownloadProduct = async (productId: string) => {
    setProductDownloadError(null);
    setDownloadingProductId(productId);
    try {
      const download = await getProductDownload(productId);
      // More than one file → a clickable list instead (see ProductDownloadList).
      if (download.files.length > 1) {
        setProductDownloadList(download);
        return;
      }
      const { fileUrl } = download;
      // window.open after an await is often blocked as a popup; fall back
      // to navigating the current tab so the download still starts. (No
      // 'noopener' feature string: with it window.open always returns null,
      // which would make the fallback fire even when the tab did open.)
      const opened = window.open(fileUrl, '_blank');
      if (opened) opened.opener = null;
      else window.location.assign(fileUrl);
    } catch {
      setProductDownloadError(t.downloadFailed);
    } finally {
      setDownloadingProductId(null);
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

  // ── Derived values ──
  const certificatesEarned = courses.filter((c) => c.hasCertificate).length;
  // Gig earnings released only after the client approves the delivery.
  const escrowBalance = gigs
    .filter((g) => g.transaction?.status === 'HELD_IN_ESCROW')
    .reduce((sum, g) => sum + (g.transaction?.netAmount ?? 0), 0);
  const confirmCourse = courses.find((c) => c.course.id === cert.confirmCourseId)?.course ?? null;
  const ownedBooks = purchasedBooks(myBooks, payments);
  const purchasesCount = ownedBooks.length + courses.length + purchasedProducts.length;
  const purchasesLabel = lang === 'ka' ? 'ჩემი შენაძენები' : 'My purchases';

  return (
    <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 min-h-screen bg-cdc-bg text-cdc-ink flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>

      <SiteHeader />

      <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 md:py-8 grid md:grid-cols-4 xl:grid-cols-5 gap-6 md:gap-8 flex-1 w-full">
        <DashboardSidebar
          t={t}
          lang={lang}
          user={user}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          purchasesLabel={purchasesLabel}
          purchasesCount={purchasesCount}
          showGigs={gigs.length > 0 || user?.primaryIntent === 'TALENT'}
          canSubmitProduct={canSubmitProduct}
          isTrainer={isTrainer}
          onOpenMentorship={mentorship.openMentorshipModal}
          onLogout={() => { logout(); router.push('/'); }}
        />

        <div className="md:col-span-3 xl:col-span-4 space-y-6 min-w-0">
          {loading ? (
            <p className="text-sm text-cdc-muted">{t.loading}</p>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab
                  t={t}
                  lang={lang}
                  user={user}
                  courses={courses}
                  wallet={wallet}
                  certificatesEarned={certificatesEarned}
                  purchasesLabel={purchasesLabel}
                  purchasesCount={purchasesCount}
                  ownedBooks={ownedBooks}
                  purchasedProducts={purchasedProducts}
                  onDownloadProduct={handleDownloadProduct}
                  downloadingProductId={downloadingProductId}
                  productDownloadError={productDownloadError}
                  setActiveTab={setActiveTab}
                />
              )}

              {activeTab === 'purchases' && (
                <MyPurchasesPanel
                  lang={lang}
                  books={ownedBooks}
                  courses={courses}
                  products={purchasedProducts}
                  onDownloadProduct={handleDownloadProduct}
                  downloadingProductId={downloadingProductId}
                  productDownloadError={productDownloadError}
                />
              )}

              {activeTab === 'courses' && (
                <CoursesTab t={t} lang={lang} user={user} courses={courses} certificatesEarned={certificatesEarned} cert={cert} />
              )}

              {activeTab === 'wallet' && (
                <WalletTab
                  t={t}
                  wallet={wallet}
                  escrowBalance={escrowBalance}
                  payoutRequests={payoutRequests}
                  payments={payments}
                  payout={payout}
                  invoiceError={invoiceError}
                  downloadingInvoiceId={downloadingInvoiceId}
                  onDownloadInvoice={handleDownloadInvoice}
                />
              )}

              {activeTab === 'gigs' && (
                <GigsTab t={t} gigs={gigs} requestingMentorFor={requestingMentorFor} onRequestMentorHelp={handleRequestMentorHelp} />
              )}

              {activeTab === 'products' && (
                <ProductsTab
                  t={t}
                  lang={lang}
                  canSubmitProduct={canSubmitProduct}
                  submission={submission}
                  onOpenAiMarketingAssistant={() => setShowAiMarketingAssistant(true)}
                  onOpenLaunchKit={setLaunchKitTarget}
                  onShowPurchases={() => setActiveTab('purchases')}
                />
              )}
            </>
          )}
        </div>
      </div>

      <CertificateModals t={t} cert={cert} confirmCourse={confirmCourse} />
      <MentorshipRequestModal t={t} mentorship={mentorship} />

      <SiteFooter />
      {productDownloadList && (
        <ProductDownloadList
          files={productDownloadList.files}
          licenseType={productDownloadList.licenseType}
          lang={lang === 'ka' ? 'ka' : 'en'}
          onClose={() => setProductDownloadList(null)}
        />
      )}

      {launchKitTarget && (
        <LaunchKitDrawer
          target={{ productId: launchKitTarget.productId }}
          title={launchKitTarget.title}
          scope="creator"
          onClose={() => setLaunchKitTarget(null)}
        />
      )}

      {showAiMarketingAssistant && (
        <AiMarketingAssistantDrawer
          title={submission.submitTitle}
          description={submission.submitDescription}
          category={submission.submitCategory}
          productId={submission.editingSubmissionId ?? undefined}
          lang={lang}
          onApplyTitle={submission.setSubmitTitle}
          onApplyDescription={submission.setSubmitDescription}
          onClose={() => setShowAiMarketingAssistant(false)}
        />
      )}
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
