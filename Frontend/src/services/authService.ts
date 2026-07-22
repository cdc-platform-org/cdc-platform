import apiClient from './apiClient';
import { AuthResponse, LoginPayload, RegisterPayload, User, ForgotPasswordPayload, ResetPasswordPayload } from '../types/auth';

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
