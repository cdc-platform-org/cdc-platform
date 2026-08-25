import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { GEMINI_API_KEY } from '../utils/env';
import { GEMINI_REQUEST_OPTIONS } from '../utils/geminiRequestOptions';

// Reuses the same Gemini client/model/JSON-validation posture as
// aiExamService.ts (the course-certification exam generator) — see that
// file's comments for why gemini-flash-latest specifically. Kept as a
// separate service rather than extending aiExamService.ts because the
// question shape here is different (adds a practical/open-ended question)
// and this also grades free-text answers, which aiExamService.ts never does.
export function isSkillTestConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

const client = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export interface SkillMcqQuestion {
  id: string;
  type: 'mcq';
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

export interface SkillPracticalQuestion {
  id: string;
  type: 'practical';
  question: string;
  // Not shown to the freelancer — what the AI grader checks the answer
  // against (see gradePracticalAnswer below).
  rubric: string;
}

export type SkillQuestion = SkillMcqQuestion | SkillPracticalQuestion;

const mcqSchema = z.object({
  question: z.string().min(1),
  options: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1), D: z.string().min(1) }),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string().min(1),
});
const practicalSchema = z.object({
  question: z.string().min(1),
  rubric: z.string().min(1),
});
const skillTestResponseSchema = z.object({
  mcqQuestions: z.array(mcqSchema).length(5),
  practicalQuestion: practicalSchema,
});

export class SkillTestGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillTestGenerationError';
  }
}

function languageLine(lang: 'ka' | 'en'): string {
  return lang === 'ka'
    ? '\nWrite "question", "options", "explanation", and "rubric" fields in Georgian (ქართული). Keep standard industry/technical terms that are normally used in English even in Georgian technical speech in English (e.g. tool names, "API", "SEO").'
    : '\nWrite all fields entirely in English.';
}

// Generates 5 multiple-choice questions (mixing theory and applied
// scenarios, per the spec) plus 1 open-ended practical question, all scoped
// to a single freelancer skill. `skillName` can be a curated
// src/data/freelancerSkills.ts value or a free-typed "Other" skill — either
// way it's just a string the prompt reads, no enum/lookup needed, which is
// what makes this work for arbitrary custom skills too.
export async function generateSkillTestQuestions(skillName: string, lang: 'ka' | 'en'): Promise<SkillQuestion[]> {
  if (!client) {
    throw new SkillTestGenerationError('Gemini is not configured (GEMINI_API_KEY missing).');
  }

  const prompt = `You are building a professional skill-verification test for a freelance marketplace. The skill being tested is: "${skillName}".${languageLine(lang)}

Generate exactly 5 multiple-choice questions that test real, practical competence in "${skillName}" — a mix of theory questions and applied/scenario-based questions (not trivia). Each must have exactly 4 options (A, B, C, D), one correct answer, and a short explanation of why it's correct.

Then generate exactly 1 open-ended practical question that asks the candidate to describe how they would approach a realistic task or problem involving "${skillName}" (a few sentences of free-text answer expected, not a code editor). Also produce a grading rubric for that practical question — a short paragraph describing what a strong, competent answer should include, for an AI grader to score against later.

Respond with strict JSON matching this shape:
{"mcqQuestions": [{"question": string, "options": {"A": string, "B": string, "C": string, "D": string}, "correctAnswer": "A"|"B"|"C"|"D", "explanation": string}], "practicalQuestion": {"question": string, "rubric": string}}`;

  const model = client.getGenerativeModel({
    model: 'gemini-flash-latest',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
  }, GEMINI_REQUEST_OPTIONS);

  let raw: string;
  try {
    const result = await model.generateContent(prompt);
    raw = result.response.text();
  } catch (err) {
    throw new SkillTestGenerationError(err instanceof Error ? `Gemini request failed: ${err.message}` : 'Gemini request failed.');
  }
  if (!raw) throw new SkillTestGenerationError('Gemini returned an empty response.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SkillTestGenerationError('Gemini returned malformed JSON.');
  }

  const result = skillTestResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new SkillTestGenerationError('Gemini returned an unexpected question format.');
  }

  const mcqQuestions: SkillMcqQuestion[] = result.data.mcqQuestions.map((q, i) => ({ id: `mcq${i + 1}`, type: 'mcq', ...q }));
  const practicalQuestion: SkillPracticalQuestion = { id: 'practical1', type: 'practical', ...result.data.practicalQuestion };
  return [...mcqQuestions, practicalQuestion];
}

const gradeResponseSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string().min(1),
});

export interface PracticalGradeResult {
  score: number;
  feedback: string;
}

