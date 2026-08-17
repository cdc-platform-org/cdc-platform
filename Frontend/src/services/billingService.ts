import apiClient from './apiClient';
import { PaymentMethod, BillingHistory, BillingSubscription, BillingSettings } from '../types/billing';

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const response = await apiClient.get<PaymentMethod[]>('/billing/payment-methods');
  return response.data;
}

export async function removePaymentMethod(paymentMethodId: string): Promise<void> {
  await apiClient.delete(`/billing/payment-methods/${paymentMethodId}`);
}

export async function getBillingHistory(page = 1, pageSize = 10): Promise<BillingHistory> {
  const response = await apiClient.get<BillingHistory>('/billing/invoices', {
    params: { page, pageSize },
  });
  return response.data;
}

export async function getInvoiceDownloadUrl(invoiceId: string): Promise<string> {
  const response = await apiClient.get<{ url: string }>(`/billing/invoices/${invoiceId}/download`);
  return response.data.url;
}

// ============================================================
// Unified SaaS billing engine — Dashboard > Billing widget (base fee +
// live usage-metered total) and the "current cycle" PDF statement.
// ============================================================

export async function getMySubscriptions(): Promise<BillingSubscription[]> {
  const response = await apiClient.get<{ data: BillingSubscription[] }>('/billing/subscriptions');
  return response.data.data;
}

export async function getBillingSettings(): Promise<BillingSettings> {
  const response = await apiClient.get<{ data: BillingSettings }>('/billing/settings');
  return response.data.data;
}

export async function setSubscriptionAutoRenew(subscriptionId: string, autoRenew: boolean): Promise<BillingSubscription> {
  const response = await apiClient.patch<BillingSubscription>(`/billing/subscriptions/${subscriptionId}/auto-renew`, { autoRenew });
  return response.data;
}

// Current-cycle PDF statement — an ESTIMATE, not a real paid invoice, since
// no real payment gateway is wired up yet (see Backend's
// paymentGatewayService.ts). Same blob-download pattern as
// paymentService.downloadInvoice.
export async function downloadSubscriptionInvoice(subscriptionId: string): Promise<Blob> {
  const response = await apiClient.get(`/invoices/subscription/${subscriptionId}/download`, { responseType: 'blob' });
  return response.data;
}