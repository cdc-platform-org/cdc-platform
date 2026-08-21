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

// Every candidate ISO datetime over the next `days` days, each tagged with
// whether it's still bookable — `available: false` covers both an
// already-booked session and a mentor's manual block, so the booking UI can
// render it grayed-out/disabled instead of hiding it outright.
export interface MentorSlot {
  time: string;
  available: boolean;
}

export async function getMentorSlots(mentorId: string, days = 14): Promise<MentorSlot[]> {
  const response = await apiClient.get<{ data: MentorSlot[] }>(`/mentorship/mentors/${mentorId}/slots`, { params: { days } });
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
  // "SCHEDULED" | "CANCELLED" | "COMPLETED" — COMPLETED is set lazily by
  // the server the first time anyone fetches a booking whose time has
  // passed, not the instant the session actually ends.
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
  studentPhone: string;
  consultationDescription: string | null;
  googleMeetLink: string | null;
  calendarSyncError: string | null;
  recordingUrl: string | null;
  // Escrow lifecycle — null until the payment is captured (should never
  // actually be null here, every booking returned by /bookings/mine has a
  // completed payment by definition), then "HELD_IN_ESCROW" | "RELEASED" |
  // "REFUNDED". A student can release funds early by confirming the
  // session happened; otherwise it auto-releases 24h after the scheduled
  // end with no dispute raised.
  escrowStatus: 'HELD_IN_ESCROW' | 'RELEASED' | 'REFUNDED' | null;
  disputeRaisedAt: string | null;
  disputeResolvedAt: string | null;
  disputeResolution: 'RELEASE' | 'REFUND' | null;
}

export async function getMyMentorshipBookings(): Promise<MyMentorshipBooking[]> {
  const response = await apiClient.get<{ data: MyMentorshipBooking[] }>('/mentorship/bookings/mine');
  return response.data.data;
}

// Student-only: "დადასტურება / სესია ჩატარდა" — releases the escrowed
// payment to the mentor immediately instead of waiting for the 24h
// auto-release window.
export async function confirmMySessionHappened(bookingId: string): Promise<MyMentorshipBooking> {
  const response = await apiClient.post<{ data: MyMentorshipBooking }>(`/mentorship/bookings/${bookingId}/confirm-session`);
  return response.data.data;
}

// Student-only: flags the booking for admin review — freezes the
// auto-release clock. The admin resolves it (release to the mentor or
// refund) via the admin mentorship dashboard, not automatically.
export async function disputeMyBooking(bookingId: string, reason: string): Promise<MyMentorshipBooking> {
  const response = await apiClient.post<{ data: MyMentorshipBooking }>(`/mentorship/bookings/${bookingId}/dispute`, { reason });
  return response.data.data;
}

// Either participant can reschedule/cancel their own SCHEDULED booking —
// see routes/mentorship.ts's ownership check (mentor or student on that
// specific booking, not just "is a Mentor").
export async function rescheduleMyBooking(bookingId: string, scheduledAt: string, note?: string): Promise<MyMentorshipBooking> {
  const response = await apiClient.patch<{ data: MyMentorshipBooking }>(`/mentorship/bookings/${bookingId}/reschedule`, {
    scheduledAt,
    note,
  });
  return response.data.data;
}

export async function cancelMyBooking(bookingId: string, note?: string): Promise<MyMentorshipBooking> {
  const response = await apiClient.post<{ data: MyMentorshipBooking }>(`/mentorship/bookings/${bookingId}/cancel`, { note });
  return response.data.data;
}

// ============================================================
// MENTOR <-> CLIENT CHAT — one thread per booking. A blocked send (off-
// platform contact info/payment phrasing — see Backend's
// sanitizeChatMessage) throws with response.status 422 (warned) or 403
// (2nd violation — account now banned); the message is never stored.
// ============================================================
export interface MentorChatMessage {
  id: string;
  bookingId: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
}

export async function getBookingMessages(bookingId: string): Promise<MentorChatMessage[]> {
  const response = await apiClient.get<{ data: MentorChatMessage[] }>(`/mentorship/bookings/${bookingId}/messages`);
  return response.data.data;
}

