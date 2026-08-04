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

// Concrete, real bookable datetimes over the next `days` days — combines the
// mentor's recurring weekly rules with already-booked sessions (excluded)
// and a 1-hour minimum lead time (excludes slots too soon to realistically
// book). Georgia has used a fixed UTC+4 offset with no DST since 2017, so
// constructing a Tbilisi wall-clock time as an explicit "+04:00" ISO string
// is safe and avoids needing a timezone-math library.
export async function generateAvailableSlots(
  mentorId: string,
  days = 14,
  durationMinutes = DEFAULT_SESSION_MINUTES
): Promise<Date[]> {
  const rules = await prisma.mentorAvailabilityRule.findMany({ where: { mentorId } });
  if (rules.length === 0) return [];

  const rulesByDay = new Map<number, typeof rules>();
  for (const rule of rules) {
    if (!rulesByDay.has(rule.dayOfWeek)) rulesByDay.set(rule.dayOfWeek, []);
    rulesByDay.get(rule.dayOfWeek)!.push(rule);
  }

  const now = new Date();
  const minLeadTime = new Date(now.getTime() + 60 * 60_000);
  const candidates: Date[] = [];
  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const probe = new Date(now.getTime() + dayOffset * 86_400_000);
    // The Tbilisi calendar date for this offset — not the UTC one, which can
    // differ by a day near midnight depending on the server's own timezone.
    const tbilisiDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: REFERENCE_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(probe);
    const dayOfWeek = new Date(`${tbilisiDateStr}T12:00:00Z`).getUTCDay();
    const rulesForDay = rulesByDay.get(dayOfWeek);
    if (!rulesForDay) continue;
    for (const rule of rulesForDay) {
      for (let minute = rule.startMinute; minute + durationMinutes <= rule.endMinute; minute += durationMinutes) {
        const hh = String(Math.floor(minute / 60)).padStart(2, '0');
        const mm = String(minute % 60).padStart(2, '0');
        const slot = new Date(`${tbilisiDateStr}T${hh}:${mm}:00+04:00`);
        if (slot.getTime() >= minLeadTime.getTime()) candidates.push(slot);
      }
    }
  }
  if (candidates.length === 0) return [];

  const existingBookings = await prisma.mentorshipBooking.findMany({
    where: {
      mentorId,
      scheduledAt: { gte: now, lte: new Date(now.getTime() + (days + 1) * 86_400_000) },
    },
    select: { scheduledAt: true },
  });
  const free = candidates.filter(
    (slot) => !existingBookings.some((b) => Math.abs(b.scheduledAt.getTime() - slot.getTime()) < durationMinutes * 60_000)
  );
  free.sort((a, b) => a.getTime() - b.getTime());
  return free;
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
