export type AdminRole = 'SUPER_ADMIN' | 'MANAGER' | 'MODERATOR';

// --- Core domain model ---
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'Client';
  readonly status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  isVerifiedGraduate: boolean;
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
  phone: string | null;
  payoutIban: string | null;
  // Set only via POST /auth/me/avatar (uploads to Bunny Storage) — never a
  // freely-settable URL, see Backend's routes/auth.ts. Doubles as the
  // company logo for Client accounts.
  avatarUrl: string | null;
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
  // null means not yet accepted — pre-existing accounts and every Google
  // sign-up (no separate consent step before account creation there) start
  // null; set via POST /auth/accept-terms. See TermsConsentModal.tsx.
  termsAcceptedAt: string | null;
}

export type VerificationStatus = 'unverified' | 'under_review' | 'verified';

export function getVerificationStatus(user: Pick<User, 'verificationDocUrl' | 'isVerified'>): VerificationStatus {
  if (user.isVerified) return 'verified';
  if (user.verificationDocUrl) return 'under_review';
  return 'unverified';
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
