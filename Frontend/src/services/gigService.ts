import apiClient from './apiClient';
import { Gig, GigApplication, MyGig, AssignedGig } from '../types/community';

export interface GigFilters {
  skills?: string[];
  budgetType?: string;
  status?: string;
}

export async function getGigs(filters?: GigFilters): Promise<Gig[]> {
  const response = await apiClient.get<Gig[]>('/gigs', { params: filters });
  return response.data;
}

export async function getGigById(id: string): Promise<Gig> {
  const response = await apiClient.get<Gig>(`/gigs/${id}`);
  return response.data;
}

// Client Portal — gigs the caller posted, with escrow/invoice info attached.
export async function getMyGigs(): Promise<MyGig[]> {
  const response = await apiClient.get<MyGig[]>('/gigs/mine');
  return response.data;
}

export async function getAssignedGigs(): Promise<AssignedGig[]> {
  const response = await apiClient.get<AssignedGig[]>('/gigs/assigned-to-me');
  return response.data;
}

export async function requestMentorHelp(gigId: string): Promise<AssignedGig> {
  const response = await apiClient.post<AssignedGig>(`/gigs/${gigId}/request-mentor-help`);
  return response.data;
}

export type PostGigPayload = Omit<
  Gig,
  | 'id'
  | 'postedBy'
  | 'status'
  | 'assignedFreelancerId'
  | 'assignedFreelancer'
  | 'applicationsCount'
  | 'submittedAt'
  | 'deliveryComment'
  | 'deliveryFiles'
  | 'deliveryLinks'
  | 'postedAt'
>;

export async function postGig(payload: PostGigPayload): Promise<Gig> {
  const response = await apiClient.post<Gig>('/gigs', payload);
  return response.data;
}

// --- Freelancer side ---
export async function applyToGig(
  gigId: string,
  payload: { proposalNote: string; bidAmount: number; deliveryDays: number }
): Promise<GigApplication> {
  const response = await apiClient.post<GigApplication>(`/gigs/${gigId}/apply`, payload);
  return response.data;
}

export async function submitGigWork(
  gigId: string,
  payload: { comment: string; files?: string[]; links?: string[] }
): Promise<Gig> {
  const response = await apiClient.post<Gig>(`/gigs/${gigId}/submit`, payload);
  return response.data;
}

export interface GigApprovalResult {
  gig: Gig;
  transaction: {
    id: string;
    status: string;
    netAmount: number;
    commissionAmount: number;
    releasedAt: string;
  };
}

// Client approves delivered work — releases escrow (10% platform fee, 90% net
// to the freelancer) and marks the gig completed.
export async function approveGigWork(gigId: string): Promise<GigApprovalResult> {
  const response = await apiClient.post<GigApprovalResult>(`/gigs/${gigId}/approve`);
  return response.data;
}

// --- Poster side ---
export async function getGigApplications(gigId: string): Promise<GigApplication[]> {
  const response = await apiClient.get<GigApplication[]>(`/gigs/${gigId}/applications`);
  return response.data;
}

export async function approveGigApplication(
  gigId: string,
  applicationId: string
): Promise<Gig> {
  const response = await apiClient.post<Gig>(
    `/gigs/${gigId}/applications/${applicationId}/approve`
  );
  return response.data;
}

export async function rejectGigApplication(
  gigId: string,
  applicationId: string
): Promise<GigApplication> {
  const response = await apiClient.post<GigApplication>(
    `/gigs/${gigId}/applications/${applicationId}/reject`
  );
  return response.data;
}