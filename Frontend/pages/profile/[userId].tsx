import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import StarRating from '../../src/components/community/StarRating';
import DirectHireModal from '../../src/components/community/DirectHireModal';
import SiteHeader from '../../src/components/layout/SiteHeader';
import BackButton from '../../src/components/common/BackButton';
import VerificationBadges, { hasAnyVerificationBadge } from '../../src/components/community/VerificationBadges';
import { ShieldCheck, GraduationCap } from 'lucide-react';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';
import { UserRatingSummary, UserReview, PublicVerifiedSkill } from '../../src/types/review';
import { Gig } from '../../src/types/community';
import { getUserReviews } from '../../src/services/reviewService';
import { getGigs } from '../../src/services/gigService';
import { createDirectOffer } from '../../src/services/directOfferService';

const ROLE_LABEL_KEY: Record<string, string> = {
  Student: 'roleStudent',
  Mentor: 'roleMentor',
  Client: 'roleClient',
  SuperAdmin: 'roleSuperAdmin',
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
  const [verifiedSkills, setVerifiedSkills] = useState<PublicVerifiedSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showHireModal, setShowHireModal] = useState(false);
  const [myOpenJobs, setMyOpenJobs] = useState<Gig[]>([]);
  const [offerSent, setOfferSent] = useState(false);

  const canHire =
    !!viewer &&
    (viewer.role === 'Client' || viewer.role === 'SuperAdmin') &&
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
      const { user, reviews: userReviews, verifiedSkills: skills } = await getUserReviews(userId);
      setProfileUser(user);
      setReviews(userReviews);
      setVerifiedSkills(skills);
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
    return <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-10">{t('profilePage.loading')}</p>;
  }

  if (notFound || !profileUser) {
    return <p className="text-center text-sm text-gray-500 dark:text-slate-400 py-10">{t('profilePage.notFound')}</p>;
  }

  const roleLabelKey = ROLE_LABEL_KEY[profileUser.role];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 px-4 py-10">
      <SiteHeader />
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <BackButton fallbackHref="/" />
        </div>
        {offerSent && (
          <div className="mb-6 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            {t('directHireModal.success')}
          </div>
        )}

        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-8 mb-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-semibold text-xl shrink-0">
                {profileUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{profileUser.name}</h1>
                  {hasAnyVerificationBadge(profileUser) ? (
                    <VerificationBadges user={profileUser} />
                  ) : profileUser.hasPurchasedCourse ? (
                    <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-500/10 dark:border-cyan-500/30">
                      {t('profilePage.studentBadge')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border text-gray-500 bg-gray-100 border-gray-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700">
                      {t('profilePage.standard')}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                  {roleLabelKey ? t(`profilePage.${roleLabelKey}`) : profileUser.role}
                </span>
              </div>
            </div>
            {showHireButton && (
              <button
                type="button"
                onClick={handleHireClick}
                className="shrink-0 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 px-6 py-3.5 text-sm font-bold text-white transition-opacity"
              >
                📩 {t('profilePage.contactButton')}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
            {profileUser.averageRating !== null ? (
              <>
                <StarRating value={profileUser.averageRating} size="sm" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{profileUser.averageRating.toFixed(1)}</span>
                <span className="text-sm text-gray-400 dark:text-slate-500">
                  ({t('profilePage.reviewCount', { count: profileUser.reviewCount })})
                </span>
              </>
            ) : (
              <span className="text-sm text-gray-400 dark:text-slate-500">{t('profilePage.noReviewsShort')}</span>
            )}
          </div>

          {profileUser.sellerReviewCount > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-2">{t('profilePage.sellerRating')}</p>
              <div className="flex items-center gap-3">
                <StarRating value={profileUser.sellerRating ?? 0} size="sm" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{profileUser.sellerRating?.toFixed(1)}</span>
                <span className="text-sm text-gray-400 dark:text-slate-500">
                  ({t('profilePage.reviewCount', { count: profileUser.sellerReviewCount })})
                </span>
              </div>
            </div>
          )}

          {verifiedSkills.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-2.5">{t('profilePage.verifiedSkills')}</p>
              <div className="flex flex-wrap gap-2">
                {verifiedSkills.map((skill) => (
                  <span
                    key={skill.skillName}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30"
                  >
                    {skill.verifiedVia === 'COURSE_COMPLETION' ? (
                      <GraduationCap className="w-3.5 h-3.5" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    {skill.skillName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{t('profilePage.reviewsHeading')}</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">{t('profilePage.noReviews')}</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StarRating value={review.rating} size="sm" />
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                      {t(review.type === 'CLIENT_TO_FREELANCER' ? 'profilePage.asFreelancer' : 'profilePage.asClient')}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-slate-500">{new Date(review.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-slate-300 mt-3 leading-relaxed">{review.comment}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-3">
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
