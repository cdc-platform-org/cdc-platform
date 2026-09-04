import apiClient from './apiClient';

export type PromoApplicableType = 'ALL' | 'COURSE' | 'LIVE_TRAINING' | 'DIGITAL_PRODUCT' | 'AI_TOOL';

export interface PromoCode {
  id: string;
  code: string;
  discountPercent: number | null;
  discountAmount: number | null;
  applicableType: PromoApplicableType;
  applicableTargetIds: string[];
  isActive: boolean;
  expiresAt: string | null;
  maxUses: number | null;
  currentUses: number;
  createdAt: string;
}

export interface CreatePromoCodePayload {
  code: string;
  discountPercent?: number | null;
  discountAmount?: number | null;
  applicableType?: PromoApplicableType;
  applicableTargetIds?: string[];
  isActive?: boolean;
  expiresAt?: string | null;
  maxUses?: number | null;
}

export interface UpdatePromoCodePayload {
  discountPercent?: number | null;
  discountAmount?: number | null;
  applicableType?: PromoApplicableType;
  applicableTargetIds?: string[];
  isActive?: boolean;
  expiresAt?: string | null;
  maxUses?: number | null;
}

export async function getPromoCodes(): Promise<PromoCode[]> {
  const response = await apiClient.get<{ data: PromoCode[] }>('/admin/promos');
  return response.data.data;
}

export async function createPromoCode(payload: CreatePromoCodePayload): Promise<PromoCode> {
  const response = await apiClient.post<{ data: PromoCode }>('/admin/promos', payload);
  return response.data.data;
}

export async function updatePromoCode(id: string, payload: UpdatePromoCodePayload): Promise<PromoCode> {
  const response = await apiClient.put<{ data: PromoCode }>(`/admin/promos/${id}`, payload);
  return response.data.data;
}

export async function deletePromoCode(id: string): Promise<void> {
  await apiClient.delete(`/admin/promos/${id}`);
}
