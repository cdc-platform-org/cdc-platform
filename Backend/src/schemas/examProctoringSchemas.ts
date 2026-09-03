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
//
// Deliberately does NOT accept tabSwitches/copyPasteCount/proctoringViolations/
// disqualified from the client anymore — a candidate calling this endpoint
// directly could set those to anything. routes/examProctoring.ts now
// recomputes all of them from this submission's ProctoringEvent rows (see
// POST /submissions/:token/events, logged via proctoringEventSchema below,
// one per real violation, timestamped by server receipt).
export const submitExamAttemptSchema = z.object({
  answers: z.record(z.string(), z.string().max(5000)),
});

export const proctoringEventSchema = z.object({
  type: z.enum(['TAB_SWITCH', 'COPY_PASTE', 'FULLSCREEN_EXIT', 'FACE_MISSING', 'MULTIPLE_FACES', 'LOOKING_AWAY', 'BACKGROUND_VOICE']),
});
