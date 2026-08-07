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

// Public mentor directory — no auth required to browse. titleEn/bioEn are
// optional twins that fall back to the Georgian fields when unset — same
// convention as blog posts (see blogTitle/blogDescription helpers).
export interface PublicMentor {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  bioEn: string | null;
  mentorTitle: string | null;
  mentorTitleEn: string | null;
  mentorHourlyRate: number | null; // minor units (tetri)
  mentorSkills: string[];
  mentorLanguages: string[];
  cvUrl: string | null;
}

export function mentorTitle(mentor: PublicMentor, lang: 'ka' | 'en'): string | null {
  return (lang === 'en' && mentor.mentorTitleEn) || mentor.mentorTitle;
}
export function mentorBio(mentor: PublicMentor, lang: 'ka' | 'en'): string | null {
  return (lang === 'en' && mentor.bioEn) || mentor.bio;
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

interface BookingParticipant {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

// Every paid session the current user is part of — as the student who
// booked it, or as the mentor being booked (a Mentor account is still just
// a User). Only includes bookings whose payment actually completed.
export interface MyMentorshipBooking {
  id: string;
  role: 'student' | 'mentor';
  mentor: BookingParticipant;
  student: BookingParticipant;
  scheduledAt: string;
  studentPhone: string;
  consultationDescription: string | null;
  googleMeetLink: string | null;
  calendarSyncError: string | null;
  recordingUrl: string | null;
}

export async function getMyMentorshipBookings(): Promise<MyMentorshipBooking[]> {
  const response = await apiClient.get<{ data: MyMentorshipBooking[] }>('/mentorship/bookings/mine');
  return response.data.data;
}

// Mentor-only: attach/replace a recording link on one of their own
// bookings (backend scopes this to mentorId === the caller, see
// routes/mentorship.ts). Emails the student once, the first time a link
// is set for a given booking.
export async function attachMyBookingRecording(bookingId: string, recordingUrl: string): Promise<void> {
  await apiClient.patch(`/mentorship/bookings/${bookingId}/recording`, { recordingUrl });
}
