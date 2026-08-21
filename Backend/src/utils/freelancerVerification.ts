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

// Used ONLY where real money is about to leave the platform (wallet payout
// requests) — everywhere else (submitting a proposal, applying to a
// vacancy) is deliberately a soft nudge, not a hard gate: a "Standard" vs
// "Verified" badge lets a client self-select, rather than the platform
// blocking submission outright. Payout is the one moment an unverified
// identity is an actual fraud risk, so it's the one place this still
// blocks. Any approved verification track counts — individual, graduate,
// or business — not just the freelancer-specific OR above.
export function isIdentityVerified(user: {
  isVerifiedGraduate: boolean;
  verificationLevel?: string | null;
  verificationStatus?: string | null;
  isVerified?: boolean;
}): boolean {
  return hasFreelancerRights(user) || !!user.isVerified;
}

// Raw message matched by Frontend/src/utils/apiErrorMessages.ts's
// classifyApiError -> shown as the "ვერიფიკაცია აუცილებელია" modal.
export const VERIFICATION_REQUIRED_TO_POST_MESSAGE =
  'Account verification is required before you can publish a listing.';

// Gates gig/vacancy POST / — any approved verification track (individual,
// graduate, or business) satisfies this, same breadth as isIdentityVerified,
// since a vacancy poster is typically business-verified while a gig poster
// is typically individual/graduate-verified and this check has to cover
// both listing types with one rule. Admin-team members and SuperAdmin bypass
// it entirely, same as the existing monthly-post-limit exemption on both
// routes.
export async function canPostListing(
  prisma: { user: { findUnique: (args: any) => Promise<any> } },
  userId: string,
  role: string
): Promise<boolean> {
  if (role === 'SuperAdmin') return true;
  const poster = await prisma.user.findUnique({
    where: { id: userId },
    select: { isVerifiedGraduate: true, verificationLevel: true, verificationStatus: true, isVerified: true, adminRole: true },
  });
  return !!poster && (isIdentityVerified(poster) || !!poster.adminRole);
}
