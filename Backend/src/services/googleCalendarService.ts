import { JWT } from 'google-auth-library';
import { GOOGLE_CALENDAR_CLIENT_EMAIL, GOOGLE_CALENDAR_PRIVATE_KEY, GOOGLE_CALENDAR_ID } from '../utils/env';

// ============================================================
// Google Calendar — creates mentorship-session events directly on the
// Center's own calendar (GOOGLE_CALENDAR_ID), not a service-account-owned
// one, via domain-wide delegation (`subject` below). Uses the REST API
// through plain fetch() rather than the googleapis SDK — google-auth-library
// (already a dependency, used for Sign-In-with-Google) is enough to mint the
// bearer token, matching this codebase's existing pattern of calling
// provider REST APIs directly (see bogPaymentService.ts, bunnyStorage.ts).
// ============================================================

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export function isGoogleCalendarConfigured(): boolean {
  return !!(GOOGLE_CALENDAR_CLIENT_EMAIL && GOOGLE_CALENDAR_PRIVATE_KEY);
}

export class GoogleCalendarNotConfiguredError extends Error {
  constructor() {
    super('Google Calendar is not configured (GOOGLE_CALENDAR_CLIENT_EMAIL/GOOGLE_CALENDAR_PRIVATE_KEY missing).');
    this.name = 'GoogleCalendarNotConfiguredError';
  }
}

let cachedClient: JWT | null = null;
function getClient(): JWT {
  if (!cachedClient) {
    cachedClient = new JWT({
      email: GOOGLE_CALENDAR_CLIENT_EMAIL,
      key: GOOGLE_CALENDAR_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/calendar'],
      // Domain-wide delegation: acts AS this mailbox rather than as the
      // service account itself — without `subject`, the event would be
      // created on a calendar only the service account can see.
      subject: GOOGLE_CALENDAR_ID,
    });
  }
  return cachedClient;
}

export interface CreateMentorshipEventParams {
  studentEmail: string;
  studentName: string;
  studentPhone: string;
  mentorEmail: string;
  mentorName: string;
  scheduledAt: Date;
  durationMinutes?: number;
  consultationDescription?: string | null;
}

export interface CreateMentorshipEventResult {
  eventId: string;
  meetLink: string | null;
}

export async function createMentorshipCalendarEvent(
  params: CreateMentorshipEventParams
): Promise<CreateMentorshipEventResult> {
  if (!isGoogleCalendarConfigured()) {
    throw new GoogleCalendarNotConfiguredError();
  }

  const accessToken = await getClient().getAccessToken();
  if (!accessToken.token) {
    throw new Error('Failed to obtain a Google Calendar access token.');
  }

  const start = params.scheduledAt;
  const end = new Date(start.getTime() + (params.durationMinutes ?? 60) * 60_000);
  // Required by the Meet-link creation request — must be unique per event,
  // reusing it on a retry would just return the same conference instead of
  // erroring, which is the desired idempotent behavior here.
  const requestId = `cdc-mentorship-${start.getTime()}-${Math.random().toString(36).slice(2, 10)}`;

  const body = {
    summary: `CDC Mentorship: ${params.studentName} & ${params.mentorName}`,
    description: [
      params.consultationDescription ? `Consultation topic: ${params.consultationDescription}` : null,
      `Student phone: ${params.studentPhone}`,
    ]
      .filter(Boolean)
      .join('\n'),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    attendees: [{ email: params.studentEmail }, { email: params.mentorEmail }],
    conferenceData: {
      createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } },
    },
  };

  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Google Calendar event creation failed (${response.status}): ${errText}`);
  }
  const data = (await response.json()) as { id: string; hangoutLink?: string };
  return { eventId: data.id, meetLink: data.hangoutLink ?? null };
}
