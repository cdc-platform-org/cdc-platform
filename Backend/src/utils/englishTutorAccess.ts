// Access boundary for the AI English Tutor (Frontend's /dashboard/english-tutor)
// — a Student-facing B2C product, deliberately separate from
// utils/aiAgentsSuiteAccess.ts (Business/Client-only). See
// User.tutorSubscriptionTier's own schema comment for why this product
// doesn't reuse aiSubscriptionActive/BillingSubscription.
export interface EnglishTutorAccessUser {
  role: string;
  tutorSubscriptionTier: 'FREE' | 'PRO';
  // The cardless 5-day trial window (User.tutorTrialStartDate/
  // tutorTrialEndDate) — null when the student has never started it.
  tutorTrialEndDate: Date | null;
}

// SuperAdmin always has PRO-equivalent access, same posture as
// hasAiAgentsSuiteAccess — useful for QA/support without needing a real
// subscription row. Every other role (Student, Mentor, Client) can use the
// tutor; PRO-gating below depends on either a real subscription or an
// active cardless trial window.
export function hasEnglishTutorProAccess(user: EnglishTutorAccessUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'SuperAdmin') return true;
  if (user.tutorSubscriptionTier === 'PRO') return true;
  return !!user.tutorTrialEndDate && user.tutorTrialEndDate.getTime() > Date.now();
}
