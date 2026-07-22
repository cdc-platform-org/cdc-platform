import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import StarRating from '../../src/components/community/StarRating';
import DirectHireModal from '../../src/components/community/DirectHireModal';
import VerifiedGraduateBadge from '../../src/components/community/VerifiedGraduateBadge';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';
import { UserRatingSummary, UserReview } from '../../src/types/review';
import { Gig } from '../../src/types/community';
import { getUserReviews } from '../../src/services/reviewService';
import { getGigs } from '../../src/services/gigService';
import { createDirectOffer } from '../../src/services/directOfferService';

const REVIEW_TYPE_LABEL: Record<UserReview['type'], string> = {
  CLIENT_TO_FREELANCER: 'as freelancer',
  FREELANCER_TO_CLIENT: 'as client',
};

const SIGN_IN_TO_CONTACT = {
  ka: 'გთხოვთ გაიაროთ ავტორიზაცია შეტყობინების გასაგზავნად',
  en: 'Please sign in to send a message',
};

function ProfileContent() {
  const router = useRouter();
  const { userId } = router.query;
  const { user: viewer, isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { t } = useTranslation('proposals');
  const [profileUser, setProfileUser] = useState<UserRatingSummary | null>(null);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showHireModal, setShowHireModal] = useState(false);
  const [myOpenJobs, setMyOpenJobs] = useState<Gig[]>([]);
  const [offerSent, setOfferSent] = useState(false);

  const canHire =
    !!viewer &&
    (viewer.role === 'EnterpriseClient' || viewer.role === 'SuperAdmin') &&
    profileUser?.role === 'Student';
  // Guests can't be role-checked yet, so the button stays visible for any
  // freelancer profile and the sign-in prompt decides eligibility afterward.
  const showHireButton = profileUser?.role === 'Student' && (!isAuthenticated || canHire);

  const handleHireClick = () => {
    if (!isAuthenticated) {
      openAuthModal({ message: SIGN_IN_TO_CONTACT });
      return;
    }
    setShowHireModal(true);
  };

  const loadProfile = useCallback(async () => {
    if (typeof userId !== 'string') return;
    setLoading(true);
    setNotFound(false);
    try {
      const { user, reviews: userReviews } = await getUserReviews(userId);
      setProfileUser(user);
      setReviews(userReviews);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!canHire || !viewer) return;
    getGigs({ status: 'open' })
      .then((gigs) => setMyOpenJobs(gigs.filter((g) => g.postedBy.id === viewer.id)))
      .catch(() => setMyOpenJobs([]));
  }, [canHire, viewer]);

  if (loading) {
    return <p className="text-center text-sm text-gray-400 py-10">Loading…</p>;
  }

  if (notFound || !profileUser) {
    return <p className="text-center text-sm text-gray-500 py-10">This user couldn't be found.</p>;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        {offerSent && (
          <div className="mb-6 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            {t('directHireModal.success')}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xl shrink-0">
                {profileUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold text-gray-900">{profileUser.name}</h1>
                  {profileUser.isVerifiedGraduate && <VerifiedGraduateBadge />}
                </div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{profileUser.role}</span>
              </div>
            </div>
            {showHireButton && (
              <button
                type="button"
                onClick={handleHireClick}
                className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                📩 კონტაქტი
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100">
            {profileUser.averageRating !== null ? (
              <>
                <StarRating value={profileUser.averageRating} size="sm" />
                <span className="text-sm font-semibold text-gray-900">{profileUser.averageRating.toFixed(1)}</span>
                <span className="text-sm text-gray-400">
                  ({profileUser.reviewCount} review{profileUser.reviewCount !== 1 ? 's' : ''})
                </span>
              </>
            ) : (
              <span className="text-sm text-gray-400">No reviews yet.</span>
            )}
          </div>
        </div>

        <h2 className="text-base font-semibold text-gray-900 mb-4">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-gray-500">No reviews to show yet.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StarRating value={review.rating} size="sm" />
                    <span className="text-xs text-gray-400">{REVIEW_TYPE_LABEL[review.type]}</span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-700 mt-3 leading-relaxed">{review.comment}</p>
                <p className="text-xs text-gray-400 mt-3">
                  {review.reviewer.name} · &ldquo;{review.gig.title}&rdquo;
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showHireModal && profileUser && (
        <DirectHireModal
          freelancerId={profileUser.id}
          freelancerName={profileUser.name}
          openJobs={myOpenJobs}
          onClose={() => setShowHireModal(false)}
          onSubmit={async (payload) => {
            await createDirectOffer(payload);
            setOfferSent(true);
          }}
        />
      )}
    </div>
  );
}

export default function ProfilePage() {
  return <ProfileContent />;
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common', 'proposals'])) },
});
