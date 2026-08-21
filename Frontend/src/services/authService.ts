import apiClient from './apiClient';
import {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  User,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  UpdateProfilePayload,
  ChangePasswordPayload,
} from '../types/auth';

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/login', payload);
  return response.data;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/register', payload);
  return response.data;
}

export interface DeleteAccountPayload {
  password?: string;
  confirmText?: string;
}

export interface DeleteAccountResponse {
  message: string;
  deletionRequestedAt: string;
  permanentDeletionAt: string;
}

export async function deleteAccount(payload: DeleteAccountPayload): Promise<DeleteAccountResponse> {
  const response = await apiClient.post<DeleteAccountResponse>('/auth/delete-account', payload);
  return response.data;
}

export async function loginWithGoogle(idToken: string, role?: 'Student' | 'Client'): Promise<AuthResponse> {
  // role only matters for brand-new accounts (see Backend's routes/auth.ts
  // POST /google) — ignored if this Google identity already has an account.
  const response = await apiClient.post<AuthResponse>('/auth/google', { idToken, role });
  return response.data;
}

export async function verifyEmail(token: string): Promise<{ message: string; user: User }> {
  const response = await apiClient.post('/auth/verify-email', { token });
  return response.data;
}

export async function resendVerificationEmail(): Promise<{ message: string }> {
  const response = await apiClient.post('/auth/resend-verification');
  return response.data;
}

export async function forgotPassword(payload: ForgotPasswordPayload): Promise<{ message: string }> {
  const response = await apiClient.post('/auth/forgot-password', payload);
  return response.data;
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<{ message: string }> {
  const response = await apiClient.post('/auth/reset-password', payload);
  return response.data;
}

export async function getMe(options?: { silent401?: boolean }): Promise<User> {
  const response = await apiClient.get<{ user: User }>('/auth/me', { silent401: options?.silent401 });
  return response.data.user;
}

export async function acceptTerms(): Promise<User> {
  const response = await apiClient.post<{ user: User }>('/auth/accept-terms');
  return response.data.user;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<User> {
  const response = await apiClient.put<{ user: User }>('/auth/me', payload);
  return response.data.user;
}

export async function changePassword(payload: ChangePasswordPayload): Promise<{ message: string }> {
  const response = await apiClient.put('/auth/me/password', payload);
  return response.data;
}

export async function uploadAvatar(file: File): Promise<User> {
  const formData = new FormData();
  formData.append('avatar', file);
  const response = await apiClient.post<{ user: User }>('/auth/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.user;
}

export async function uploadCv(file: File): Promise<User> {
  const formData = new FormData();
  formData.append('cv', file);
  const response = await apiClient.post<{ user: User }>('/auth/me/cv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.user;
}

export async function uploadVerificationDoc(file: File): Promise<User> {
  const formData = new FormData();
  formData.append('document', file);
  const response = await apiClient.post<{ user: User }>('/auth/me/verification-doc', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.user;
}

// INDIVIDUAL-level counterpart to uploadVerificationDoc above (BUSINESS) —
// an ID card/passport scan, always lands PENDING for manual admin review
// (see Backend's routes/auth.ts, no auto-approve heuristic exists for a
// personal ID the way businessKycService.ts has one for a registry extract).
// personalNumber (11-digit Georgian ID) is submitted in the same request as
// the document itself — see the anti-fraud KYC comment on Backend's
// routes/auth.ts's /me/individual-verification-doc for why.
export async function uploadIndividualVerificationDoc(file: File, personalNumber: string): Promise<User> {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('personalNumber', personalNumber);
  const response = await apiClient.post<{ user: User }>('/auth/me/individual-verification-doc', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.user;
}
