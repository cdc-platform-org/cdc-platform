/**
 * Course Mentor Agent — per-student daily AI limits.
 * Exports: DAILY_LIMITS, UsageKind, consumeUsage, tryConsumeUsage, utcDay.
 *
 * The seat price assumes a bounded worst case (~14 GEL/student/month incl.
 * gpt-4o escalations; see README.md "ხარჯი").
 * These caps make that bound real: a student can chat a lot during a
 * 3-hour lesson, but scripts or abuse can't run up an unbounded bill.
 */
import { prisma } from '../../lib/prisma';
import { CourseMentorError } from './types';

export const DAILY_LIMITS = {
  messages: 80, // tutor chat turns
  aiCalls: 60, // task generation + grading + evaluations
  // Turns answered by gpt-4o instead of mini when the student is stuck or the
  // code is hard. Each costs ~0.04 GEL more than a mini turn; 6/day keeps the
  // worst case well inside the 19 GEL seat price.
  escalations: 6,
} as const;

export function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// Atomically increments and checks; throws 429 once the cap is reached.
export type UsageKind = keyof typeof DAILY_LIMITS;

export async function consumeUsage(studentId: string, kind: UsageKind, amount = 1): Promise<void> {
  const day = utcDay();
  const row = await prisma.mentorUsageDay.upsert({
    where: { studentId_day: { studentId, day } },
    create: { studentId, day, [kind]: amount },
    update: { [kind]: { increment: amount } },
  });
  if (row[kind] > DAILY_LIMITS[kind]) {
    // Give the unit back so the counter reflects real usage.
    await prisma.mentorUsageDay.update({ where: { studentId_day: { studentId, day } }, data: { [kind]: { decrement: amount } } });
    throw new CourseMentorError(429, 'Daily limit reached for today. Continue tomorrow or ask your teacher.', 'DAILY_LIMIT');
  }
}

// Like consumeUsage but returns false instead of throwing — used for the
// optional gpt-4o escalation, which silently falls back to mini when spent.
export async function tryConsumeUsage(studentId: string, kind: UsageKind): Promise<boolean> {
  try {
    await consumeUsage(studentId, kind);
    return true;
  } catch (err) {
    if (err instanceof CourseMentorError && err.status === 429) return false;
    throw err;
  }
}
