export type ReviewType = 'CLIENT_TO_FREELANCER' | 'FREELANCER_TO_CLIENT';

interface ReviewParticipant {
  id: string;
  name: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'Client';
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
  verificationLevel: 'NONE' | 'INDIVIDUAL' | 'BUSINESS';
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  isVerified: boolean;
  // Digital Store seller/creator reputation — separate rollup from the
  // gig-marketplace averageRating/reviewCount above (see ProductReview).
  sellerRating: number | null;
  sellerReviewCount: number;
  // "სტუდენტი" badge — has purchased at least one course but hasn't
  // completed one yet (isVerifiedGraduate, above, takes priority once true).
  hasPurchasedCourse: boolean;
}

export interface PublicVerifiedSkill {
  skillName: string;
  verifiedVia: 'AI_TEST' | 'COURSE_COMPLETION';
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
