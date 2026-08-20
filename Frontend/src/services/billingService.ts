import apiClient from './apiClient';
import { PaymentMethod, AddPaymentMethodPayload, BillingHistory, BillingSubscription, BillingSettings } from '../types/billing';

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const response = await apiClient.get<PaymentMethod[]>('/billing/payment-methods');
  return response.data;
}

// Step 1 of adding a card — mints a Stripe SetupIntent client secret for
// this user (creating their Stripe Customer on first use). Confirm it
// client-side with Stripe.js/Elements, then call addPaymentMethod below
// with the resulting PaymentMethod id.
export async function createCardSetupIntent(): Promise<string> {
  const response = await apiClient.post<{ data: { clientSecret: string } }>('/billing/setup-intent');
  return response.data.data.clientSecret;
}

export async function addPaymentMethod(payload: AddPaymentMethodPayload): Promise<PaymentMethod> {
  const response = await apiClient.post<PaymentMethod>('/billing/payment-methods', payload);
  return response.data;
}

export async function setDefaultPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
  const response = await apiClient.patch<PaymentMethod>(`/billing/payment-methods/${paymentMethodId}/default`);
  return response.data;
}

// A card backing a live auto-renewing subscription can't be silently
// removed — the backend 409s with the affected subscriptions the first
// time, and only proceeds once resent with confirmCancelAutoRenew: true.
// The caller (PaymentMethodsCard) surfaces that list and re-calls this with
// confirmCancelAutoRenew set once the user has actually seen it.
export async function removePaymentMethod(paymentMethodId: string, confirmCancelAutoRenew = false): Promise<void> {
  await apiClient.delete(`/billing/payment-methods/${paymentMethodId}`, { data: { confirmCancelAutoRenew } });
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