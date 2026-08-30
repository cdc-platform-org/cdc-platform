// Access boundary for the AI Educator VIP Hub (Frontend's
// /dashboard/tools/educator-hub) — a Teacher-facing B2C product, open to any
// role (no dedicated Teacher role exists in this app — see the Role enum).
// Deliberately separate from utils/aiAgentsSuiteAccess.ts (Client-only) and
// utils/englishTutorAccess.ts (a different Student-facing product). See
// User.educatorVipActive's own schema comment for why this product doesn't
// reuse either of those flags.
export interface EducatorVipAccessUser {
  role: string;
  educatorVipActive: boolean;
  // The cardless 5-day trial window (User.educatorVipTrialStartDate/
  // educatorVipTrialEndDate) — null when the teacher has never started it.
  educatorVipTrialEndDate: Date | null;
}

// SuperAdmin always has VIP-equivalent access, same posture as
// hasAiAgentsSuiteAccess/hasEnglishTutorProAccess — useful for QA/support
// without needing a real grant. Every other role can use the free "Coming
// Soon" tabs; VIP-gating below (real generation, grading, usage meter)
// depends on either an admin grant or an active cardless trial window.
export function hasEducatorVipAccess(user: EducatorVipAccessUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'SuperAdmin') return true;
  if (user.educatorVipActive) return true;
  return !!user.educatorVipTrialEndDate && user.educatorVipTrialEndDate.getTime() > Date.now();
}
