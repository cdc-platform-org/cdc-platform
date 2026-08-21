export interface HRSupportPersonRef {
  id: string;
  name: string;
  email: string;
}

export interface HRSupportQuote {
  candidateCount: number;
  baseFee: number;
  includedCandidates: number;
  extraCandidates: number;
  extraCandidateFee: number;
  totalFee: number;
  currency: string;
}

export type CandidateEvaluationStatus = 'PENDING' | 'TASK_SENT' | 'TASK_SUBMITTED' | 'INTERVIEWED' | 'SCORED';

export interface CandidateApplicant {
  id: string;
  name: string;
  email: string;
  cvUrl: string | null;
  isVerifiedGraduate: boolean;
}

export interface CandidateEvaluationApplication {
  id: string;
  coverNote: string;
  applicant: CandidateApplicant;
}

export interface CandidateEvaluation {
  id: string;
  hrRequestId: string;
  applicationId: string;
  application: CandidateEvaluationApplication;
  hardSkillsScore: number | null;
  softSkillsScore: number | null;
  taskScore: number | null;
  culturalFitScore: number | null;
  overallRank: number | null;
  hrNotes: string | null;
  meetingUrl: string | null;
  interviewAt: string | null;
  status: CandidateEvaluationStatus;
  createdAt: string;
  updatedAt: string;
}

export type HRSupportRequestStatus = 'PENDING_PAYMENT' | 'AWAITING_ASSIGNMENT' | 'IN_PROGRESS' | 'DELIVERED' | 'CANCELLED';

export interface HRSupportRequest {
  id: string;
  vacancy: { id: string; title: string };
  requestedBy: HRSupportPersonRef;
  assignedSpecialist: HRSupportPersonRef | null;
  candidateCount: number;
  grossAmount: number;
  currency: string;
  tosAcceptedAt: string;
  status: HRSupportRequestStatus;
  commissionRate: number | null;
  commissionAmount: number | null;
  netAmount: number | null;
  escrowStatus: 'HELD_IN_ESCROW' | 'RELEASED' | 'REFUNDED' | null;
  paidAt: string | null;
  assignedAt: string | null;
  deliveredAt: string | null;
  reportSummary: string | null;
  autoReleaseAt: string | null;
  releasedAt: string | null;
  releaseTrigger: string | null;
  disputeRaisedAt: string | null;
  disputeReason: string | null;
  disputeResolvedAt: string | null;
  disputeResolution: string | null;
  createdAt: string;
  updatedAt: string;
  candidateEvaluations?: CandidateEvaluation[];
  _count?: { candidateEvaluations: number };
}
