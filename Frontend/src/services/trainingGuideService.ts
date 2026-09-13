import apiClient from './apiClient';

export type GuideSectionKind = 'objectives' | 'topics' | 'tools' | 'concepts' | 'demo' | 'exercise' | 'outcome' | 'prompts' | 'code' | 'troubleshooting' | 'homework' | 'preview' | 'resources';
export type GuideVisibility = 'TODAY_ONLY' | 'CURRENT_AND_PREVIOUS' | 'ALL_DAYS';
// active defaults to true server-side when omitted — an item that predates
// this field, or a write that doesn't send it, keeps showing exactly as
// before. false = soft-hidden: filtered out of every learner-facing read,
// but never deleted (see Backend's activeGuideSections).
export interface GuideItem { id: string; title: string; body: string; language?: string; url?: string; active?: boolean }
export interface GuideSection { id: string; kind: GuideSectionKind; title: string; items: GuideItem[] }
export interface TrainingDay {
  id: string;
  dayNumber: number;
  title: string;
  summary: string;
  scheduledDate: string | null;
  published: boolean;
  sourcePages: number[];
  sections: GuideSection[];
  status: 'upcoming' | 'today' | 'completed';
  completedItemIds: string[];
  // Google Form links — same form reused across every day of a training via
  // Google Forms' own pre-filled-link feature; each day still stores its
  // own URL independently. Null hides the learner's button for that form.
  attendanceFormUrl: string | null;
  feedbackFormUrl: string | null;
}
export type TrainingDayInput = Omit<TrainingDay, 'id' | 'status' | 'completedItemIds'>;
export interface GuideSettings {
  timeZone: string;
  startDate: string | null;
  paused: boolean;
  currentDayOverride: number | null;
  visibility: GuideVisibility;
}
export interface LearnerGuide {
  // mediaConsentFormUrl is training-level (not per-day) — completed once
  // for the whole cohort, unlike attendanceFormUrl/feedbackFormUrl above.
  training: { id: string; title: string; mediaConsentFormUrl: string | null };
  settings: GuideSettings;
  currentDayNumber: number | null;
  days: TrainingDay[];
}
export interface GuideSource { id: string; title: string; content: string }
export interface AdminGuide {
  settings: GuideSettings;
  days: TrainingDay[];
  metrics: { dayId: string; dayNumber: number; completedParticipants: number; totalParticipants: number }[];
  sources: GuideSource[];
}

const learnerPath = (id: string) => `/live-trainings/${encodeURIComponent(id)}/guide`;
const adminPath = (id: string) => `/admin/live-trainings/${encodeURIComponent(id)}/guides`;

export async function getLearnerGuide(trainingId: string): Promise<LearnerGuide> {
  return (await apiClient.get<{ data: LearnerGuide }>(learnerPath(trainingId))).data.data;
}
export async function updateGuideProgress(trainingId: string, dayId: string, itemId: string, completed: boolean): Promise<void> {
  await apiClient.put(`${learnerPath(trainingId)}/days/${encodeURIComponent(dayId)}/progress`, { itemId, completed });
}
// Note: the per-guide chat endpoint (POST .../guide/chat, trainingGuideService.answerTrainingGuide
// on the backend) is intentionally left in place and still covered by
// Backend/src/routes/__tests__/trainingGuides.test.ts — the Frontend's
// Daily Guide page now routes "Ask IAKO" into the primary IAKO mentor
// conversation instead (see IakoMentorPage's topicContext), so nothing
// here calls it anymore, but the backend capability itself isn't being
// removed.
export async function getAdminGuide(trainingId: string): Promise<AdminGuide> {
  return (await apiClient.get<{ data: AdminGuide }>(adminPath(trainingId))).data.data;
}
export async function saveGuideSettings(trainingId: string, settings: GuideSettings): Promise<void> {
  await apiClient.patch(`${adminPath(trainingId)}/settings`, settings);
}
export async function saveGuideDay(trainingId: string, day: TrainingDayInput, dayId?: string): Promise<void> {
  const payload = {
    ...day,
    // Backend's httpsFormUrl accepts a real https:// link or null — never
    // an empty string, which a plain cleared text input naturally produces.
    attendanceFormUrl: day.attendanceFormUrl?.trim() || null,
    feedbackFormUrl: day.feedbackFormUrl?.trim() || null,
    sections: day.sections.map((section) => ({ ...section, items: section.items.map(({ url, ...item }) => ({ ...item, ...(url?.trim() ? { url: url.trim() } : {}) })) })),
  };
  if (dayId) await apiClient.put(`${adminPath(trainingId)}/days/${encodeURIComponent(dayId)}`, payload);
  else await apiClient.post(`${adminPath(trainingId)}/days`, payload);
}
export async function reorderGuideDays(trainingId: string, dayIds: string[]): Promise<void> {
  await apiClient.post(`${adminPath(trainingId)}/reorder`, { dayIds });
}
export async function importVibeCodingGuide(trainingId: string): Promise<void> {
  await apiClient.post(`${adminPath(trainingId)}/import-vibe-coding`);
}
export async function saveGuideSource(trainingId: string, source: { title: string; content: string }, sourceId?: string): Promise<void> {
  if (sourceId) await apiClient.put(`${adminPath(trainingId)}/sources/${encodeURIComponent(sourceId)}`, source);
  else await apiClient.post(`${adminPath(trainingId)}/sources`, source);
}

export function guideDayInput(day: TrainingDay): TrainingDayInput {
  return {
    dayNumber: day.dayNumber, title: day.title, summary: day.summary, scheduledDate: day.scheduledDate?.slice(0, 10) || null,
    published: day.published, sourcePages: day.sourcePages ?? [], sections: day.sections,
    attendanceFormUrl: day.attendanceFormUrl ?? null, feedbackFormUrl: day.feedbackFormUrl ?? null,
  };
}
