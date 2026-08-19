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
  minCapacity: number;
  maxCapacity: number;
  published: boolean;
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
