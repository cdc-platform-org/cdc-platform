import apiClient from './apiClient';

export interface CoursePaymentRow {
  id: string;
  bogOrderId: string;
  user: { id: string; name: string; email: string };
  courseId: string;
  courseTitle: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  createdAt: string;
  completedAt: string | null;
}

export async function getCoursePayments(params?: { page?: number; pageSize?: number; status?: string }): Promise<{
  data: CoursePaymentRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}> {
  const response = await apiClient.get('/admin/finance/course-payments', { params });
  return response.data;
}

export async function reverifyCoursePayment(paymentId: string): Promise<CoursePaymentRow> {
  const response = await apiClient.post<{ data: CoursePaymentRow }>(`/admin/finance/course-payments/${paymentId}/reverify`);
  return response.data.data;
}

export async function refundCoursePayment(paymentId: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(`/admin/finance/course-payments/${paymentId}/refund`);
  return response.data;
}

export async function grantCourseAccess(payload: { userEmail: string; courseId: string; note?: string }): Promise<void> {
  await apiClient.post('/admin/finance/course-access/grant', payload);
}

// --- Payouts ---
export interface PayoutRequestRow {
  id: string;
  amount: number;
  iban: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  user: { id: string; name: string; email: string; earningsBalance: number };
  reviewedBy: { id: string; name: string } | null;
}

export async function getPayoutRequests(status?: string): Promise<PayoutRequestRow[]> {
  const response = await apiClient.get<{ data: PayoutRequestRow[] }>('/admin/finance/payouts', { params: { status } });
  return response.data.data;
}

export async function approvePayoutRequest(id: string, adminNote?: string): Promise<{ message: string }> {
  const response = await apiClient.post(`/admin/finance/payouts/${id}/approve`, { adminNote });
  return response.data;
}

export async function rejectPayoutRequest(id: string, adminNote?: string): Promise<void> {
  await apiClient.post(`/admin/finance/payouts/${id}/reject`, { adminNote });
}

export async function markPayoutPaid(id: string): Promise<void> {
  await apiClient.post(`/admin/finance/payouts/${id}/mark-paid`);
}
