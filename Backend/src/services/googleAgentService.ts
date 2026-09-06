import { createLiveTrainingCalendarEvent } from './googleCalendarService';
import { createClassroomCourse } from './googleClassroomService';

// ============================================================
// Orchestrates the two independent Google integrations a Live Training
// workspace needs — Calendar (for a real Meet link, via
// googleCalendarService.ts, the same domain-wide-delegated identity
// already proven working for mentorship bookings) and Classroom (for a
// real join link, via googleClassroomService.ts, gated on a Workspace-
// admin-granted scope this codebase cannot verify on its own — see that
// file's own comment). Deliberately does NOT throw on a partial failure:
// Meet and Classroom are unrelated Google products with unrelated failure
// modes, so a Classroom scope that hasn't been authorized yet must not
// also block the Meet link the admin actually needs today. Every failure
// is returned as a plain string in `errors`, not thrown, so the calling
// route can persist whichever link DID come back and surface the rest
// clearly to the admin instead of a blanket 500.
// ============================================================

export interface SetupCourseWorkspaceParams {
  title: string;
  scheduledAt: Date;
  category?: string | null;
}

export interface SetupCourseWorkspaceResult {
  meetingUrl: string | null;
  classroomUrl: string | null;
  errors: string[];
}

export async function setupCourseWorkspace(params: SetupCourseWorkspaceParams): Promise<SetupCourseWorkspaceResult> {
  const errors: string[] = [];
  let meetingUrl: string | null = null;
  let classroomUrl: string | null = null;

  try {
    const event = await createLiveTrainingCalendarEvent({ title: params.title, scheduledAt: params.scheduledAt });
    meetingUrl = event.meetLink;
    if (!meetingUrl) errors.push('Google Calendar event was created, but no Meet link came back with it.');
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Google Meet link generation failed.');
  }

  try {
    const course = await createClassroomCourse({ name: params.title, section: params.category });
    classroomUrl = course.joinLink;
    if (!classroomUrl) errors.push('Google Classroom course was created, but no join link came back with it.');
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Google Classroom course creation failed.');
  }

  return { meetingUrl, classroomUrl, errors };
}
