import apiClient from './apiClient';
import { DirectOffer } from '../types/directOffer';

export interface CreateDirectOfferPayload {
  freelancerId: string;
  gigId?: string;
  title: string;
  description: string;
  budgetAmount: number;
  currency: string;
  message: string;
}

export async function createDirectOffer(payload: CreateDirectOfferPayload): Promise<DirectOffer> {
  const response = await apiClient.post<{ data: DirectOffer }>('/direct-offers', payload);
  return response.data.data;
}

export async function getDirectOffers(): Promise<DirectOffer[]> {
  const response = await apiClient.get<{ data: DirectOffer[] }>('/direct-offers');
  return response.data.data;
}
