import { prisma } from '../lib/prisma';
import { sendRegistrationStatusWhatsApp } from './whatsappService';

// Fired once per successful course purchase, from every completion path
// that grants a CourseEnrollment — the free/promo-bypass branch and the
// BOG/Stripe webhook branch, in both payments.ts and stripePayments.ts.
// In-app Notification (this codebase has no course-specific email template
// today — contrast: MENTORSHIP bookings do get emails, via
// emailService.ts's sendMentorshipBookingEmails) plus a WhatsApp send when
// the buyer has a phone on file, same "confirmation once payment is truly
// confirmed" trigger point live training purchases use
// (liveTrainingSaleService.ts's completeLiveTrainingPurchase).
//
// No `locale` param — none of this function's call sites have request/
// browser context (a webhook, or a free-claim endpoint that doesn't thread
// the checkout page's locale through), same untracked-locale reasoning as
// liveTrainingSaleService.ts's own comment. Defaults to Georgian.
export async function notifyCourseEnrollment(userId: string, course: { id: string; title: string }): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      title: 'ჩარიცხვა დადასტურებულია! 🎉',
      message: `თქვენ წარმატებით ჩაირიცხეთ კურსზე „${course.title}". კურსი უკვე ხელმისაწვდომია თქვენს პირად კაბინეტში.`,
      type: 'COURSE_ENROLLMENT',
    },
  });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, phone: true } });
  if (!user?.phone) return; // No phone on file — the in-app Notification above already covers this.

  sendRegistrationStatusWhatsApp({
    phone: user.phone,
    firstName: user.name,
    itemTitle: course.title,
    // A course has no scheduled start date/time (unlike a LiveTraining) —
    // it's available on demand the moment enrollment activates.
    scheduleText: 'ხელმისაწვდომია ახლავე / Available now',
    paymentStatus: 'PAID',
  }).catch((err) => console.error('[courseEnrollmentNotification] sendRegistrationStatusWhatsApp failed:', err));
}
