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
// AUDIT NOTE (investigated, no destructive change made): a request asked
// for a course/live-training purchase to "automatically grant the active
// Student role/badge". Two things were verified before deciding what to
// actually do here:
//   1. Course/LiveTraining ACCESS was already role-agnostic before this —
//      routes/courses.ts's checkCourseAccess gates purely on adminRole or a
//      real CourseEnrollment row, never on User.role. A Client account that
//      buys a course could already fully access it; there was no functional
//      access gap this needed to close.
//   2. Since register.tsx's role-selection stepper was removed (this same
//      change), 'Client' is no longer reachable by a general signup at
//      all — only via one deliberate internal deep-link (tools.tsx's
//      Business AI Tools trial). Every organic registration already
//      defaults to role: 'Student' (the schema default), so the
//      overwhelming majority of purchasers already have it the moment they
//      sign up — nothing left to "grant" at purchase time for them.
// What was deliberately NOT done: forcibly overwriting an EXISTING Client
// (or Mentor) account's role to 'Student' on purchase. That field also
// drives dashboard routing (pages/dashboard.tsx redirects role: 'Client' to
// /dashboard/client) and would silently strip a real business account's own
// dashboard/capabilities the moment they bought a course for themselves — a
// destructive, hard-to-reverse mutation of someone else's account type that
// this request's wording didn't unambiguously ask for. If overwriting an
// existing Client/Mentor's role on purchase is genuinely wanted, that's a
// deliberate follow-up decision, not a safe default to guess at here.
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
