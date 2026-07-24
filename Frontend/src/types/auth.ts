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
}

export interface UpdateProfilePayload {
  legalFirstNameKa?: string | null;
  legalLastNameKa?: string | null;
  legalFirstNameEn?: string | null;
  legalLastNameEn?: string | null;
  nationalId?: string | null;
  phone?: string | null;
  payoutIban?: string | null;
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
}

export interface ForgotPasswordPayload {
  email: string;
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
