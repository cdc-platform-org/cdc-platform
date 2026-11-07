import { z } from 'zod';

export const createExamSessionSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  topic: z.string().trim().min(3).max(500),
  // Parsed text from an optional PDF/DOCX exam-source upload (see
  // POST /sessions/parse-source) — passed back on this call rather than
  // combining file-upload + JSON in one request, same two-step pattern as
  // PaymentMethod/Agent's own upload-then-submit flows.
  //
  // Long PDFs / several photographed pages easily exceed the old 20k-char
  // cap, which rejected the whole request with a 400 the UI could only show
  // as "Unable to create exam". Now accepted up to 120k chars and simply
  // truncated (generateExamQuestions only sends the first ~40k to the AI).
  rawContent: z
    .string()
    .trim()
    .max(200000)
    .transform((v) => v.slice(0, 120000))
    .optional(),
  mcqCount: z.number().int().min(1).max(50).default(15),
  includeCodeQuestion: z.boolean().optional().default(false),
  // The extra AI-graded open-ended question. Defaults to true so existing
  // API callers keep today's behaviour; the dashboard form lets a teacher
  // turn it off for a pure multiple-choice test.
  includePracticalQuestion: z.boolean().optional().default(true),
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
