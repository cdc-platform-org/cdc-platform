/**
 * AI Course Mentor pricing (approved by the owner 2026-11-19).
 * Seat-based: the teacher pays per student added to the class, per month.
 * Personal learning (one person learning alone) costs the same as one seat.
 * Checkout uses these constants when the seat purchase flow ships (stage 3).
 *
 * Cost basis (estimate, Azure list prices): typical ~9 GEL, worst case ~14
 * GEL per student per month incl. gpt-4o escalations and the daily caps in
 * services/courseMentorAgent/usageLimits.ts -> ~100% margin on a typical student.
 */
export const COURSE_MENTOR_SEAT_PRICE_MINOR = 1900; // 19 GEL per student / month
export const COURSE_MENTOR_PERSONAL_PRICE_MINOR = 1900; // 19 GEL / month, one learner
export const COURSE_MENTOR_PERIOD_DAYS = 30;
