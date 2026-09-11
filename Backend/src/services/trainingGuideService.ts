import { Prisma, TrainingDay, TrainingGuideSettings } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { GuideSection, guideSectionSchema } from '../schemas/trainingGuideSchemas';
import { vibeCodingDailyGuides } from '../data/vibeCodingDailyGuides';

export class TrainingGuideError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const defaultGuideSettings = {
  timeZone: 'Asia/Tbilisi', startDate: null as string | null, paused: false,
  currentDayOverride: null as number | null, visibility: 'CURRENT_AND_PREVIOUS' as const,
  pausedDayNumber: null as number | null,
};
type Settings = Pick<TrainingGuideSettings, 'timeZone' | 'startDate' | 'paused' | 'pausedDayNumber' | 'currentDayOverride' | 'visibility'>;
type ScheduleDay = { id: string; dayNumber: number; scheduledDate: string | null; published: boolean };

export function localCalendarDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function scheduledGuideDate(day: ScheduleDay, settings: Settings): string | null {
  if (day.scheduledDate) return day.scheduledDate;
  if (!settings.startDate) return null;
  const date = new Date(`${settings.startDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + day.dayNumber - 1);
  return date.toISOString().slice(0, 10);
}
export function resolveGuideSchedule<T extends ScheduleDay>(days: T[], settings: Settings, now = new Date()) {
  const today = localCalendarDate(now, settings.timeZone);
  const manual = settings.currentDayOverride ?? (settings.paused ? settings.pausedDayNumber : null);
  // A paused schedule stays on the day snapshotted by the settings mutation.
  // Pausing before the start keeps every day upcoming (manual remains null).
  const currentDayNumber = manual != null ? manual : settings.paused ? null :
    days.filter((day) => { const date = scheduledGuideDate(day, settings); return date != null && date <= today; })
      .sort((a, b) => (scheduledGuideDate(b, settings) ?? '').localeCompare(scheduledGuideDate(a, settings) ?? '') || b.dayNumber - a.dayNumber)[0]?.dayNumber ?? null;
  const dates = new Map(days.map((day) => [day.dayNumber, scheduledGuideDate(day, settings)]));
  const currentDate = currentDayNumber != null ? dates.get(currentDayNumber) : null;
  const annotated = days.map((day) => {
    const date = dates.get(day.dayNumber) ?? null;
    let status: 'upcoming' | 'today' | 'completed' = 'upcoming';
    if (day.dayNumber === currentDayNumber) status = 'today';
    else if (manual != null && day.dayNumber < manual) status = 'completed';
    else if (manual == null && currentDate && date && date < currentDate) status = 'completed';
    // After the final scheduled calendar day there is no "today" guide.
    if (manual == null && !settings.paused && status === 'today' && date && date < today) status = 'completed';
    return { ...day, status, effectiveDate: date };
  });
  return { currentDayNumber, days: annotated };
}
export function guideSections(day: { sections: Prisma.JsonValue }): GuideSection[] {
  return guideSectionSchema.array().parse(day.sections);
}

export async function requireTrainingGuideAccess(trainingId: string, userId: string, admin = false) {
  const training = await prisma.liveTraining.findUnique({ where: { id: trainingId } });
  if (!training || (!admin && !training.published)) throw new TrainingGuideError(404, 'Training not found.');
  if (!admin) {
    const enrollment = await prisma.liveTrainingEnrollment.findFirst({
      where: { liveTrainingId: trainingId, userId, status: { in: ['ACTIVE', 'COMPLETED'] }, user: { isBanned: false, deletionRequestedAt: null } },
      select: { id: true },
    });
    if (!enrollment) throw new TrainingGuideError(403, 'An active training enrollment is required to use IAKO.');
  }
  return training;
}
export async function guideConfiguration(trainingId: string) {
  const training = await prisma.liveTraining.findUnique({ where: { id: trainingId }, select: { startDate: true, scheduledAt: true } });
  const stored = await prisma.trainingGuideSettings.findUnique({ where: { liveTrainingId: trainingId } });
  return stored ?? { ...defaultGuideSettings,
    startDate: training ? localCalendarDate(training.startDate ?? training.scheduledAt, defaultGuideSettings.timeZone) : null,
  };
}
export async function getTrainingGuides(trainingId: string, userId: string, admin = false) {
  const training = await requireTrainingGuideAccess(trainingId, userId, admin);
  const [settings, allDays, progress] = await Promise.all([
    guideConfiguration(trainingId),
    prisma.trainingDay.findMany({ where: { liveTrainingId: trainingId }, orderBy: { dayNumber: 'asc' } }),
    prisma.trainingDayProgress.findMany({ where: { userId, day: { liveTrainingId: trainingId }, completed: true }, select: { dayId: true, itemId: true } }),
  ]);
  const schedule = resolveGuideSchedule(allDays, settings);
  const days = schedule.days.filter((day) => admin || day.published && (
    settings.visibility === 'ALL_DAYS' || day.status === 'today' || settings.visibility === 'CURRENT_AND_PREVIOUS' && day.status === 'completed'
  )).map((day) => {
    const sections = guideSections(day as TrainingDay);
    const validIds = new Set(sections.flatMap((section) => section.items.map((item) => item.id)));
    return { ...day, sections, completedItemIds: progress.filter((item) => item.dayId === day.id && validIds.has(item.itemId)).map((item) => item.itemId) };
  });
  return { training: { id: training.id, title: training.title }, settings, currentDayNumber: schedule.currentDayNumber, days };
}

export type IakoGuideSelection = { dayId: string; sectionId?: string; itemId?: string };

// The browser supplies identifiers only. Resolve the curriculum from the same
// enrollment, publication and schedule gates used by the learner guide page.
export async function resolveIakoGuideContext(trainingId: string, userId: string, selection: IakoGuideSelection) {
  const guides = await getTrainingGuides(trainingId, userId);
  const day = guides.days.find((entry) => entry.id === selection.dayId);
  if (!day) throw new TrainingGuideError(404, 'Guide not available.');
  const section = selection.sectionId ? day.sections.find((entry) => entry.id === selection.sectionId) : undefined;
  if (selection.sectionId && !section) throw new TrainingGuideError(400, 'Unknown guide section.');
  const sections = section ? [section] : day.sections;
  const item = selection.itemId ? sections.flatMap((entry) => entry.items).find((entry) => entry.id === selection.itemId) : undefined;
  if (selection.itemId && !item) throw new TrainingGuideError(400, 'Unknown guide item.');

  // A full day can contain many long code examples. Bound the selected context
  // before serialization without cutting JSON or accepting client-authored text.
  let remaining = 10000;
  const boundedSections = sections.flatMap((entry) => {
    if (remaining <= 0 || item && !entry.items.some((candidate) => candidate.id === item.id)) return [];
    remaining -= entry.title.length;
    const items = (item ? [item] : entry.items).flatMap((candidate) => {
      if (remaining <= candidate.title.length) return [];
      remaining -= candidate.title.length;
      const body = candidate.body.slice(0, Math.min(remaining, item ? 8000 : 2000));
      remaining -= body.length;
      return [{ id: candidate.id, title: candidate.title, body }];
    });
    return [{ id: entry.id, title: entry.title, kind: entry.kind, items }];
  });
  return {
    dayNumber: day.dayNumber, title: day.title, sectionTitle: section?.title, topicTitle: item?.title,
    context: JSON.stringify({ dayNumber: day.dayNumber, title: day.title, summary: day.summary, sections: boundedSections }),
  };
}
export async function saveGuideProgress(trainingId: string, userId: string, dayId: string, itemId: string, completed: boolean) {
  const guides = await getTrainingGuides(trainingId, userId);
  const day = guides.days.find((item) => item.id === dayId);
  if (!day) throw new TrainingGuideError(404, 'Guide not available.');
  if (!day.sections.some((section) => section.items.some((item) => item.id === itemId))) throw new TrainingGuideError(400, 'Unknown guide item.');
  return prisma.trainingDayProgress.upsert({
    where: { userId_dayId_itemId: { userId, dayId, itemId } },
    create: { userId, dayId, itemId, completed }, update: { completed },
  });
}
export async function getGuideMetrics(trainingId: string, days: TrainingDay[]) {
  const participants = await prisma.liveTrainingEnrollment.findMany({
    where: { liveTrainingId: trainingId, status: { in: ['ACTIVE', 'COMPLETED'] }, user: { isBanned: false, deletionRequestedAt: null } }, select: { userId: true },
  });
  const progress = await prisma.trainingDayProgress.findMany({
    where: { day: { liveTrainingId: trainingId }, completed: true, userId: { in: participants.map((participant) => participant.userId) } },
    select: { dayId: true, userId: true, itemId: true },
  });
  return days.map((day) => {
    const itemIds = guideSections(day).flatMap((section) => section.items.map((item) => item.id));
    return { dayId: day.id, dayNumber: day.dayNumber, totalParticipants: participants.length,
      completedParticipants: itemIds.length === 0 ? 0 : participants.filter((participant) => {
        const completed = new Set(progress.filter((row) => row.dayId === day.id && row.userId === participant.userId).map((row) => row.itemId));
        return itemIds.every((id) => completed.has(id));
      }).length,
    };
  });
}

export async function importVibeCodingGuides(trainingId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM live_trainings WHERE id = ${trainingId} FOR UPDATE`;
    if (await tx.trainingDay.count({ where: { liveTrainingId: trainingId } })) throw new TrainingGuideError(409, 'Guides already exist. Import into an empty training to preserve edits and learner progress.');
    for (const day of vibeCodingDailyGuides) {
      await tx.trainingDay.create({ data: { ...day, liveTrainingId: trainingId, published: true, sections: day.sections as unknown as Prisma.InputJsonValue } });
      await tx.trainingGuideSource.create({ data: {
        liveTrainingId: trainingId, dayNumber: day.dayNumber,
        title: `Vibe Coding Camp syllabus — day ${day.dayNumber}, pages ${day.sourcePages.join(', ')}`,
        content: day.sections.map((section) => `${section.title}\n${section.items.map((item) => `${item.title}\n${item.body}`).join('\n')}`).join('\n\n'),
      } });
    }
    return { importedDays: vibeCodingDailyGuides.length };
  });
}

