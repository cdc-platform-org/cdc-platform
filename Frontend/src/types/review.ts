export type ReviewType = 'CLIENT_TO_FREELANCER' | 'FREELANCER_TO_CLIENT';

interface ReviewParticipant {
  id: string;
  name: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'EnterpriseClient';
}

export interface Review {
  id: string;
  gigId: string;
  reviewer: ReviewParticipant;
  reviewee: ReviewParticipant;
  rating: number;
  comment: string;
  type: ReviewType;
  createdAt: string;
}

export interface UserRatingSummary {
  id: string;
  name: string;
  role: ReviewParticipant['role'];
  averageRating: number | null;
  reviewCount: number;
  isVerifiedGraduate: boolean;
}

export interface UserReview {
  id: string;
  rating: number;
  comment: string;
  type: ReviewType;
  createdAt: string;
  reviewer: ReviewParticipant;
  gig: { id: string; title: string };
}
