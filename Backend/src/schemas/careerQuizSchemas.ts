import { z } from 'zod';

// Free-text question/answer pairs — the actual question set differs
// entirely between the kid (<16) and adult (16+) flows (see
// career-test.tsx's KID_QUESTIONS/ADULT_QUESTIONS), so this only validates
// shape (a handful of short string/string[] values), not specific keys.
// A question can be multi-select (career-test.tsx's toggleAnswer), so each
// value is either one string or a non-empty array of them — never both a
// single string AND requiring array-only, so a caller sending either shape
// (or a future non-multi-select question) is accepted the same way.
// 2-6 answers covers both flows (3 kid questions, 4 adult questions) with
// headroom.
const answerValueSchema = z.union([
  z.string().trim().min(1).max(300),
  z.array(z.string().trim().min(1).max(150)).min(1).max(10),
]);
const answersSchema = z
  .record(z.string().trim().min(1).max(60), answerValueSchema)
  .refine((obj) => {
    const count = Object.keys(obj).length;
    return count >= 2 && count <= 6;
  }, 'Expected between 2 and 6 answers.');

export const careerQuizSubmitSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().email('Enter a valid email.').max(255),
  phone: z.string().trim().min(4, 'Enter a valid phone number.').max(50),
  audience: z.enum(['SELF', 'CHILD']).optional().default('SELF'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  // Drives the kid-vs-adult question set (see career-test.tsx) and is
  // passed into the AI prompt for age-appropriate tone/vocabulary.
  age: z.number().int().min(4).max(100),
  answers: answersSchema,
  // Optional pass-through from an admin-generated link (e.g.
  // /career-test?ref=sofi) — attribution only, never access control.
  ref: z.string().trim().max(100).optional().nullable(),
});
