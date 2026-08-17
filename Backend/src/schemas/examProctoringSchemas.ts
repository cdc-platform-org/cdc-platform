import { z } from 'zod';

export const createExamSessionSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  topic: z.string().trim().min(3).max(500),
  mcqCount: z.number().int().min(1).max(20).default(5),
  durationMinutes: z.number().int().min(5).max(180).default(30),
});

export const updateExamSessionSchema = z.object({
  status: z.enum(['ACTIVE', 'CLOSED']).optional(),
});

export const startExamAttemptSchema = z.object({
  candidateName: z.string().trim().min(1).max(200),
  candidateEmail: z.string().trim().email(),
});

// answers keys are ExamQuestion ids; MCQ values are 'A'-'D', the practical
// question's value is free text — both stored as plain strings, validated
// against the actual question set server-side at grading time.
export const submitExamAttemptSchema = z.object({
  answers: z.record(z.string(), z.string().max(5000)),
  // Real-time proctoring strike count reported by the client (tab-switch /
  // fullscreen-exit / copy-paste), same mechanism as freelancerExam.ts's
  // registerStrike. disqualified mirrors that flow's own flag.
  proctoringViolations: z.number().int().min(0).max(1000).default(0),
  disqualified: z.boolean().optional(),
});
