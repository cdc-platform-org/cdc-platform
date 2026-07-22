import apiClient from './apiClient';
import { AuthResponse, LoginPayload, RegisterPayload, User } from '../types/auth';

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

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/google', { idToken });
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
