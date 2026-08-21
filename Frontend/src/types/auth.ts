export type AdminRole = 'SUPER_ADMIN' | 'MANAGER' | 'MODERATOR';

// --- Core domain model ---
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'Client';
  readonly status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  isVerifiedGraduate: boolean;
  // Grants access to /admin/hr-requests's specialist-facing screens — see
  // the isHrSpecialist comment on the User model.
  isHrSpecialist: boolean;
  emailVerifiedAt: string | null;
  // Internal admin-team tier — separate from `role`. null means not on the
  // admin team at all (most users).
  adminRole: AdminRole | null;
  createdAt: string;
  // Legal identity fields (self-reported under /dashboard/settings) — used
  // for certificates and payout paperwork instead of the display `name`
  // when set. All optional.
  legalFirstNameKa: string | null;
  legalLastNameKa: string | null;
  legalFirstNameEn: string | null;
  legalLastNameEn: string | null;
  nationalId: string | null;
  // 11-digit Georgian personal ID, unique platform-wide — set via the
  // Individual verification tab. See the anti-fraud KYC comment on
  // Backend's User.personalNumber.
  personalNumber: string | null;
  phone: string | null;
  payoutIban: string | null;
  // Set only via POST /auth/me/avatar (uploads to Bunny Storage) — never a
  // freely-settable URL, see Backend's routes/auth.ts. Doubles as the
  // company logo for Client accounts.
  avatarUrl: string | null;
  // Set only via POST /auth/me/cv (uploads to Bunny Storage) — same field
  // an admin can also set for a Mentor via /admin/mentorship, see
  // Backend's routes/auth.ts. Used both on the profile settings page and
  // on the "View CV" button on applicant cards (ApplicationsReviewList).
  cvUrl: string | null;
  bio: string | null;
  // Business/employer profile — only meaningful for role Client.
  companyName: string | null;
  industry: string | null;
  websiteUrl: string | null;
  companyDescription: string | null;
  // Self-reported identification code (ს/კ) — compared against the AI-
  // parsed KYC document for auto-verification.
  taxId: string | null;
  // Business KYC — set only via POST /auth/me/verification-doc. Derive the
  // three-state badge from these two: no doc = Unverified, doc present but
  // not isVerified = Under Review, isVerified = Verified.
  verificationDocUrl: string | null;
  isVerified: boolean;
  // Which kind of verification (if any) this account has submitted — NONE
  // until a first submission. See Backend's adminVerifications.ts
  // (INDIVIDUAL) / adminCompanies.ts (BUSINESS).
  verificationLevel: 'NONE' | 'INDIVIDUAL' | 'BUSINESS';
  // Richer than isVerified alone (adds PENDING vs REJECTED) — for BUSINESS
  // always kept in sync with isVerified server-side (adminCompanies.ts);
  // for INDIVIDUAL, isVerified stays false even once APPROVED — see
  // hasFreelancerRights() on the Backend, the actual "is this an approved
  // individual verification" check, since isVerified is BUSINESS-only.
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  // Which onboarding path this account picked at registration — null for
  // accounts created before this field existed, or via Google/GitHub/
  // Facebook sign-up (those skip the 2-step onboarding flow).
  primaryIntent: 'TALENT' | 'EMPLOYER' | null;
  // null means not yet accepted — pre-existing accounts and every Google
  // sign-up (no separate consent step before account creation there) start
  // null; set via POST /auth/accept-terms. See TermsConsentModal.tsx.
  termsAcceptedAt: string | null;
  // AI Agents Suite (/dashboard/ai-tools) — a 7-day trial set the moment a
  // Business account is first verified, never reset by a later re-verify.
  // Distinct from the embeddable-chatbot Agent's own 60-day trial (a
  // separate product). See src/services/aiAgentsSuiteService.ts.
  trialStartDate: string | null;
  aiTrialEndsAt: string | null;
  aiSubscriptionActive: boolean;
  // Self-declared skills (src/data/freelancerSkills.ts values and/or custom
  // "Other" entries) — see SkillPicker.tsx. Only some are "Verified" (see
  // src/services/skillTestService.ts's GET /api/skill-tests/mine).
  freelancerSkills: string[];
}

export type VerificationStatus = 'unverified' | 'under_review' | 'verified';

export function getVerificationStatus(user: Pick<User, 'verificationDocUrl' | 'isVerified'>): VerificationStatus {
  if (user.isVerified) return 'verified';
  if (user.verificationDocUrl) return 'under_review';
  return 'unverified';
}

// Mirrors Backend's utils/freelancerVerification.ts's hasFreelancerRights()
// exactly — used purely for the "Verified"/"Standard" trust badge now (soft
// nudge, not a hard gate, on proposal/vacancy submission), so this needs to
// stay in lockstep with the Backend version, not drift into its own logic.
export function isFreelancerVerified(user: Pick<User, 'isVerifiedGraduate' | 'verificationLevel' | 'verificationStatus'>): boolean {
  return user.isVerifiedGraduate || (user.verificationLevel === 'INDIVIDUAL' && user.verificationStatus === 'APPROVED');
}

export interface UpdateProfilePayload {
  name?: string;
  bio?: string | null;
  legalFirstNameKa?: string | null;
  legalLastNameKa?: string | null;
  legalFirstNameEn?: string | null;
  legalLastNameEn?: string | null;
  nationalId?: string | null;
  phone?: string | null;
  payoutIban?: string | null;
  companyName?: string | null;
  industry?: string | null;
  websiteUrl?: string | null;
  companyDescription?: string | null;
  taxId?: string | null;
  freelancerSkills?: string[];
  // Re-editable any time (unlike registration's one-shot pick) — only
  // changes which dashboard.tsx unlock-card is highlighted first, never a
  // capability gate. See Backend's schemas/authSchemas.ts.
  primaryIntent?: 'TALENT' | 'EMPLOYER';
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

// --- Request payloads ---
export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  // Public registration only ever grants Student or Client — see
  // Backend's schemas/authSchemas.ts. Omit to default to Student.
  role?: 'Student' | 'Client';
  // Which onboarding path was picked in register.tsx's Step 1 — purely
  // descriptive, doesn't change `role`'s validation.
  primaryIntent?: 'TALENT' | 'EMPLOYER';
  // Only meaningful for a Freelancer sub-role signup — see register.tsx.
  freelancerSkills?: string[];
  // Must be true — the backend rejects anything else (z.literal(true)).
  acceptedTerms: boolean;
}

export interface ForgotPasswordPayload {
  email: string;
  lang?: 'ka' | 'en';
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

// --- API response shape ---
export interface AuthResponse {
  user: User;
  token: string;
}
