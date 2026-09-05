import apiClient from './apiClient';

export interface CoursePaymentRow {
  id: string;
  gateway: 'BOG' | 'STRIPE';
  bogOrderId: string;
  user: { id: string; name: string; email: string };
  purpose: 'COURSE' | 'MENTORSHIP' | 'GIG_ESCROW_FUNDING';
  courseId: string;
  courseTitle: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  createdAt: string;
  completedAt: string | null;
}

export async function getCoursePayments(params?: { page?: number; pageSize?: number; status?: string; purpose?: string }): Promise<{
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

export async function reverifyStripePayment(paymentId: string): Promise<CoursePaymentRow> {
  const response = await apiClient.post<{ data: CoursePaymentRow }>(`/admin/finance/course-payments/${paymentId}/reverify-stripe`);
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
  status: 'PENDING' | 'APPROVED' | 'PROCESSING' | 'REJECTED' | 'PAID' | 'FAILED';
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  // Locked in at creation time by bogPayoutService.evaluateRiskTier (see
  // Backend/src/services/bogPayoutService.ts) — riskTier/riskReasons never
  // change after the request is created, autoApproved only flips true if
  // the (not yet cron-wired) auto-approval sweep actually claims it.
  riskTier: 'LOW' | 'MANUAL_REVIEW';
  riskReasons: string[];
  autoApproved: boolean;
  requestIp: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    earningsBalance: number;
    payoutIbanUpdatedAt: string | null;
    // Most recent LoginEvent on record for this account — a lightweight
    // "usual IP" reference point for comparing against requestIp, not a
    // claim that it's the ONLY IP this account has ever used from (see
    // Backend/src/routes/adminPayouts.ts's own comment).
    loginEvents: { ip: string; userAgent: string | null; createdAt: string }[];
  };
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

// --- Billing settings (unified SaaS billing engine's pricing knobs + the
// manual bank-transfer alternative shown in PaymentMethodsCard.tsx) ---
export interface AdminBillingSettings {
  baseFeeTetri: number;
  marginMultiplier: number;
  trialDays: number;
  bankTransferIban: string | null;
  bankTransferBankName: string | null;
  bankTransferAccountName: string | null;
}

export async function getAdminBillingSettings(): Promise<AdminBillingSettings> {
  const response = await apiClient.get<{ data: AdminBillingSettings }>('/admin/finance/billing-settings');
  return response.data.data;
}

// Empty string clears a bank-transfer field back to "not configured" (see
// Backend's adminFinance.ts PUT handler) — the other two fields are left
// undefined entirely on a call that only clears the IBAN elsewhere, so
// they're each optional here too.
export async function updateAdminBillingSettings(payload: {
  bankTransferIban?: string;
  bankTransferBankName?: string;
  bankTransferAccountName?: string;
}): Promise<AdminBillingSettings> {
  const response = await apiClient.put<{ data: AdminBillingSettings }>('/admin/finance/billing-settings', payload);
  return response.data.data;
}
