import { prisma } from '../lib/prisma';
import { sendRecordingReadyEmail } from './emailService';

export class MentorshipRecordingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MentorshipRecordingError';
  }
}

// Shared by both the admin route (any booking) and the mentor's own
// self-serve route (their own bookings only — see routes/mentorship.ts) so
// the "set the URL, timestamp it, email the student once" logic lives in
// exactly one place. Fires the student email only the FIRST time a
// recording is attached (recordingUploadedAt starts null) — editing an
// already-set link later (fixing a typo, swapping providers) updates the
// URL without re-notifying the student.
export async function attachMentorshipRecording(bookingId: string, recordingUrl: string) {
  const booking = await prisma.mentorshipBooking.findUnique({
    where: { id: bookingId },
    include: { mentor: { select: { name: true } }, student: { select: { name: true, email: true } } },
  });
  if (!booking) {
    throw new MentorshipRecordingError('Booking not found.');
  }

  // Atomic claim on the "is this the first attach" check — the previous
  // plain findUnique-then-update had a gap two near-simultaneous PATCH
  // calls (e.g. the mentor and an admin both attaching a link within
  // moments of each other, or a client retry) could both read
  // recordingUploadedAt: null and both send the "recording ready" email.
  // Only the request whose updateMany actually flips a still-null row
  // (count 1) is the genuine first attach; the loser still gets its own
  // recordingUrl written via the unconditional update just below, matching
  // the existing "editing an already-set link doesn't re-notify" behavior,
  // it just also doesn't send a duplicate notification for a race it lost.
  const claim = await prisma.mentorshipBooking.updateMany({
    where: { id: bookingId, recordingUploadedAt: null },
    data: { recordingUrl, recordingUploadedAt: new Date() },
  });
  const isFirstAttach = claim.count > 0;
  const updated = isFirstAttach
    ? await prisma.mentorshipBooking.findUniqueOrThrow({ where: { id: bookingId } })
    : await prisma.mentorshipBooking.update({ where: { id: bookingId }, data: { recordingUrl } });

  if (isFirstAttach) {
    try {
      await sendRecordingReadyEmail({
        studentEmail: booking.student.email,
        studentName: booking.student.name,
        mentorName: booking.mentor.name,
        scheduledAt: booking.scheduledAt,
        recordingUrl,
        consultationDescription: booking.consultationDescription,
      });
    } catch (err) {
      // The recording is already saved either way — an email hiccup here
      // must never undo that or fail the request that attached it.
      console.error(`[mentorshipRecordingService] Recording-ready email failed for booking ${bookingId}:`, err);
    }
  }

  return updated;
}
