import { useState, useEffect, useCallback } from 'react';
import { GetStaticProps } from 'next';
import Link from 'next/link';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import GigCard from '../../src/components/community/GigCard';
import FilterBar from '../../src/components/community/FilterBar';
import ProposalModal from '../../src/components/community/ProposalModal';
import ReviewModal from '../../src/components/community/ReviewModal';
import GraduateOnlyModal from '../../src/components/community/GraduateOnlyModal';
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
      openAuthModal({ message: SIGN_IN_TO_APPLY });
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
  const canPost = user?.role === 'EnterpriseClient' || user?.role === 'SuperAdmin';

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Freelance Gigs</h1>
          {!isAuthenticated ? (
            <button
              type="button"
              onClick={handlePostGigClick}
              className="text-sm font-medium text-white bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              Post a Gig
            </button>
          ) : (
            canPost && (
              <Link
                href="/gigs/post"
                className="text-sm font-medium text-white bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700"
              >
                Post a Gig
              </Link>
            )
          )}
        </div>

        <FilterBar
          skills={skillsFilter}
          onSkillsChange={setSkillsFilter}
          extraFilter={{
            label: 'Budget type',
            value: budgetTypeFilter,
            onChange: setBudgetTypeFilter,
            options: [
              { value: 'fixed', label: 'Fixed price' },
              { value: 'hourly', label: 'Hourly' },
            ],
          }}
        />

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : gigs.length === 0 ? (
          <p className="text-sm text-gray-500">No gigs match your filters right now.</p>
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
              ? reviewingGig.assignedFreelancer?.name ?? 'the freelancer'
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