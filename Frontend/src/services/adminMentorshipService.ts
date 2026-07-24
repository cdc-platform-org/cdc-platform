import apiClient from './apiClient';

interface MentorshipUser {
  id: string;
  name: string;
  email: string;
}

export interface MentorshipGig {
  id: string;
  title: string;
  description: string;
  status: string;
  deliveryComment: string | null;
  deliveryFiles: string[];
  deliveryLinks: string[];
  mentorHelpRequestedAt: string | null;
  isFirstOrder: boolean;
  postedBy: MentorshipUser;
  assignedFreelancer: MentorshipUser | null;
}

export async function getMentorshipQueue(): Promise<MentorshipGig[]> {
  const response = await apiClient.get<{ data: MentorshipGig[] }>('/admin/mentorship/queue');
  return response.data.data;
}

export async function getMentorshipGig(gigId: string): Promise<MentorshipGig> {
  const response = await apiClient.get<{ data: MentorshipGig }>(`/admin/mentorship/gigs/${gigId}`);
  return response.data.data;
}

export async function dismissMentorshipRequest(gigId: string): Promise<void> {
  await apiClient.post(`/admin/mentorship/gigs/${gigId}/dismiss`);
}
