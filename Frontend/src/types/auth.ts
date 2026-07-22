export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR';

// --- Core domain model ---
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'EnterpriseClient';
  readonly status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  isVerifiedGraduate: boolean;
  emailVerifiedAt: string | null;
  // Internal admin-team tier — separate from `role`. null means not on the
  // admin team at all (most users).
  adminRole: AdminRole | null;
  createdAt: string;
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
}

// --- API response shape ---
export interface AuthResponse {
  user: User;
  token: string;
}
