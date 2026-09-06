import { z } from 'zod';

// Mirrors the 3-question flow that used to run entirely inside the
// homepage chat widget (see Frontend's lib/gemini.ts git history) — kept as
// free-text answers (not a closed enum) since the quiz UI presents a small,
// fixed set of button choices per question, but storing the actual chosen
// label text (not an opaque code) is what a human admin reviewing
// career_quiz_submissions later actually wants to read.
export const careerQuizSubmitSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().email('Enter a valid email.').max(255),
  phone: z.string().trim().min(4, 'Enter a valid phone number.').max(50),
  audience: z.enum(['SELF', 'CHILD']).optional().default('SELF'),
  interests: z.string().trim().min(1).max(300),
  experience: z.string().trim().min(1).max(300),
  mainGoal: z.string().trim().min(1).max(300),
  // Optional pass-through from an admin-generated pre-filled link
  // (e.g. /career-test?age=14&ref=sofi) — see CareerQuizSubmission's own
  // schema comment. Never used for access control, only attribution.
  age: z.number().int().min(1).max(120).optional().nullable(),
  ref: z.string().trim().max(100).optional().nullable(),
});
