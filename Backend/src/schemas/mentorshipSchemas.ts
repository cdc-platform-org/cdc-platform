import { z } from 'zod';

export const createMentorshipRequestSchema = z.object({
  message: z.string().trim().min(5).max(2000),
});

// A mentor manually setting/editing the Meet/Zoom link on their own booking
// — separate from googleMeetLink's usual auto-fill via the Calendar
// integration (routes/payments.ts), for when that integration fails/isn't
// configured or the mentor wants to use a different tool. Scheme-restricted
// for the same reason attachRecordingSchema is (adminSchemas.ts) — this
// renders straight into an <a href> for the student to click.
export const meetingLinkSchema = z.object({
  meetingLink: z
    .string()
    .trim()
    .url()
    .max(2000)
    .refine((url) => /^https?:\/\//i.test(url), { message: 'Must be a valid http(s) URL.' }),
});