// Grades a freelancer's free-text answer to the practical question against
// the rubric generateSkillTestQuestions() produced for it. Unlike the MCQ
// portion (graded locally by comparing to correctAnswer, no AI call needed
// at submit time), there is no non-AI fallback for this — an open-ended
// answer can't be auto-graded without it. If Gemini is unavailable at
// submit time, routes/skillTests.ts surfaces a clear "try again" error
// rather than guessing a score, since this becomes a public credential.
export async function gradePracticalAnswer(params: {
  skillName: string;
  question: string;
  rubric: string;
  answer: string;
  lang: 'ka' | 'en';
}): Promise<PracticalGradeResult> {
  if (!client) {
    throw new SkillTestGenerationError('Gemini is not configured (GEMINI_API_KEY missing).');
  }

  const prompt = `You are grading a freelancer's answer to a practical skill-verification question for the skill "${params.skillName}".

Question: ${params.question}
Grading rubric (what a strong answer should include): ${params.rubric}
Candidate's answer: ${params.answer || '(no answer submitted)'}

Score the answer from 0 to 100 based on how well it demonstrates real competence per the rubric — a genuinely strong, specific, correct answer should score 80+; a vague, generic, or incorrect answer should score well below that. Also write one short sentence of feedback${params.lang === 'ka' ? ' in Georgian (ქართული)' : ' in English'}.

Respond with strict JSON matching this shape:
{"score": number, "feedback": string}`;

  const model = client.getGenerativeModel({
    model: 'gemini-flash-latest',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
  }, GEMINI_REQUEST_OPTIONS);

  let raw: string;
  try {
    const result = await model.generateContent(prompt);
    raw = result.response.text();
  } catch (err) {
    throw new SkillTestGenerationError(err instanceof Error ? `Gemini grading request failed: ${err.message}` : 'Gemini grading request failed.');
  }
  if (!raw) throw new SkillTestGenerationError('Gemini returned an empty grading response.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SkillTestGenerationError('Gemini returned a malformed grading response.');
  }

  const result = gradeResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new SkillTestGenerationError('Gemini returned an unexpected grading format.');
  }
  return result.data;
}

// Static fallback question set — used only when the AI generator is
// unavailable (no GEMINI_API_KEY, quota exhausted, request failure, or a
// malformed response), same reasoning as freelancerExam.ts's
// FALLBACK_QUESTIONS. Necessarily generic (professional-competence
// questions, not skill-specific) since skills here are an open-ended set,
// not a fixed small enum with a curated bank per value — good enough to
// keep the test usable during an outage rather than hard-failing.
export const GENERIC_FALLBACK_QUESTIONS: SkillQuestion[] = [
  {
    id: 'f1',
    type: 'mcq',
    question: 'A client asks you to complete extra work that is outside the agreed project scope. What is the most professional first step?',
    options: {
      A: 'Silently complete the extra work for free',
      B: 'Discuss it and agree on pricing/timeline before proceeding',
      C: 'Refuse to communicate further',
      D: 'End the contract immediately',
    },
    correctAnswer: 'B',
    explanation: 'Scope changes should be discussed and agreed on before proceeding, protecting both sides.',
  },
  {
    id: 'f2',
    type: 'mcq',
    question: 'Before delivering final work to a client, what should you typically do?',
    options: {
      A: 'Skip review to save time',
      B: 'Review/test the deliverable against the agreed requirements',
      C: 'Ask the client to test everything themselves first',
      D: 'Send it without checking the requested format',
    },
    correctAnswer: 'B',
    explanation: 'Reviewing work against the original requirements before delivery catches issues early.',
  },
  {
    id: 'f3',
    type: 'mcq',
    question: 'What is the main purpose of a project scope document?',
    options: {
      A: 'To track personal expenses',
      B: 'To clearly define deliverables, timeline, and boundaries of a project',
      C: 'To replace a contract entirely',
      D: 'To advertise your services',
    },
    correctAnswer: 'B',
    explanation: 'A scope document defines what is (and is not) included in a project.',
  },
  {
    id: 'f4',
    type: 'mcq',
    question: 'If you cannot meet an agreed deadline, what is the most professional approach?',
    options: {
      A: 'Say nothing until the deadline passes',
      B: 'Proactively inform the client early and propose a new timeline',
      C: 'Blame the client for the delay',
      D: 'Stop responding',
    },
    correctAnswer: 'B',
    explanation: 'Proactive, early communication is the professional way to handle a missed deadline.',
  },
  {
    id: 'f5',
    type: 'mcq',
    question: 'Which practice most helps a freelancer avoid missing deadlines across multiple clients?',
    options: {
      A: 'Accepting unlimited simultaneous projects',
      B: 'Tracking tasks/deadlines with a planner or project management tool',
      C: 'Avoiding any written agreements',
      D: 'Working exclusively at night',
    },
    correctAnswer: 'B',
    explanation: 'Tracking tasks and deadlines systematically reduces the risk of missing them.',
  },
  {
    id: 'practical1',
    type: 'practical',
    question: 'Describe, in a few sentences, how you would approach a new project in this skill for a client who has given you only a brief, high-level description of what they want.',
    rubric: 'A strong answer clarifies requirements before starting, breaks the work into concrete steps, mentions checking in with the client at key points, and describes how they would verify the final result meets the client\'s actual need.',
  },
];
