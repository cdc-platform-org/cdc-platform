import apiClient from './apiClient';

export interface MentorshipUser {
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

// General "დახმარება / მენტორობა" requests from the Dashboard button — not
// tied to any specific gig.
export interface MentorshipHelpRequest {
  id: string;
  message: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  user: MentorshipUser;
}

export async function getMentorshipRequests(): Promise<MentorshipHelpRequest[]> {
  const response = await apiClient.get<{ data: MentorshipHelpRequest[] }>('/admin/mentorship/requests');
  return response.data.data;
}

export async function resolveMentorshipRequest(requestId: string): Promise<void> {
  await apiClient.post(`/admin/mentorship/requests/${requestId}/resolve`);
}

// --- Mentor availability rules (recurring weekly slots, feeds the paid-
// session booking flow + Google Calendar event creation on checkout) ---

export interface MentorAvailabilityRule {
  id: string;
  mentorId: string;
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  startMinute: number;
  endMinute: number;
}

export interface MentorProfile extends MentorshipUser {
  avatarUrl: string | null;
  bio: string | null;
  mentorTitle: string | null;
  mentorHourlyRate: number | null;
  mentorSkills: string[];
}

export async function getMentors(): Promise<MentorProfile[]> {
  const response = await apiClient.get<{ data: MentorProfile[] }>('/admin/mentorship/mentors');
  return response.data.data;
}

export async function updateMentorProfile(
  mentorId: string,
  payload: { mentorTitle?: string; mentorHourlyRate?: number; mentorSkills?: string[]; bio?: string }
): Promise<MentorProfile> {
  const response = await apiClient.put<{ data: MentorProfile }>(`/admin/mentorship/mentors/${mentorId}/profile`, payload);
  return response.data.data;
}

export async function getMentorAvailability(mentorId: string): Promise<MentorAvailabilityRule[]> {
  const response = await apiClient.get<{ data: MentorAvailabilityRule[] }>(`/admin/mentorship/mentors/${mentorId}/availability`);
  return response.data.data;
}

export async function createMentorAvailabilityRule(
  mentorId: string,
  rule: { dayOfWeek: number; startMinute: number; endMinute: number }
): Promise<MentorAvailabilityRule> {
  const response = await apiClient.post<{ data: MentorAvailabilityRule }>(`/admin/mentorship/mentors/${mentorId}/availability`, rule);
  return response.data.data;
}

export async function deleteMentorAvailabilityRule(ruleId: string): Promise<void> {
  await apiClient.delete(`/admin/mentorship/availability/${ruleId}`);
}
