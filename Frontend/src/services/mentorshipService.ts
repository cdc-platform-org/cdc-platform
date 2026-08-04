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

// Recurring weekly slots a mentor is bookable for (set in /admin/mentorship)
// — for a paid-session booking UI to render as selectable times. The
// checkout call re-validates the chosen time server-side regardless.
export interface MentorAvailabilityRule {
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  startMinute: number;
  endMinute: number;
}

export async function getMentorAvailability(mentorId: string): Promise<MentorAvailabilityRule[]> {
  const response = await apiClient.get<{ data: MentorAvailabilityRule[] }>(`/mentorship/mentors/${mentorId}/availability`);
  return response.data.data;
}
