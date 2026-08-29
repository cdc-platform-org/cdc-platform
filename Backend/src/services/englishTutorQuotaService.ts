import { prisma } from '../lib/prisma';

// Free-tier daily lesson-generation cap for the AI English Tutor — same
// rolling-24h-window-via-count pattern as marketingAssistantQuotaService's
// DAILY_MARKETING_GENERATION_LIMIT (counts TutorLessonGeneration rows
// created in the last 24h rather than a resettable counter field, so it
// needs no cron/reset job and stays correct across multiple server
// instances). PRO-tier users (see utils/englishTutorAccess.ts) are never
// checked against this — see hasReachedDailyLessonGenerationLimit below.
export const DAILY_FREE_LESSON_GENERATION_LIMIT = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface TutorLessonGenerationUsage {
  used: number;
  limit: number | null; // null = unlimited (PRO/SuperAdmin)
}

export async function getDailyLessonGenerationUsage(userId: string, isPro: boolean): Promise<TutorLessonGenerationUsage> {
  if (isPro) return { used: 0, limit: null };
  const since = new Date(Date.now() - WINDOW_MS);
  const used = await prisma.tutorLessonGeneration.count({ where: { userId, createdAt: { gte: since } } });
  return { used, limit: DAILY_FREE_LESSON_GENERATION_LIMIT };
}

export async function hasReachedDailyLessonGenerationLimit(userId: string, isPro: boolean): Promise<boolean> {
  if (isPro) return false;
  const { used, limit } = await getDailyLessonGenerationUsage(userId, isPro);
  return limit !== null && used >= limit;
}

export async function recordLessonGeneration(userId: string): Promise<void> {
  await prisma.tutorLessonGeneration.create({ data: { userId } });
}
