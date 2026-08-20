import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import SiteHeader from '../src/components/layout/SiteHeader';
import SiteFooter from '../src/components/layout/SiteFooter';
import BackButton from '../src/components/common/BackButton';
import CommunityListingCard, { CommunityListing } from '../src/components/community/CommunityListingCard';
import PostingForm from '../src/components/community/PostingForm';
import ApplicationModal from '../src/components/community/ApplicationModal';
import ProposalModal from '../src/components/community/ProposalModal';
import ReviewModal from '../src/components/community/ReviewModal';
import SoftVerificationNudge from '../src/components/community/SoftVerificationNudge';
import RoleGate from '../src/components/auth/RoleGate';
import { useAuth } from '../src/context/AuthContext';
import { useAuthModal } from '../src/context/AuthModalContext';
import { useVerificationDrawer } from '../src/context/VerificationDrawerContext';
import { isFreelancerVerified } from '../src/types/auth';
import { Vacancy, Gig, JobCategory } from '../src/types/community';
import { getVacancies, applyToVacancy } from '../src/services/vacancyService';
import { getGigs, applyToGig } from '../src/services/gigService';
import { createReview } from '../src/services/reviewService';
import { JOB_CATEGORIES } from '../src/utils/jobCategory';

type Category = 'all' | JobCategory;

// JOB_CATEGORIES' own union values (e.g. 'ui_ux_design') double as the
// translation key suffix on proposals.json's jobCategories object (e.g.
// jobCategories.uiUxDesign) — this map bridges the snake_case enum to the
// camelCase key rather than keeping a second hardcoded label per category.
const CATEGORY_LABEL_KEY: Record<JobCategory, string> = {
  ui_ux_design: 'uiUxDesign',
  web_development: 'webDevelopment',
  graphic_design: 'graphicDesign',
  digital_marketing: 'digitalMarketing',
  other: 'other',
};

// Filters on the real, poster-selected category field (Gig/Vacancy.category)
// rather than guessing from free-text skills — replaces the old keyword-
// matching heuristic now that postings can actually be tagged with one.
function matchesCategory(item: CommunityListing, category: Category): boolean {
  if (category === 'all') return true;
  return item.data.category === category;
}

function matchesSearch(item: CommunityListing, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    item.data.title.toLowerCase().includes(q) ||
    item.data.description.toLowerCase().includes(q) ||
    item.data.skillsRequired.some((skill) => skill.toLowerCase().includes(q))
  );
}