export async function answerTrainingGuide(trainingId: string, userId: string, input: {
  message: string; dayId?: string; sectionId?: string; history: Array<{ role: 'USER' | 'ASSISTANT'; content: string }>;
}) {
  const guides = await getTrainingGuides(trainingId, userId);
  const dayMatch = input.message.match(/(?:day|დღე)\s*(\d{1,3})/i);
  const tomorrow = /ხვალ|tomorrow/i.test(input.message);
  let requestedNumber = dayMatch ? Number(dayMatch[1]) : tomorrow && guides.currentDayNumber != null ? guides.currentDayNumber + 1 : null;
  if (!input.dayId && requestedNumber == null) requestedNumber = guides.currentDayNumber;
  const day = dayMatch || tomorrow ? guides.days.find((item) => item.dayNumber === requestedNumber) :
    input.dayId ? guides.days.find((item) => item.id === input.dayId) : guides.days.find((item) => item.dayNumber === requestedNumber);
  const ka = /[\u10A0-\u10FF]/.test(input.message);
  if (!day) {
    return { reply: ka ? 'ამ დღის გზამკვლევი ჯერ ხელმისაწვდომი არ არის. გადაამოწმეთ ტრენინგის განრიგი ან მიმართეთ ტრენერს.' : 'That day’s guide is not available yet. Check the training schedule or contact your trainer.', dayNumber: requestedNumber };
  }
  const section = input.sectionId ? day.sections.find((item) => item.id === input.sectionId) : undefined;
  if (input.sectionId && !section) throw new TrainingGuideError(400, 'Unknown guide section.');
  const relevantSections = section ? [section] : day.sections;
  // Compatibility endpoint for structured guide lookup only. Generative help
  // belongs to /iako, where profile scope, access and usage limits are enforced.
  // A free-form message here must never become a second, unmetered AI route.
  return { dayNumber: day.dayNumber, reply: `${ka ? 'დღე' : 'Day'} ${day.dayNumber} — ${day.title}\n\n${day.summary}\n\n${relevantSections.map((item) => `${item.title}\n${item.items.map((entry) => `• ${entry.title}${entry.body ? `: ${entry.body}` : ''}`).join('\n')}`).join('\n\n')}` };
}
