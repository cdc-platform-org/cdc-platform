import { CourseLanguage, SubtitlesStatus } from './lms';

export interface LiveTraining {
  id: string;
  title: string;
  titleEn: string | null;
  description: string;
  descriptionEn: string | null;
  category: string;
  scheduledAt: string;
  price: number | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  minCapacity: number;
  maxCapacity: number;
  published: boolean;
  // Same enum/meaning as Course.language — see src/utils/courseLanguage.ts's
  // courseLanguageBadge(), shared by both types.
  language: CourseLanguage;
  meetingUrl: string | null;
  recordingUrl: string | null;
  // The actual confirmed session window — separate from scheduledAt, which
  // stays the originally-advertised public marketing date. Null until an
  // admin sets it once a cohort is confirmed. See Backend's LiveTraining
  // model comment.
  startDate: string | null;
  endDate: string | null;
  // AI-generated "conspectus" (study notes/synopsis) extracted from
  // recordingUrl's audio — see Backend's liveTrainingSynopsisService.ts.
  // Same status/error/per-language shape as AdminLesson's own conspectus
  // fields (courses.tsx already has this exact editor pattern).
  synopsisStatus: SubtitlesStatus | null;
  synopsisError: string | null;
  synopsisKa: string | null;
  synopsisEn: string | null;
  synopsisRu: string | null;
  convertedToCourseId: string | null;
  createdAt: string;
  updatedAt: string;
  // Derived server-side from the live lead count — see Backend's
  // withCapacity() in routes/liveTrainings.ts / adminLiveTrainings.ts.
  registeredCount: number;
  seatsRemaining: number;
  isFull: boolean;
  minThresholdMet: boolean;
}

// One row per active enrollment, as returned by GET /live-trainings/mine —
// meetingUrl is already visibility-gated server-side (see
// isMeetingLinkVisible in Backend's routes/liveTrainings.ts), so the
// frontend never needs to re-derive the time window itself.
export interface MyLiveTrainingEnrollment {
  enrollmentId: string;
  enrolledAt: string;
  liveTrainingId: string;
  title: string;
  titleEn: string | null;
  scheduledAt: string;
  startDate: string | null;
  endDate: string | null;
  meetingUrl: string | null;
  recordingUrl: string | null;
}

export interface LiveTrainingEnrollment {
  id: string;
  userId: string;
  liveTrainingId: string;
  status: 'ACTIVE' | 'CANCELLED';
  enrolledAt: string;
  user: { id: string; name: string; email: string };
}

export type LiveTrainingLeadStatus = 'NOT_CONTACTED' | 'CONTACTED' | 'SCHEDULED' | 'DECLINED';

export interface LiveTrainingLead {
  id: string;
  liveTrainingId: string;
  name: string;
  email: string;
  phone: string;
  status: LiveTrainingLeadStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}
