import apiClient from './apiClient';

export type GiftCardDesign = 'classic' | 'birthday' | 'celebration' | 'kids';
export type GiftCardStatus = 'PENDING_PAYMENT' | 'SCHEDULED' | 'DELIVERED' | 'CANCELLED';

export interface GiftCardConfig {
  presetsGel: number[];
  minGel: number;
  maxGel: number;
  designs: GiftCardDesign[];
  validityDays: number;
}

// Amounts are tetri (minor units), like every other money field in the API.
export interface MyGiftCard {
  id: string;
  amount: number;
  status: GiftCardStatus;
  senderName: string;
  recipientName: string;
  recipientEmail: string | null;
  message: string | null;
  design: GiftCardDesign;
  deliverAt: string;
  deliveredAt: string | null;
  suggestedItem: string | null;
  suggestedUrl: string | null;
  createdAt: string;
  complimentary?: boolean;
  recipientType?: 'PERSON' | 'ORGANIZATION';
  code: string | null;
  balance: number | null;
  expiresAt: string | null;
  isActive: boolean | null;
}

export interface GiftCardBalance {
  code: string;
  initialAmount: number;
  balance: number;
  expiresAt: string | null;
  isActive: boolean;
  recipientName: string;
  senderName: string;
  message: string | null;
  design: GiftCardDesign;
  suggestedItem: string | null;
  suggestedUrl: string | null;
}

export interface GiftCardCheckoutInput {
  amountGel: number;
  senderName: string;
  recipientName: string;
  recipientEmail: string | null;
  message: string | null;
  design: GiftCardDesign;
  deliverAt: string | null;
  suggestedItem: string | null;
  suggestedUrl: string | null;
  lang?: string;
}

export async function getGiftCardConfig(): Promise<GiftCardConfig> {
  const res = await apiClient.get<{ data: GiftCardConfig }>('/gift-cards/config');
  return res.data.data;
}

export async function checkoutGiftCard(input: GiftCardCheckoutInput): Promise<{ paymentId: string; giftCardId: string; redirectUrl: string }> {
  const res = await apiClient.post('/payments/checkout/gift-card', input);
  return res.data;
}

export async function getMyGiftCards(): Promise<MyGiftCard[]> {
  const res = await apiClient.get<{ data: MyGiftCard[] }>('/gift-cards/my');
  return res.data.data;
}

export async function getMyGiftCard(id: string): Promise<MyGiftCard> {
  const res = await apiClient.get<{ data: MyGiftCard }>(`/gift-cards/my/${id}`);
  return res.data.data;
}

export async function resendGiftCard(id: string, recipientEmail?: string | null): Promise<MyGiftCard> {
  const res = await apiClient.post<{ data: MyGiftCard }>(`/gift-cards/my/${id}/resend`, { recipientEmail: recipientEmail || null });
  return res.data.data;
}

export async function checkGiftCardBalance(code: string): Promise<GiftCardBalance> {
  const res = await apiClient.get<{ data: GiftCardBalance }>('/gift-cards/balance', { params: { code } });
  return res.data.data;
}

export interface AdminGiftCard extends MyGiftCard {
  uses: number;
  purchaser: { id: string; name: string; email: string };
}

export interface AdminGiftCardTotals {
  soldCount: number;
  soldAmount: number;
  complimentaryCount: number;
  complimentaryAmount: number;
  outstandingBalance: number;
}

export async function getAdminGiftCards(): Promise<{ data: AdminGiftCard[]; totals: AdminGiftCardTotals }> {
  const res = await apiClient.get('/admin/gift-cards');
  return res.data;
}

export interface IssueGiftCardInput {
  amountGel: number;
  senderName: string;
  recipientName: string;
  recipientType: 'PERSON' | 'ORGANIZATION';
  recipientEmail: string | null;
  message: string | null;
  design: GiftCardDesign;
  deliverAt: string | null;
}

// Admin: free gift card, no payment.
export async function issueComplimentaryGiftCard(input: IssueGiftCardInput): Promise<MyGiftCard> {
  const res = await apiClient.post<{ data: MyGiftCard }>('/admin/gift-cards', input);
  return res.data.data;
}

export async function deliverGiftCardNow(id: string): Promise<void> {
  await apiClient.post(`/admin/gift-cards/${id}/deliver-now`);
}

export function formatGel(tetri: number): string {
  const gel = tetri / 100;
  return Number.isInteger(gel) ? `${gel}` : gel.toFixed(2);
}
