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

// Tbilisi calendar date, normalized to midnight UTC — matches how
// MentorAvailabilityException.date is stored, so a straight Set-membership
// check is enough rather than a range comparison.
function tbilisiDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: REFERENCE_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

interface ExceptionRow {
  date: Date;
  startMinute: number | null;
  endMinute: number | null;
}

// Whole-day-blocked date keys, and per-date partial minute-ranges blocked —
// split once so both generateMentorSlots and assertSlotAvailable read them
// the same way.
function splitExceptions(exceptions: ExceptionRow[]): {
  fullDayDates: Set<string>;
  partialByDate: Map<string, { startMinute: number; endMinute: number }[]>;
} {
  const fullDayDates = new Set<string>();
  const partialByDate = new Map<string, { startMinute: number; endMinute: number }[]>();
  for (const exception of exceptions) {
    const key = tbilisiDateKey(exception.date);
    if (exception.startMinute == null || exception.endMinute == null) {
      fullDayDates.add(key);
    } else {
      if (!partialByDate.has(key)) partialByDate.set(key, []);
      partialByDate.get(key)!.push({ startMinute: exception.startMinute, endMinute: exception.endMinute });
    }
  }
  return { fullDayDates, partialByDate };
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// Every real candidate datetime the mentor's recurring rules produce over
// the next `days` days, deduplicated by exact timestamp (two rules can
// otherwise generate the same wall-clock slot twice — e.g. an old rule and
// its replacement both covering 18:00 on a Tuesday — which used to render
// as literal duplicate buttons in the booking UI) and with a 1-hour minimum
// lead time applied (slots too soon to realistically book are dropped
// entirely, not just marked unavailable). Whole-day exceptions drop the day
// before rules are even evaluated. Partial exceptions are NOT applied here
// — they're kept as candidates and marked unavailable by the caller, same
// as an existing booking, so the booking UI can show them grayed-out rather
// than silently disappearing.
async function candidateSlotsForMentor(
  mentorId: string,
  days: number,
  durationMinutes: number
): Promise<{ slots: Date[]; partialByDate: Map<string, { startMinute: number; endMinute: number }[]> }> {
  const rules = await prisma.mentorAvailabilityRule.findMany({ where: { mentorId } });
  if (rules.length === 0) return { slots: [], partialByDate: new Map() };

  const exceptions = await prisma.mentorAvailabilityException.findMany({ where: { mentorId } });
  const { fullDayDates, partialByDate } = splitExceptions(exceptions);

  const rulesByDay = new Map<number, typeof rules>();
  for (const rule of rules) {
    if (!rulesByDay.has(rule.dayOfWeek)) rulesByDay.set(rule.dayOfWeek, []);
    rulesByDay.get(rule.dayOfWeek)!.push(rule);
  }

  const now = new Date();
  const minLeadTime = new Date(now.getTime() + 60 * 60_000);
  const byTimestamp = new Map<number, Date>();
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
    if (fullDayDates.has(tbilisiDateStr)) continue;
    const dayOfWeek = new Date(`${tbilisiDateStr}T12:00:00Z`).getUTCDay();
    const rulesForDay = rulesByDay.get(dayOfWeek);
    if (!rulesForDay) continue;
    for (const rule of rulesForDay) {
      for (let minute = rule.startMinute; minute + durationMinutes <= rule.endMinute; minute += durationMinutes) {
        const hh = String(Math.floor(minute / 60)).padStart(2, '0');
        const mm = String(minute % 60).padStart(2, '0');
        const slot = new Date(`${tbilisiDateStr}T${hh}:${mm}:00+04:00`);
        if (slot.getTime() >= minLeadTime.getTime()) byTimestamp.set(slot.getTime(), slot);
      }
    }
  }
  return { slots: Array.from(byTimestamp.values()).sort((a, b) => a.getTime() - b.getTime()), partialByDate };
}

// Every candidate slot over the next `days` days, tagged with whether it's
// still bookable — `available: false` covers both an existing non-cancelled
// booking and a mentor's manual partial-day block, so the booking UI can
// render either as visible-but-disabled ("Booked") instead of omitting it.
export async function generateMentorSlots(
  mentorId: string,
  days = 14,
  durationMinutes = DEFAULT_SESSION_MINUTES
): Promise<{ time: Date; available: boolean }[]> {
  const { slots: candidates, partialByDate } = await candidateSlotsForMentor(mentorId, days, durationMinutes);
  if (candidates.length === 0) return [];

  const now = new Date();
  const existingBookings = await prisma.mentorshipBooking.findMany({
    where: {
      mentorId,
      status: { not: 'CANCELLED' },
      scheduledAt: { gte: now, lte: new Date(now.getTime() + (days + 1) * 86_400_000) },
    },
    select: { scheduledAt: true },
  });

  return candidates.map((slot) => {
    const booked = existingBookings.some((b) => Math.abs(b.scheduledAt.getTime() - slot.getTime()) < durationMinutes * 60_000);
    let blocked = false;
    if (!booked) {
      const dateKey = tbilisiDateKey(slot);
      const minutesOfDay = Math.round((slot.getTime() - new Date(`${dateKey}T00:00:00+04:00`).getTime()) / 60_000);
      const blockedRanges = partialByDate.get(dateKey) ?? [];
      blocked = blockedRanges.some((r) => rangesOverlap(minutesOfDay, minutesOfDay + durationMinutes, r.startMinute, r.endMinute));
    }
    return { time: slot, available: !booked && !blocked };
  });
}

export class SlotUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlotUnavailableError';
  }
}

// Throws SlotUnavailableError if the requested time falls outside every one
// of the mentor's recurring rules, falls in a blocked exception window, or
// overlaps a session that's already booked (any non-cancelled
// MentorshipBooking within DEFAULT_SESSION_MINUTES of it). Never trusts a
// client-computed "this slot is free" — always re-checked here at the point
// of charge, same posture as promo-code re-validation in payments.ts.
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

  const dateKey = tbilisiDateKey(scheduledAt);
  const exceptions = await prisma.mentorAvailabilityException.findMany({
    where: { mentorId, date: { gte: new Date(`${dateKey}T00:00:00Z`), lt: new Date(`${dateKey}T23:59:59.999Z`) } },
  });
  const { fullDayDates, partialByDate } = splitExceptions(exceptions);
  if (fullDayDates.has(dateKey)) {
    throw new SlotUnavailableError('This mentor has marked this date as unavailable.');
  }
  const blockedRanges = partialByDate.get(dateKey) ?? [];
  if (blockedRanges.some((r) => rangesOverlap(minutes, minutes + durationMinutes, r.startMinute, r.endMinute))) {
    throw new SlotUnavailableError('This mentor has marked this time as unavailable.');
  }

  const windowStart = new Date(scheduledAt.getTime() - durationMinutes * 60_000);
  const windowEnd = new Date(scheduledAt.getTime() + durationMinutes * 60_000);
  const conflict = await prisma.mentorshipBooking.findFirst({
    where: { mentorId, status: { not: 'CANCELLED' }, scheduledAt: { gt: windowStart, lt: windowEnd } },
  });
  if (conflict) {
    throw new SlotUnavailableError('This time slot was just booked by someone else. Please pick another.');
  }
}
