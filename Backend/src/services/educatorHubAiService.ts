import { z } from 'zod';
import { callTextModel, isAiAgentConfigured, AiAgentError, InlineImagePart } from './aiAgentService';

// ============================================================
// AI Educator VIP Hub — the top 3 survey-ranked modules (56% combined
// demand), built for real generation now; the other 4 (SEN adaptations,
// ESG lesson planner, bureaucracy automation, parent reports) ship as
// "coming soon" cards on the frontend with no backend here yet — see
// pages/dashboard/tools/educator-hub.tsx's own comment for that split.
//
// All three reuse aiAgentService.ts's callTextModel (3-model Gemini
// fallback + Azure OpenAI 4th rung for text, inline base64 images for the
// grading module) rather than a new model-calling implementation — same
// "exactly one place owns the model/retry config" reasoning as every other
// caller of that function (adminBlog.ts, aiAgentsSuite.ts, cron.ts).
// Every prompt/output shape below follows examProctoringService.ts's
// generateExamQuestions() convention: strict-JSON instruction as the
// prompt's last line, JSON.parse + zod safeParse, typed error on either
// failure.
// ============================================================

export { isAiAgentConfigured };

export class EducatorAiError extends AiAgentError {}

function parseOrThrow<T extends z.ZodTypeAny>(raw: string, schema: T): z.infer<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new EducatorAiError('Gemini returned malformed JSON.');
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new EducatorAiError('Gemini returned an unexpected response format.');
  }
  return result.data;
}

const LANGUAGE_NAME: Record<'ka' | 'en', string> = { ka: 'Georgian', en: 'English' };

// ---- Module 1: Smart Test & Answer Key Generator ----

export interface GenerateTestParams {
  subject: string;
  grade: string;
  topic: string;
  questionTypes: Array<'MULTIPLE_CHOICE' | 'OPEN' | 'MATCHING'>;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'MIXED';
  questionCount: number;
  language: 'ka' | 'en';
}

const testGenerationSchema = z.object({
  testSheet: z.string().min(1),
  answerKey: z.string().min(1),
});

export type GeneratedTest = z.infer<typeof testGenerationSchema>;

const QUESTION_TYPE_LABEL: Record<GenerateTestParams['questionTypes'][number], string> = {
  MULTIPLE_CHOICE: 'multiple-choice (4 options, one correct)',
  OPEN: 'open-ended free-response',
  MATCHING: 'matching (two columns to pair up)',
};

export async function generateTestAndAnswerKey(params: GenerateTestParams): Promise<GeneratedTest> {
  const lang = LANGUAGE_NAME[params.language];
  const types = params.questionTypes.map((t) => QUESTION_TYPE_LABEL[t]).join(', ');
  const difficultyClause =
    params.difficulty === 'MIXED'
      ? 'a mix of easy, medium, and hard questions'
      : `${params.difficulty.toLowerCase()}-difficulty questions throughout`;

  const prompt = `You are an experienced ${params.subject} teacher writing a real classroom test for grade ${params.grade} students, on the topic: "${params.topic}".

Write ${lang}, formatted as clean Markdown. Generate exactly ${params.questionCount} questions total, using these question type(s): ${types}. Use ${difficultyClause}. Number every question. For multiple-choice questions, label options A/B/C/D on their own lines. For matching questions, present two clearly labeled columns. Leave visible blank space (an underscored line or empty space) for students to write answers on the test sheet itself — this is a printable document a teacher hands to students.

Then write a SEPARATE teacher's answer key: the correct answer for every question, plus a one-line explanation of why it's correct (for multiple-choice/matching) or a model answer / key points expected (for open questions).

Respond with strict JSON matching this shape, where both fields are Markdown strings:
{"testSheet": string, "answerKey": string}`;

  const raw = await callTextModel(prompt, 0.6);
  return parseOrThrow(raw, testGenerationSchema);
}

