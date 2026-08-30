import apiClient from './apiClient';
import { AdminUser } from '../types/admin';

export async function getAdminUsers(status?: AdminUser['status']): Promise<AdminUser[]> {
  const response = await apiClient.get<AdminUser[]>('/admin/users', { params: status ? { status } : undefined });
  return response.data;
}

export async function approveUser(userId: string): Promise<AdminUser> {
  const response = await apiClient.post<AdminUser>(`/admin/users/${userId}/approve`);
  return response.data;
}

export async function rejectUser(userId: string, reason?: string): Promise<AdminUser> {
  const response = await apiClient.post<AdminUser>(`/admin/users/${userId}/reject`, { reason });
  return response.data;
}

export async function verifyGraduate(userId: string): Promise<AdminUser> {
  const response = await apiClient.post<AdminUser>(`/admin/users/${userId}/verify-graduate`);
  return response.data;
}

export async function unverifyGraduate(userId: string): Promise<AdminUser> {
  const response = await apiClient.post<AdminUser>(`/admin/users/${userId}/unverify-graduate`);
  return response.data;
}

export async function setHrSpecialist(userId: string): Promise<AdminUser> {
  const response = await apiClient.post<AdminUser>(`/admin/users/${userId}/set-hr-specialist`);
  return response.data;
}

// Returns only the two changed fields (Backend/routes/admin.ts's PATCH
// .../educator-vip response shape), not a full AdminUser — callers must
// merge this into existing row state rather than passing it to runAction's
// wholesale-replace helper (see admin/users.tsx's handleToggleEducatorVip).
export async function updateEducatorVip(userId: string, active: boolean): Promise<{ id: string; educatorVipActive: boolean }> {
  const response = await apiClient.patch<{ data: { id: string; educatorVipActive: boolean } }>(`/admin/users/${userId}/educator-vip`, { active });
  return response.data.data;
}

export async function unsetHrSpecialist(userId: string): Promise<AdminUser> {
  const response = await apiClient.post<AdminUser>(`/admin/users/${userId}/unset-hr-specialist`);
  return response.data;
}

export async function banUser(userId: string, reason?: string): Promise<AdminUser> {
  const response = await apiClient.post<AdminUser>(`/admin/users/${userId}/ban`, { reason });
  return response.data;
}

export async function unbanUser(userId: string): Promise<AdminUser> {
  const response = await apiClient.post<AdminUser>(`/admin/users/${userId}/unban`);
  return response.data;
}

export async function updateUserRole(userId: string, role: AdminUser['role']): Promise<AdminUser> {
  const response = await apiClient.patch<AdminUser>(`/admin/users/${userId}/role`, { role });
  return response.data;
}

export async function updateUserStatus(userId: string, status: AdminUser['status'], reason?: string): Promise<AdminUser> {
  const response = await apiClient.patch<AdminUser>(`/admin/users/${userId}/status`, { status, reason });
  return response.data;
}

// Sends the user the same password-reset email their own "Forgot password?"
// flow would — support-initiated, never sets/reveals an actual password.
export async function sendAdminPasswordReset(userId: string): Promise<void> {
  await apiClient.post(`/admin/users/${userId}/reset-password`);
}
