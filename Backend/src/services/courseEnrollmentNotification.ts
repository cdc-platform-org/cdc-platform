import { prisma } from '../lib/prisma';

// Fired once per successful course purchase, from every completion path
// that grants a CourseEnrollment — the free/promo-bypass branch and the
// BOG/Stripe webhook branch, in both payments.ts and stripePayments.ts.
// In-app only (no email) — this codebase has no course-specific email
// template today (contrast: MENTORSHIP bookings do get emails, via
// emailService.ts's sendMentorshipBookingEmails), and a Notification is
// what the "confirmation" other automated flows (product moderation, KYC,
// live-training leads) already use.
export async function notifyCourseEnrollment(userId: string, course: { id: string; title: string }): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      title: 'ჩარიცხვა დადასტურებულია! 🎉',
      message: `თქვენ წარმატებით ჩაირიცხეთ კურსზე „${course.title}". კურსი უკვე ხელმისაწვდომია თქვენს პირად კაბინეტში.`,
      type: 'COURSE_ENROLLMENT',
    },
  });
}
