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

// Public mentor directory — no auth required to browse.
export interface PublicMentor {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  mentorTitle: string | null;
  mentorHourlyRate: number | null; // minor units (tetri)
  mentorSkills: string[];
}

export async function getMentors(): Promise<PublicMentor[]> {
  const response = await apiClient.get<{ data: PublicMentor[] }>('/mentorship/mentors');
  return response.data.data;
}

// Concrete, real bookable ISO datetimes over the next `days` days — already
// excludes already-booked slots server-side.
export async function getMentorSlots(mentorId: string, days = 14): Promise<string[]> {
  const response = await apiClient.get<{ data: string[] }>(`/mentorship/mentors/${mentorId}/slots`, { params: { days } });
  return response.data.data;
}
