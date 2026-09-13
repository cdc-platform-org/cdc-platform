import apiClient from './apiClient';

export type RatingTarget = 'courses' | 'live-trainings';

export interface LearningReview {
  id: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string };
}

export interface LearningRatings {
  averageRating: number | null;
  reviewCount: number;
  reviews: LearningReview[];
  myReview: LearningReview | null;
  canReview: boolean;
}

export async function getLearningRatings(target: RatingTarget, id: string): Promise<LearningRatings> {
  const response = await apiClient.get<{ data: LearningRatings }>(`/${target}/${encodeURIComponent(id)}/ratings`);
  return response.data.data;
}

export async function saveLearningRating(target: RatingTarget, id: string, rating: number, comment: string): Promise<void> {
  await apiClient.put(`/${target}/${encodeURIComponent(id)}/ratings`, { rating, comment: comment.trim() || null });
}
