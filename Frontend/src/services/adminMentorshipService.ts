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
  bioEn: string | null;
  mentorTitle: string | null;
  mentorTitleEn: string | null;
  mentorHourlyRate: number | null;
  mentorSkills: string[];
  mentorLanguages: string[];
  cvUrl: string | null;
}

export async function getMentors(): Promise<MentorProfile[]> {
  const response = await apiClient.get<{ data: MentorProfile[] }>('/admin/mentorship/mentors');
  return response.data.data;
}

export async function updateMentorProfile(
  mentorId: string,
  payload: {
    mentorTitle?: string;
    mentorTitleEn?: string;
    mentorHourlyRate?: number;
    mentorSkills?: string[];
    mentorLanguages?: string[];
    bio?: string;
    bioEn?: string;
  }
): Promise<MentorProfile> {
  const response = await apiClient.put<{ data: MentorProfile }>(`/admin/mentorship/mentors/${mentorId}/profile`, payload);
  return response.data.data;
}

export async function uploadMentorCv(mentorId: string, file: File): Promise<MentorProfile> {
  const formData = new FormData();
  formData.append('cv', file);
  const response = await apiClient.post<{ data: MentorProfile }>(`/admin/mentorship/mentors/${mentorId}/cv`, formData);
  return response.data.data;
}

export async function uploadMentorAvatar(mentorId: string, file: File): Promise<MentorProfile> {
  const formData = new FormData();
  formData.append('avatar', file);
  const response = await apiClient.post<{ data: MentorProfile }>(`/admin/mentorship/mentors/${mentorId}/avatar`, formData);
  return response.data.data;
}

export interface TranslateMentorProfileResult {
  titleEn: string;
  bioEn: string;
}

export async function translateMentorProfile(payload: { title: string; bio: string }): Promise<TranslateMentorProfileResult> {
  const response = await apiClient.post<{ data: TranslateMentorProfileResult }>('/ai/translate-mentor', payload);
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

export async function updateMentorAvailabilityRule(
  ruleId: string,
  rule: { dayOfWeek: number; startMinute: number; endMinute: number }
): Promise<MentorAvailabilityRule> {
  const response = await apiClient.put<{ data: MentorAvailabilityRule }>(`/admin/mentorship/availability/${ruleId}`, rule);
  return response.data.data;
}

export async function deleteMentorAvailabilityRule(ruleId: string): Promise<void> {
  await apiClient.delete(`/admin/mentorship/availability/${ruleId}`);
}

// --- Bookings — every paid session, for the admin panel's own visibility
// into who booked whom (separate from mentorship-sessions.tsx, which is
// each participant's own self-serve view of just their sessions). ---

export interface AdminMentorshipBooking {
  id: string;
  scheduledAt: string;
  studentPhone: string;
  consultationDescription: string | null;
  googleMeetLink: string | null;
  calendarSyncError: string | null;
  recordingUrl: string | null;
  recordingUploadedAt: string | null;
  createdAt: string;
  mentor: MentorshipUser;
  student: MentorshipUser;
  bogPayment: { status: string; amount: number; currency: string };
}

// Attaches/replaces a pasted recording link (Google Drive, Bunny CDN,
// direct MP4, etc.) — emails the student once, the first time a link is
// set for a given booking (see Backend's mentorshipRecordingService.ts).
export async function attachBookingRecording(bookingId: string, recordingUrl: string): Promise<AdminMentorshipBooking> {
  const response = await apiClient.patch<{ data: AdminMentorshipBooking }>(`/admin/mentorship/bookings/${bookingId}/recording`, {
    recordingUrl,
  });
  return response.data.data;
}

export async function getAdminMentorshipBookings(): Promise<AdminMentorshipBooking[]> {
  const response = await apiClient.get<{ data: AdminMentorshipBooking[] }>('/admin/mentorship/bookings');
  return response.data.data;
}
