import { z } from 'zod';

export const createExamSessionSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  topic: z.string().trim().min(3).max(500),
  // Parsed text from an optional PDF/DOCX exam-source upload (see
  // POST /sessions/parse-source) — passed back on this call rather than
  // combining file-upload + JSON in one request, same two-step pattern as
  // PaymentMethod/Agent's own upload-then-submit flows.
  rawContent: z.string().trim().max(20000).optional(),
  mcqCount: z.number().int().min(1).max(30).default(5),
  includeCodeQuestion: z.boolean().optional().default(false),
  durationMinutes: z.number().int().min(5).max(180).default(30),
});

export const updateExamSessionSchema = z.object({
  status: z.enum(['ACTIVE', 'CLOSED']).optional(),
});

export const startExamAttemptSchema = z.object({
  candidateName: z.string().trim().min(1).max(200),
  candidateEmail: z.string().trim().email(),
});

// answers keys are ExamQuestion ids; MCQ values are 'A'-'D', PRACTICAL/CODE
// values are free text — both stored as plain strings, validated against
// the actual question set server-side at grading time.
export const submitExamAttemptSchema = z.object({
  answers: z.record(z.string(), z.string().max(5000)),
  // Real-time proctoring counts reported by the client — tabSwitches
  // (visibilitychange) and copyPasteCount (paste event) tracked separately
  // for the business's report; proctoringViolations is their sum and stays
  // the FLAG_THRESHOLD source of truth (same field name/meaning as before
  // this was split out, so old clients sending only that still work).
  tabSwitches: z.number().int().min(0).max(1000).default(0),
  copyPasteCount: z.number().int().min(0).max(1000).default(0),
  proctoringViolations: z.number().int().min(0).max(1000).default(0),
  disqualified: z.boolean().optional(),
});
