import apiClient from './apiClient';
import { Review, UserRatingSummary, UserReview } from '../types/review';

export interface CreateReviewPayload {
  gigId: string;
  rating: number;
  comment: string;
}

export async function createReview(payload: CreateReviewPayload): Promise<Review> {
  const response = await apiClient.post<{ data: Review }>('/reviews', payload);
  return response.data.data;
}

export async function getGigReviews(gigId: string): Promise<Review[]> {
  const response = await apiClient.get<{ data: Review[] }>(`/reviews/gig/${gigId}`);
  return response.data.data;
}

export async function getUserReviews(
  userId: string
): Promise<{ user: UserRatingSummary; reviews: UserReview[] }> {
  const response = await apiClient.get<{ data: { user: UserRatingSummary; reviews: UserReview[] } }>(
    `/reviews/user/${userId}`
  );
  return response.data.data;
}
