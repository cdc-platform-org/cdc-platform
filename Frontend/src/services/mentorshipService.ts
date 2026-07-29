import apiClient from './apiClient';

export interface MentorshipRequest {
  id: string;
  message: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
}

export async function createMentorshipRequest(message: string): Promise<MentorshipRequest> {
  const response = await apiClient.post<{ data: MentorshipRequest }>('/mentorship', { message });
  return response.data.data;
}

export async function getMyMentorshipRequests(): Promise<MentorshipRequest[]> {
  const response = await apiClient.get<{ data: MentorshipRequest[] }>('/mentorship/mine');
  return response.data.data;
}
