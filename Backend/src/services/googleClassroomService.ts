import { JWT } from 'google-auth-library';
import { GOOGLE_CALENDAR_CLIENT_EMAIL, GOOGLE_CALENDAR_PRIVATE_KEY, GOOGLE_CALENDAR_ID } from '../utils/env';

// ============================================================
// Google Classroom — same domain-wide-delegation identity as
// googleCalendarService.ts (same service account, same impersonated
// mailbox), but a DIFFERENT, additional OAuth scope
// (classroom.courses) that the Workspace admin must separately grant in
// the Admin Console's domain-wide delegation settings — Calendar access
// being already authorized does NOT imply Classroom access is. If that
// scope hasn't been granted, Google rejects the token mint itself
// (unauthorized_client) rather than any individual API call, and
// createClassroomCourse below surfaces that as a clear, specific error
// rather than a fabricated/silent success — there is no safe way to know
// from this codebase alone whether the scope has been granted; the caller
// (googleAgentService.setupCourseWorkspace) treats a Classroom failure as
// independent from Meet-link generation succeeding.
// ============================================================

const CLASSROOM_API_BASE = 'https://classroom.googleapis.com/v1';

export function isGoogleClassroomConfigured(): boolean {
  return !!(GOOGLE_CALENDAR_CLIENT_EMAIL && GOOGLE_CALENDAR_PRIVATE_KEY);
}

export class GoogleClassroomNotConfiguredError extends Error {
  constructor() {
    super('Google Classroom is not configured (GOOGLE_CALENDAR_CLIENT_EMAIL/GOOGLE_CALENDAR_PRIVATE_KEY missing).');
    this.name = 'GoogleClassroomNotConfiguredError';
  }
}

let cachedClient: JWT | null = null;
function getClient(): JWT {
  if (!cachedClient) {
    cachedClient = new JWT({
      email: GOOGLE_CALENDAR_CLIENT_EMAIL,
      key: GOOGLE_CALENDAR_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/classroom.courses'],
      subject: GOOGLE_CALENDAR_ID,
    });
  }
  return cachedClient;
}

export interface CreateClassroomCourseParams {
  name: string;
  section?: string | null;
}

export interface CreateClassroomCourseResult {
  courseId: string;
  joinLink: string | null;
}

export async function createClassroomCourse(params: CreateClassroomCourseParams): Promise<CreateClassroomCourseResult> {
  if (!isGoogleClassroomConfigured()) {
    throw new GoogleClassroomNotConfiguredError();
  }

  const accessToken = await getClient().getAccessToken();
  if (!accessToken.token) {
    throw new Error('Failed to obtain a Google Classroom access token.');
  }

  const response = await fetch(`${CLASSROOM_API_BASE}/courses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken.token}`, 'Content-Type': 'application/json' },
    // ownerId 'me' resolves to the impersonated `subject` above — Classroom
    // requires the owner to be a real Workspace user who is (or can become)
    // a teacher, which is exactly what domain-wide delegation's `subject`
    // already is for Calendar, so no separate owner concept is introduced.
    body: JSON.stringify({
      name: params.name,
      section: params.section || undefined,
      ownerId: 'me',
      courseState: 'ACTIVE',
    }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Google Classroom course creation failed (${response.status}): ${errText}`);
  }
  const data = (await response.json()) as { id: string; alternateLink?: string };
  return { courseId: data.id, joinLink: data.alternateLink ?? null };
}