export async function sendBookingMessage(bookingId: string, content: string): Promise<MentorChatMessage> {
  const response = await apiClient.post<{ data: MentorChatMessage }>(`/mentorship/bookings/${bookingId}/messages`, { content });
  return response.data.data;
}

// Mentor-only: attach/replace a recording link on one of their own
// bookings (backend scopes this to mentorId === the caller, see
// routes/mentorship.ts). Emails the student once, the first time a link
// is set for a given booking.
export async function attachMyBookingRecording(bookingId: string, recordingUrl: string): Promise<void> {
  await apiClient.patch(`/mentorship/bookings/${bookingId}/recording`, { recordingUrl });
}

// Mentor-only: manually set/replace the Meet/Zoom link on one of their own
// bookings — overrides googleMeetLink, normally auto-filled by the Calendar
// integration at payment time, for when that integration failed or the
// mentor wants to use a different tool.
export async function setMyBookingMeetingLink(bookingId: string, meetingLink: string): Promise<void> {
  await apiClient.patch(`/mentorship/bookings/${bookingId}/meeting-link`, { meetingLink });
}

// ============================================================
// MENTOR SELF-SERVICE — a Mentor managing their own hourly rate,
// title/bio/skills, and weekly availability (see routes/mentorship.ts's
// /me/* routes, scoped server-side to the caller's own id).
// ============================================================

export interface MentorProfile {
  id: string;
  name: string;
  email: string;
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

// Read-only — see Backend's mentorship.ts GET /me/profile comment. Editing a
// mentor's listing (title/rate/skills/CV) is admin-only now, via
// adminMentorshipService.ts's updateMentorProfile (/admin/mentorship CMS).
export async function getMyMentorProfile(): Promise<MentorProfile> {
  const response = await apiClient.get<{ data: MentorProfile }>('/mentorship/me/profile');
  return response.data.data;
}

export interface MentorAvailabilityRuleRow extends MentorAvailabilityRule {
  id: string;
}

export async function getMyAvailability(): Promise<MentorAvailabilityRuleRow[]> {
  const response = await apiClient.get<{ data: MentorAvailabilityRuleRow[] }>('/mentorship/me/availability');
  return response.data.data;
}

export async function createMyAvailabilityRule(rule: MentorAvailabilityRule): Promise<MentorAvailabilityRuleRow> {
  const response = await apiClient.post<{ data: MentorAvailabilityRuleRow }>('/mentorship/me/availability', rule);
  return response.data.data;
}

export async function deleteMyAvailabilityRule(ruleId: string): Promise<void> {
  await apiClient.delete(`/mentorship/me/availability/${ruleId}`);
}

// --- Exception days — a single blocked date layered on top of the
// recurring rules above (vacation, sick day). ---

export interface MentorAvailabilityException {
  id: string;
  date: string;
  reason: string | null;
  // Both null = the whole day is blocked. Both set = only that minute range
  // within the day is blocked (see Backend's mentorAvailabilityService.ts).
  startMinute: number | null;
  endMinute: number | null;
}

export async function getMyAvailabilityExceptions(): Promise<MentorAvailabilityException[]> {
  const response = await apiClient.get<{ data: MentorAvailabilityException[] }>('/mentorship/me/availability/exceptions');
  return response.data.data;
}

export async function createMyAvailabilityException(
  date: string,
  reason?: string,
  timeRange?: { startMinute: number; endMinute: number }
): Promise<MentorAvailabilityException> {
  const response = await apiClient.post<{ data: MentorAvailabilityException }>('/mentorship/me/availability/exceptions', {
    date,
    reason,
    startMinute: timeRange?.startMinute,
    endMinute: timeRange?.endMinute,
  });
  return response.data.data;
}

export async function deleteMyAvailabilityException(exceptionId: string): Promise<void> {
  await apiClient.delete(`/mentorship/me/availability/exceptions/${exceptionId}`);
}
