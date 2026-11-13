// Minimal hand-rolled RFC 5545 (iCalendar) generator — no new dependency,
// mirrors this codebase's general preference for a small hand-written
// implementation over a new package when the format itself is simple. Only
// covers what a single mentorship-session VEVENT needs.

function formatIcsDate(date: Date): string {
  // UTC, "YYYYMMDDTHHMMSSZ" — the one DATE-TIME form that needs no VTIMEZONE
  // block, so this stays a single self-contained VEVENT.
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// Commas, semicolons, and newlines are structurally significant in ICS text
// values and must be backslash-escaped — user-supplied text (a mentorship
// topic/description) could otherwise produce a malformed file.
function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

export interface MentorshipIcsParams {
  bookingId: string;
  mentorName: string;
  studentName: string;
  scheduledAt: Date;
  durationMinutes: number;
  meetLink: string | null;
  consultationDescription: string | null;
}

export function buildMentorshipIcs(params: MentorshipIcsParams): string {
  const start = params.scheduledAt;
  const end = new Date(start.getTime() + params.durationMinutes * 60_000);
  const descriptionParts = [
    params.consultationDescription ? `Topic: ${params.consultationDescription}` : null,
    params.meetLink ? `Google Meet: ${params.meetLink}` : null,
  ].filter((line): line is string => !!line);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CDC Platform//Mentorship//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${params.bookingId}@cdc.org.ge`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(`CDC Mentorship: ${params.mentorName} & ${params.studentName}`)}`,
    ...(descriptionParts.length ? [`DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}`] : []),
    ...(params.meetLink ? [`LOCATION:${escapeIcsText(params.meetLink)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  // RFC 5545 requires CRLF line endings.
  return lines.join('\r\n');
}
