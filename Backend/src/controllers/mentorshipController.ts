import { sendEmailWithICS } from '../utils/emailService';

export async function notifyParticipants(booking: Booking): Promise<void> {
  const { student, mentor, scheduledAt, googleMeetUrl } = booking;

  await sendEmailWithICS({
    to: student.email,
    subject: 'Your Mentorship Session is Confirmed!',
    body: `Your session with ${mentor.name} is scheduled for ${scheduledAt}. Join via Google Meet: ${googleMeetUrl}`,
    googleMeetUrl,
    scheduledAt,
    mentorBio: mentor.bio,
  });

  await sendEmailWithICS({
    to: mentor.email,
    subject: 'New Mentorship Session Scheduled!',
    body: `You have a session with ${student.name} scheduled for ${scheduledAt}. Join via Google Meet: ${googleMeetUrl}`,
    googleMeetUrl,
    scheduledAt,
    studentName: student.name,
  });
}
