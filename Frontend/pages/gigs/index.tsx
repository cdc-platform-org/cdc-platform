import { useState, useEffect, useCallback } from 'react';
import { GetStaticProps } from 'next';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import GigCard from '../../src/components/community/GigCard';
import FilterBar from '../../src/components/community/FilterBar';
import BackButton from '../../src/components/common/BackButton';
import ProposalModal from '../../src/components/community/ProposalModal';
import ReviewModal from '../../src/components/community/ReviewModal';
import GraduateOnlyModal from '../../src/components/community/GraduateOnlyModal';
import SiteHeader from '../../src/components/layout/SiteHeader';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';
import { Gig } from '../../src/types/community';
import { getGigs, applyToGig } from '../../src/services/gigService';
import { createReview } from '../../src/services/reviewService';

const SIGN_IN_TO_APPLY = {
  ka: 'გთხოვთ გაიაროთ ავტორიზაცია შეკვეთის გასაგზავნად',
  en: 'Please sign in to submit a proposal',
};
const SIGN_IN_TO_POST = {
  ka: 'გთხოვთ გაიაროთ ავტორიზაცია ვაკანსიის გამოსაქვეყნებლად',
  en: 'Please sign in to post a job',
};
const SIGN_IN_TO_REVIEW = {
  ka: 'გთხოვთ გაიაროთ ავტორიზაცია შეფასების დასატოვებლად',
  en: 'Please sign in to leave a review',
};

function GigsPageContent() {
  const { t } = useTranslation('proposals');
  const { user, isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillsFilter, setSkillsFilter] = useState('');
  const [budgetTypeFilter, setBudgetTypeFilter] = useState('');
  const [applyingTo, setApplyingTo] = useState<Gig | null>(null);
  const [reviewingGig, setReviewingGig] = useState<Gig | null>(null);
  const [reviewedGigIds, setReviewedGigIds] = useState<Set<string>>(new Set());
  const [showGraduateGate, setShowGraduateGate] = useState(false);

  const handleApplyClick = (gig: Gig) => {
    if (!isAuthenticated) {
      // Preserve intent — resume straight into the same apply flow once
      // the guest signs in, instead of leaving them logged in with
      // nothing happening.
      openAuthModal({
        message: SIGN_IN_TO_APPLY,
        onSuccess: (loggedInUser) => {
          if (loggedInUser?.isVerifiedGraduate) setApplyingTo(gig);
          else setShowGraduateGate(true);
        },
      });
    } else if (user?.isVerifiedGraduate) {
      setApplyingTo(gig);
    } else {
      setShowGraduateGate(true);
    }
  };

  const handlePostGigClick = () => {
    openAuthModal({ message: SIGN_IN_TO_POST });
  };

  const handleReviewClick = (gig: Gig) => {
    if (!isAuthenticated) {
      openAuthModal({ message: SIGN_IN_TO_REVIEW });
      return;
    }
    setReviewingGig(gig);
  };

  const loadGigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGigs({
        skills: skillsFilter ? skillsFilter.split(',').map((s) => s.trim()) : undefined,
        budgetType: budgetTypeFilter || undefined,
      });
      setGigs(data);
    } catch (error) {
      console.error('Failed to load gigs:', error);
    } finally {
      setLoading(false);
    }
  }, [skillsFilter, budgetTypeFilter]);

  useEffect(() => {
    loadGigs();
  }, [loadGigs]);

  // Guests see the same Apply button as Students — clicking it is what
  // triggers the sign-in prompt, rather than the button just not existing.
  const canApply = !isAuthenticated || user?.role === 'Student';
  const canPost = user?.role === 'Client' || user?.role === 'SuperAdmin';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100">
      <SiteHeader />
      <div className="relative overflow-hidden border-b border-slate-200/60 dark:border-slate-800">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 w-72 h-72 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-10">
          <BackButton fallbackHref="/" className="text-slate-500 dark:text-slate-400 dark:hover:text-slate-100" />
          <div className="flex items-center justify-between gap-4 mt-8">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-purple-500 via-fuchsia-600 to-cyan-500 bg-clip-text text-transparent">
                {t('marketplace.gigsTitle')}
              </span>
            </h1>
            {!isAuthenticated ? (
              <button
                type="button"
                onClick={handlePostGigClick}
                className="shrink-0 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-cyan-500 px-4 sm:px-5 py-2.5 rounded-xl hover:opacity-90 shadow-lg shadow-purple-500/20 transition"
              >
                {t('marketplace.postGig')}
              </button>
            ) : (
              canPost && (
                <Link
                  href="/gigs/post"
                  className="shrink-0 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-cyan-500 px-4 sm:px-5 py-2.5 rounded-xl hover:opacity-90 shadow-lg shadow-purple-500/20 transition no-underline"
                >
                  {t('marketplace.postGig')}
                </Link>
              )
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <FilterBar
          skills={skillsFilter}
          onSkillsChange={setSkillsFilter}
          skillsPlaceholder={t('marketplace.skillsFilterPlaceholder')}
          extraFilter={{
            label: t('marketplace.budgetTypeLabel'),
            value: budgetTypeFilter,
            onChange: setBudgetTypeFilter,
            options: [
              { value: 'fixed', label: t('marketplace.budgetFixed') },
              { value: 'hourly', label: t('marketplace.budgetHourly') },
            ],
          }}
        />

        {loading ? (
          <p className="text-sm text-gray-400">{t('marketplace.loading')}</p>
        ) : gigs.length === 0 ? (
          <p className="text-sm text-gray-500">{t('marketplace.noGigsMatch')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {gigs.map((gig) => (
              <GigCard
                key={gig.id}
                gig={gig}
                canApply={canApply}
                onApply={handleApplyClick}
                isOwnerOrAdmin={gig.postedBy.id === user?.id || user?.role === 'SuperAdmin'}
                canReview={gig.postedBy.id === user?.id || gig.assignedFreelancerId === user?.id}
                alreadyReviewed={reviewedGigIds.has(gig.id)}
                onReview={handleReviewClick}
              />
            ))}
          </div>
        )}
      </div>

      {applyingTo && (
        <ProposalModal
          gigTitle={applyingTo.title}
          clientBudgetAmount={applyingTo.budgetAmount}
          currency={applyingTo.currency}
          onClose={() => setApplyingTo(null)}
          onSubmit={async ({ proposalNote, bidAmount, deliveryDays }) => {
            await applyToGig(applyingTo.id, { proposalNote, bidAmount, deliveryDays });
            setGigs((prev) =>
              prev.map((g) =>
                g.id === applyingTo.id ? { ...g, applicationsCount: g.applicationsCount + 1 } : g
              )
            );
          }}
        />
      )}

      {showGraduateGate && <GraduateOnlyModal onClose={() => setShowGraduateGate(false)} />}

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
    </div>
  );
}

export default function GigsPage() {
  return <GigsPageContent />;
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common', 'proposals'])) },
});