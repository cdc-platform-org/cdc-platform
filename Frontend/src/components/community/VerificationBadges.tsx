import { useTranslation } from 'next-i18next';

export interface VerificationBadgeUser {
  isVerifiedGraduate: boolean;
  verificationLevel?: 'NONE' | 'INDIVIDUAL' | 'BUSINESS' | null;
  verificationStatus?: 'UNVERIFIED' | 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  isVerified?: boolean | null;
}

interface VerificationBadgesProps {
  user: VerificationBadgeUser;
  size?: 'sm' | 'md';
  className?: string;
}

// Multi-role verification badge set for profile cards, author lines, and
// public profile headers — a user can independently hold any combination
// of the three, since each is earned through a completely different track:
//   🎓 Student    — isVerifiedGraduate (completed a CDC course, or passed
//                   the freelancer exam — both write the same flag, see
//                   routes/courses.ts and routes/freelancerExam.ts).
//   ⚡ Freelancer — an approved INDIVIDUAL identity-verification submission
//                   (routes/adminVerifications.ts). Deliberately NOT
//                   isVerifiedGraduate OR'd in here (unlike Backend's
//                   hasFreelancerRights, which grants marketplace RIGHTS via
//                   either track) — as a display badge, Student and
//                   Freelancer are two distinct, independently-earned
//                   credentials, so a course graduate who has separately
//                   completed ID verification shows both chips rather than
//                   one badge standing in for two different things.
//   🏢 Business   — isVerified (approved BUSINESS verification,
//                   routes/adminCompanies.ts) — the single source of truth
//                   every business-only access check already reads.
// Exported so callers that need a fallback ("no verification badge at all"
// pill, e.g. profile/[userId].tsx's hasPurchasedCourse/standard tiers) can
// check eligibility without duplicating the three conditions above.
export function hasAnyVerificationBadge(user: VerificationBadgeUser): boolean {
  const isStudent = user.isVerifiedGraduate;
  const isFreelancer = user.verificationLevel === 'INDIVIDUAL' && user.verificationStatus === 'APPROVED';
  const isBusiness = !!user.isVerified;
  return isStudent || isFreelancer || isBusiness;
}

export default function VerificationBadges({ user, size = 'md', className = '' }: VerificationBadgesProps) {
  const { t } = useTranslation('common');

  const isStudent = user.isVerifiedGraduate;
  const isFreelancer = user.verificationLevel === 'INDIVIDUAL' && user.verificationStatus === 'APPROVED';
  const isBusiness = !!user.isVerified;

  if (!isStudent && !isFreelancer && !isBusiness) return null;

  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span className={`inline-flex items-center gap-1 flex-wrap ${className}`}>
      {isStudent && (
        <span
          className={`inline-flex items-center rounded-full font-semibold border border-cyan-400/70 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 ${sizeClass}`}
          title={t('verificationBadges.student')}
        >
          <span aria-hidden="true">🎓</span> {t('verificationBadges.student')}
        </span>
      )}
      {isFreelancer && (
        <span
          className={`inline-flex items-center rounded-full font-semibold border border-amber-400/70 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 ${sizeClass}`}
          title={t('verificationBadges.freelancer')}
        >
          <span aria-hidden="true">⚡</span> {t('verificationBadges.freelancer')}
        </span>
      )}
      {isBusiness && (
        <span
          className={`inline-flex items-center rounded-full font-semibold border border-indigo-400/70 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 ${sizeClass}`}
          title={t('verificationBadges.business')}
        >
          <span aria-hidden="true">🏢</span> {t('verificationBadges.business')}
        </span>
      )}
    </span>
  );
}