function CommunityPageContent() {
  const { t } = useTranslation('proposals');
  const { user, isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { openVerificationDrawer } = useVerificationDrawer();

  const [darkMode, setDarkMode] = useState(false);
  const [listings, setListings] = useState<CommunityListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category>('all');

  const [applyingVacancy, setApplyingVacancy] = useState<Vacancy | null>(null);
  const [applyingGig, setApplyingGig] = useState<Gig | null>(null);
  const [reviewingGig, setReviewingGig] = useState<Gig | null>(null);
  const [reviewedGigIds, setReviewedGigIds] = useState<Set<string>>(new Set());
  // Soft-nudge state — see JobsDashboard.tsx's identical pattern/comment.
  const [pendingApply, setPendingApply] = useState<CommunityListing | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = localStorage.getItem('darkMode') === 'true';
      setDarkMode(isDark);
      document.documentElement.classList.toggle('dark', isDark);
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('darkMode', String(next));
    document.documentElement.classList.toggle('dark', next);
  };

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const [vacancies, gigs] = await Promise.all([getVacancies(), getGigs()]);
      const combined: CommunityListing[] = [
        ...vacancies.map((v): CommunityListing => ({ kind: 'vacancy', data: v })),
        ...gigs.map((g): CommunityListing => ({ kind: 'gig', data: g })),
      ].sort((a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime());
      setListings(combined);
    } catch (error) {
      console.error('Failed to load community listings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const filteredListings = useMemo(
    () => listings.filter((item) => matchesCategory(item, category) && matchesSearch(item, search)),
    [listings, category, search]
  );

  const canApply = !isAuthenticated || user?.role === 'Student';
  const canPost = user?.role === 'Client' || user?.role === 'SuperAdmin';

  const openListingModal = (item: CommunityListing) => {
    if (item.kind === 'vacancy') setApplyingVacancy(item.data);
    else setApplyingGig(item.data);
  };

  const handleApplyClick = (item: CommunityListing) => {
    const openForItem = (verified: boolean) => {
      if (verified) openListingModal(item);
      else setPendingApply(item);
    };

    if (!isAuthenticated) {
      openAuthModal({
        message: t('signIn.toApply'),
        onSuccess: (loggedInUser) => openForItem(!!loggedInUser && isFreelancerVerified(loggedInUser)),
      });
      return;
    }
    openForItem(!!user && isFreelancerVerified(user));
  };

  const handleContinueWithoutVerifying = () => {
    if (pendingApply) openListingModal(pendingApply);
    setPendingApply(null);
  };

  const handleVerifyFromNudge = () => {
    setPendingApply(null);
    openVerificationDrawer({ initialTab: 'individual' });
  };

  const handleReviewClick = (item: CommunityListing) => {
    if (item.kind !== 'gig') return;
    if (!isAuthenticated) {
      openAuthModal({ message: t('signIn.toReview') });
      return;
    }
    setReviewingGig(item.data);
  };

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-300 relative overflow-hidden ${
        darkMode ? 'text-slate-200 bg-[#0b0f19]' : 'text-slate-800 bg-[#f1f5f9]'
      }`}
    >
      <Head>
        <title>CDC | Community & Freelance</title>
      </Head>

      <SiteHeader />

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6">
        <BackButton fallbackHref="/" className={darkMode ? 'text-slate-400 hover:text-slate-100' : ''} />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-2">
        <h1 className={`text-2xl md:text-3xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
          {t('community.pageTitle')}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {t('community.pageSubtitle')}
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* MAIN AREA — search, category filters, listing feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('community.searchPlaceholder')}
              className={`flex-1 rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${
                darkMode ? 'bg-[#0e1422] border-slate-800 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(['all', ...JOB_CATEGORIES] as Category[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  category === c
                    ? 'bg-slate-900 text-white border-slate-900 shadow'
                    : darkMode
                    ? 'text-slate-400 bg-[#0e1422] border-slate-800'
                    : 'text-slate-500 bg-white border-slate-200'
                }`}
              >
                {c === 'all' ? t('jobCategories.all') : t(`jobCategories.${CATEGORY_LABEL_KEY[c]}`)}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">{t('marketplace.loading')}</p>
          ) : filteredListings.length === 0 ? (
            <p className="text-sm text-slate-400">{t('community.noListingsFound')}</p>
          ) : (
            <div className="space-y-6">
              {filteredListings.map((item) => (
                <CommunityListingCard
                  key={`${item.kind}-${item.data.id}`}
                  item={item}
                  darkMode={darkMode}
                  canApply={canApply}
                  onApply={handleApplyClick}
                  isOwnerOrAdmin={item.data.postedBy.id === user?.id || user?.role === 'SuperAdmin'}
                  canReview={
                    item.kind === 'gig' &&
                    (item.data.postedBy.id === user?.id || item.data.assignedFreelancerId === user?.id)
                  }
                  alreadyReviewed={item.kind === 'gig' && reviewedGigIds.has(item.data.id)}
                  onReview={handleReviewClick}
                />
              ))}
            </div>
          )}
        </div>

        {/* SIDEBAR — post a job / announcement, embedded */}
        <div className="lg:col-span-1">
          <div
            className={`rounded-3xl p-6 border backdrop-blur-xl sticky top-28 ${
              darkMode ? 'bg-[#0e1422]/60 border-slate-800 shadow-2xl' : 'bg-white border-slate-200/80 shadow-md'
            }`}
          >
            <div className="flex items-center space-x-3 mb-6">
              <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className={`text-lg font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                {t('community.postSectionTitle')}
              </h2>
            </div>

            {!isAuthenticated ? (
              <div className="text-center py-6">
                <p className="text-xs text-slate-400 mb-4">{t('signIn.toPost')}</p>
                <button
                  type="button"
                  onClick={() => openAuthModal({ message: t('signIn.toPost') })}
                  className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold py-3 rounded-xl text-xs uppercase border-none cursor-pointer transition-all shadow-lg shadow-cyan-500/10 tracking-wider"
                >
                  {t('community.authorizeButton')}
                </button>
              </div>
            ) : (
              <RoleGate
                allowedRoles={['Client', 'SuperAdmin']}
                fallback={
                  <p className="text-xs text-slate-400 text-center py-6">
                    {t('community.clientAdminOnlyMessage')}
                  </p>
                }
              >
                <PostingForm
                  initialType="vacancy"
                  allowTypeToggle
                  className={darkMode ? 'text-slate-900' : undefined}
                />
              </RoleGate>
            )}
          </div>
        </div>
      </div>

      {applyingVacancy && (
        <ApplicationModal
          title={t('marketplace.applyToTitle', { title: applyingVacancy.title })}
          includeBid={false}
          onClose={() => setApplyingVacancy(null)}
          onSubmit={async ({ note }) => {
            await applyToVacancy(applyingVacancy.id, { coverNote: note });
          }}
        />
      )}

      {applyingGig && (
        <ProposalModal
          gigTitle={applyingGig.title}
          clientBudgetAmount={applyingGig.budgetAmount}
          currency={applyingGig.currency}
          onClose={() => setApplyingGig(null)}
          onSubmit={async ({ proposalNote, bidAmount, deliveryDays }) => {
            await applyToGig(applyingGig.id, { proposalNote, bidAmount, deliveryDays });
            setListings((prev) =>
              prev.map((item) =>
                item.kind === 'gig' && item.data.id === applyingGig.id
                  ? { ...item, data: { ...item.data, applicationsCount: item.data.applicationsCount + 1 } }
                  : item
              )
            );
          }}
        />
      )}

      {pendingApply && (
        <SoftVerificationNudge
          onContinueWithoutVerifying={handleContinueWithoutVerifying}
          onVerify={handleVerifyFromNudge}
          onClose={() => setPendingApply(null)}
        />
      )}

      {reviewingGig && (
        <ReviewModal
          gigTitle={reviewingGig.title}
          revieweeName={
            reviewingGig.postedBy.id === user?.id
              ? reviewingGig.assignedFreelancer?.name ?? t('marketplace.freelancerFallbackName')
              : reviewingGig.postedBy.name
          }
          onClose={() => setReviewingGig(null)}
          onSubmit={async ({ rating, comment }) => {
            try {
              await createReview({ gigId: reviewingGig.id, rating, comment });
            } catch (err: any) {
              if (err?.response?.status === 409) {
                setReviewedGigIds((prev) => new Set(prev).add(reviewingGig.id));
              }
              throw err;
            }
            setReviewedGigIds((prev) => new Set(prev).add(reviewingGig.id));
          }}
        />
      )}

      <div className="mt-12">
        <SiteFooter />
      </div>
    </div>
  );
}

export default function Community() {
  return <CommunityPageContent />;
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['proposals'])) },
});
