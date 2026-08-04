import { prisma } from '../lib/prisma';

// Mentor availability is expressed in the platform's fixed reference
// timezone (Asia/Tbilisi, CDC's actual operating timezone) rather than each
// server/browser's local zone, so a rule like "Tuesdays 18:00-22:00" means
// the same wall-clock time regardless of where the request comes from.
const REFERENCE_TIMEZONE = 'Asia/Tbilisi';

// Default session length used both to size the calendar event and to check
// a candidate slot doesn't run past a rule's end time or collide with an
// already-booked session.
export const DEFAULT_SESSION_MINUTES = 60;

function tbilisiDayOfWeekAndMinutes(date: Date): { dayOfWeek: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: REFERENCE_TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const weekdayShort = parts.find((p) => p.type === 'weekday')!.value;
  const hour = Number(parts.find((p) => p.type === 'hour')!.value);
  const minute = Number(parts.find((p) => p.type === 'minute')!.value);
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayShort);
  return { dayOfWeek, minutes: hour * 60 + minute };
}

export class SlotUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlotUnavailableError';
  }
}

// Throws SlotUnavailableError if the requested time falls outside every one
// of the mentor's recurring rules, or overlaps a session that's already
// booked (any non-cancelled MentorshipBooking within DEFAULT_SESSION_MINUTES
// of it). Never trusts a client-computed "this slot is free" — always
// re-checked here at the point of charge, same posture as promo-code
// re-validation in payments.ts.
export async function assertSlotAvailable(mentorId: string, scheduledAt: Date, durationMinutes = DEFAULT_SESSION_MINUTES): Promise<void> {
  if (scheduledAt.getTime() < Date.now()) {
    throw new SlotUnavailableError('The selected time is in the past.');
  }

  const { dayOfWeek, minutes } = tbilisiDayOfWeekAndMinutes(scheduledAt);
  const rules = await prisma.mentorAvailabilityRule.findMany({ where: { mentorId, dayOfWeek } });
  const fitsARule = rules.some((rule) => minutes >= rule.startMinute && minutes + durationMinutes <= rule.endMinute);
  if (!fitsARule) {
    throw new SlotUnavailableError('This mentor is not available at the selected time.');
  }

  const windowStart = new Date(scheduledAt.getTime() - durationMinutes * 60_000);
  const windowEnd = new Date(scheduledAt.getTime() + durationMinutes * 60_000);
  const conflict = await prisma.mentorshipBooking.findFirst({
    where: { mentorId, scheduledAt: { gt: windowStart, lt: windowEnd } },
  });
  if (conflict) {
    throw new SlotUnavailableError('This time slot was just booked by someone else. Please pick another.');
  }
}
