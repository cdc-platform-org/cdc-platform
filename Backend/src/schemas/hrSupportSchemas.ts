import { z } from 'zod';

// The employer's mandatory effort-based-disclaimer checkbox — must be
// explicitly true, matching the ToS text shown in the pre-purchase modal
// ("I confirm I am paying for the screening/interview/report service
// itself, not a guarantee of hire").
export const requestHRSupportSchema = z.object({
  tosAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms of Service to request HR Assistance.' }),
  }),
});

export const assignHRSpecialistSchema = z.object({
  specialistId: z.string().uuid(),
});

const evaluationScore = z.number().int().min(0).max(100).nullable().optional();

export const updateCandidateEvaluationSchema = z.object({
  hardSkillsScore: evaluationScore,
  softSkillsScore: evaluationScore,
  taskScore: evaluationScore,
  culturalFitScore: evaluationScore,
  overallRank: z.number().int().positive().nullable().optional(),
  hrNotes: z.string().trim().max(3000).nullable().optional(),
  meetingUrl: z.union([z.string().trim().url('Enter a valid meeting URL.'), z.literal('')]).nullable().optional(),
  interviewAt: z.string().datetime().nullable().optional(),
  status: z.enum(['PENDING', 'TASK_SENT', 'TASK_SUBMITTED', 'INTERVIEWED', 'SCORED']).optional(),
});

export const deliverHRSupportRequestSchema = z.object({
  reportSummary: z.string().trim().min(20, 'Report summary must be at least 20 characters.').max(5000),
});

export const disputeHRSupportRequestSchema = z.object({
  reason: z.string().trim().min(10, 'Please describe the issue in at least 10 characters.').max(2000),
});

export const resolveHRSupportDisputeSchema = z.object({
  resolution: z.enum(['RELEASE', 'REFUND']),
});
