import apiClient from './apiClient';
import { PaymentMethod, BillingHistory } from '../types/billing';

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