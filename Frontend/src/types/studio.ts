export type StudioInquiryStatus = 'PENDING' | 'IN_REVIEW' | 'ACCEPTED' | 'DECLINED';

export interface StudioInquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  projectType: string;
  budgetRange: string | null;
  message: string;
  status: StudioInquiryStatus;
  adminNote: string | null;
  reviewedById: string | null;
  reviewedBy: { id: string; name: string } | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface CreateStudioInquiryPayload {
  name: string;
  email: string;
  phone: string;
  company: string;
  projectType: string;
  budgetRange: string;
  message: string;
}

export interface UpdateStudioInquiryPayload {
  status?: StudioInquiryStatus;
  adminNote?: string;
}
