// Shared by every route that gates freelancer-marketplace rights (gig
// applications, vacancy applications, product submission, unlimited forum
// posting) — a user qualifies via EITHER track independently: earning
// isVerifiedGraduate (passing a course/skill exam), or an admin-approved
// INDIVIDUAL identity verification (routes/adminVerifications.ts). Neither
// track sets the other's flag — this OR-check is the one place they merge,
// so a future third path only needs to be added here, not at every call site.
export function hasFreelancerRights(user: {
  isVerifiedGraduate: boolean;
  verificationLevel?: string | null;
  verificationStatus?: string | null;
}): boolean {
  return user.isVerifiedGraduate || (user.verificationLevel === 'INDIVIDUAL' && user.verificationStatus === 'APPROVED');
}
