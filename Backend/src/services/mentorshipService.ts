import { generateGoogleMeetLink } from '../utils/googleCalendar';

export async function createBooking(studentId: string, mentorId: string, scheduledAt: Date): Promise<Booking> {
  const googleMeetUrl = await generateGoogleMeetLink(mentorId, scheduledAt);

  const booking = await BookingModel.create({
    studentId,
    mentorId,
    scheduledAt,
    googleMeetUrl, // Store the generated Google Meet link
  });

  return booking;
}
import { sendEmail } from '../utils/emailService';

export async function handleSessionEnd(bookingId: string): Promise<void> {
  const booking = await BookingModel.findById(bookingId);
  if (!booking) throw new Error('Booking not found');

  const recordingUrl = await processSessionRecording(bookingId); // Assume this function processes the recording
  booking.recordingUrl = recordingUrl;
  await booking.save();

  await sendEmail({
    to: booking.student.email,
    subject: 'Your Mentorship Session Recording is Ready!',
    body: `You can review your session recording here: ${recordingUrl}`,
  });
}