// ---- Module 2: Assessment Rubrics & Matrix Builder ----

export interface GenerateRubricParams {
  subject: string;
  grade: string;
  assessmentType: 'FORMATIVE' | 'SUMMATIVE';
  skillOrTopic: string;
  scoringScale: string; // e.g. "0-10", "1-5", "ვერ აკმაყოფილებს / ნაწილობრივ / სრულად"
  language: 'ka' | 'en';
}

const rubricGenerationSchema = z.object({
  rubric: z.string().min(1),
});

export type GeneratedRubric = z.infer<typeof rubricGenerationSchema>;

export async function generateRubric(params: GenerateRubricParams): Promise<GeneratedRubric> {
  const lang = LANGUAGE_NAME[params.language];
  const assessmentLabel = params.assessmentType === 'FORMATIVE' ? 'formative (ongoing, low-stakes)' : 'summative (final, graded)';

  const prompt = `You are an experienced ${params.subject} teacher in Georgia, building a ${assessmentLabel} evaluation rubric for grade ${params.grade} students, assessing: "${params.skillOrTopic}". Align the rubric's structure and criteria with Georgia's National Curriculum (ესგ) assessment approach — clear, observable criteria rather than vague labels.

Write ${lang}, formatted as a clean Markdown table (or tables) that a teacher can use directly. Use this scoring scale: ${params.scoringScale}. For each criterion, describe what performance looks like at every level of the scale — specific, observable, actionable language a teacher could apply consistently across different students' work, not generic filler.

Respond with strict JSON matching this shape, where the field is a Markdown string containing the full rubric (criteria table(s) plus a short intro line):
{"rubric": string}`;

  const raw = await callTextModel(prompt, 0.5);
  return parseOrThrow(raw, rubricGenerationSchema);
}

// ---- Module 3: Automated Homework Grading & Feedback Writer ----

export interface GradeHomeworkParams {
  assignmentPrompt: string;
  studentWorkText?: string;
  studentWorkImage?: InlineImagePart;
  gradingScale: string; // e.g. "0-100", "0-10"
  language: 'ka' | 'en';
}

const gradingResultSchema = z.object({
  score: z.string().min(1),
  errorAnalysis: z.string().min(1),
  feedback: z.string().min(1),
});

export type GradedHomework = z.infer<typeof gradingResultSchema>;

export async function gradeHomework(params: GradeHomeworkParams): Promise<GradedHomework> {
  if (!params.studentWorkText && !params.studentWorkImage) {
    throw new EducatorAiError('No student work was provided to grade.', 400);
  }
  const lang = LANGUAGE_NAME[params.language];
  const workBlock = params.studentWorkImage
    ? '\n\nThe student\'s handwritten/typed work is attached as an image — read it carefully, including handwriting, before grading.'
    : `\n\nThe student's submitted work (as text):\n${params.studentWorkText!.slice(0, 12000)}`;

  const prompt = `You are an experienced, fair teacher grading one student's homework submission against this assignment/rubric: "${params.assignmentPrompt}".${workBlock}

Write ${lang}. Grade using this scale: ${params.gradingScale}. Be specific and evidence-based — reference the actual content of the student's work, never generic praise or criticism.

Produce three things, each formatted as Markdown:
1. A score on the given scale, with one short sentence of justification.
2. An error analysis: concretely flag the specific mistakes, misunderstandings, or weak points found in the work (quote or reference them directly), organized as a short list.
3. Constructive feedback written directly to the student (and readable by a parent) — what they did well, what to improve, and one concrete, encouraging next step. Warm but honest, never empty flattery.

Respond with strict JSON matching this shape:
{"score": string, "errorAnalysis": string, "feedback": string}`;

  const raw = await callTextModel(prompt, 0.4, params.studentWorkImage ? [params.studentWorkImage] : undefined);
  return parseOrThrow(raw, gradingResultSchema);
}
