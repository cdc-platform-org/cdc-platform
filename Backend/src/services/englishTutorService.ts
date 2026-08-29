import { z } from 'zod';
import { callTextModel, AiAgentError } from './aiAgentService';
import { isAzureOpenAiConfigured } from './azureOpenAiService';
import { GEMINI_API_KEY } from '../utils/env';

// ============================================================
// AI ENGLISH TUTOR — Phase 1 & 2 prompt engineering chain.
//
// Reuses aiAgentService.callTextModel (same gemini-flash-latest →
// gemini-flash-lite-latest → gemini-3.5-flash → Azure OpenAI resilience
// chain every other AI feature in this codebase goes through) rather than
// building a separate Gemini client — see that file's own comment for why.
// Every generation function below validates Gemini's JSON output with zod
// before it's ever persisted to a TutorLesson row, same "never trust raw
// model output" posture as aiExamService.generateExamQuestions.
// ============================================================

export function isEnglishTutorConfigured(): boolean {
  return !!GEMINI_API_KEY || isAzureOpenAiConfigured();
}

export class EnglishTutorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnglishTutorError';
  }
}

export type TutorTaskType = 'READING' | 'WRITING' | 'GRAMMAR' | 'VOCABULARY' | 'QUIZ' | 'LISTENING' | 'DIALOGUE';
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

// Upper-intermediate and above is the Pro-gated band — a simple, explicit
// freemium line (advanced content behind the paywall, A1-B1 stays free to
// try the product) rather than gating specific task types, since the RFC's
// "gate Pro-level tasks" reads naturally as "advanced-level lessons," not
// "some of the 6 task types are entirely unavailable on FREE."
const PRO_LEVELS: readonly CefrLevel[] = ['B2', 'C1', 'C2'];
export function isProLevel(level: CefrLevel): boolean {
  return PRO_LEVELS.includes(level);
}

async function callAndValidate<T>(prompt: string, temperature: number, schema: z.ZodType<T>, errorLabel: string): Promise<T> {
  let raw: string;
  try {
    raw = await callTextModel(prompt, temperature);
  } catch (err) {
    throw new EnglishTutorError(err instanceof AiAgentError ? err.message : `${errorLabel} generation request failed.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new EnglishTutorError(`${errorLabel}: AI provider returned malformed JSON.`);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new EnglishTutorError(`${errorLabel}: AI provider returned an unexpected format.`);
  return result.data;
}

// Every learner request carries `nativeLang` as free text (see
// TutorLesson.nativeLang's own schema comment for why this is decoupled
// from router.locale) — interpreted by the model itself rather than
// mapped through a fixed code list, so a new native language needs no code
// change here.
function nativeLanguageLine(nativeLang: string): string {
  return `The student's native/support language is "${nativeLang}" — interpret this as the actual language (it may be an ISO 639-1 code like "ka"/"az"/"hy"/"ru" or a language name). Write any translations, glosses, or bridging explanations in that language. The core lesson content itself (passages, questions, example sentences) stays in English — this is an English-learning tool, not a translation tool.`;
}

export type TutorLearningGoal = 'TRAVEL' | 'TECHNICAL_IT' | 'BUSINESS' | 'ACADEMIC' | 'GENERAL_DAILY' | 'INTERVIEW_PREP';

const LEARNING_GOAL_CONTEXT: Record<TutorLearningGoal, string> = {
  TRAVEL: 'traveling abroad — airports, hotels, directions, ordering food, small talk with strangers',
  TECHNICAL_IT: 'working in IT/tech — code reviews, standups, technical documentation, bug reports, developer terminology',
  BUSINESS: 'business/professional communication — emails, meetings, negotiations, presentations',
  ACADEMIC: 'academic study — essays, lectures, research discussion, formal argumentation',
  GENERAL_DAILY: 'everyday general English — daily life, casual conversation, common situations',
  INTERVIEW_PREP: 'job interview preparation — answering common interview questions, describing experience, professional self-presentation',
};

// Optional — a student with no `tutorLearningGoal` set yet still gets fully
// normal lessons (topic-per-request, same as before goals existed); this
// only narrows vocabulary/scenario choice toward the student's stated goal
// when one is known.
function learningGoalLine(goal?: TutorLearningGoal): string {
  return goal ? `The student's current learning goal is ${goal.replace(/_/g, ' ').toLowerCase()}: prefer vocabulary, scenarios, and examples relevant to ${LEARNING_GOAL_CONTEXT[goal]}, where it fits naturally with the requested topic/level.` : '';
}

// Every generation prompt identifies the system as IMIAKO — the AI English
// Tutor's official persona/brand name (per product decision) — so
// Gemini's own first-person framing ("as your tutor, I...") inside
// generated copy (e.g. WRITING guidance, GRAMMAR explanations) is
// consistent with what the UI itself calls the assistant. This is NOT
// applied to the DIALOGUE roleplay persona (generateDialogue/
// generateDialogueReply below) — a roleplay character (waiter, interviewer,
// etc.) staying in character must never refer to itself as IMIAKO.
const IMIAKO_PERSONA_LINE = 'You are IMIAKO, the AI English Tutor on CDC (cdc.org.ge) — a warm, encouraging, and precise English teacher.';

// Admin-configurable extras (see TutorPromptOverride) — threaded through
// every generate* function below rather than having each one query the DB
// itself, keeping this file Prisma-free (see the file's own header
// comment). `promptOverride` is appended, not substituted, into the base
// prompt; `temperatureOverride` replaces that taskType's hardcoded default
// when set.
export interface TutorGenerationExtras {
  learningGoal?: TutorLearningGoal;
  promptOverride?: string;
  temperatureOverride?: number;
}

function promptOverrideBlock(extras?: TutorGenerationExtras): string {
  return extras?.promptOverride ? `\nAdditional instructions from the platform admin: ${extras.promptOverride}` : '';
}

// ---- Shared multiple-choice question shape, reused by READING/LISTENING/
// VOCABULARY/GRAMMAR/QUIZ — same shape as aiExamService.GeneratedQuestion,
// duplicated rather than imported since this product's questions are
// scored inline against a lesson (not a course ExamAttempt) and may later
// diverge (e.g. gaining a "hint" field) without coupling to that system.
const tutorQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1), D: z.string().min(1) }),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string().min(1),
});
export type TutorQuestion = z.infer<typeof tutorQuestionSchema>;

function questionsPromptBlock(count: number): string {
  return `Generate exactly ${count} multiple-choice comprehension/practice questions. Each must have exactly 4 options (A, B, C, D), one correct answer, and a short explanation (written per the native-language rule above) of why it's correct.`;
}

// ---- READING ----
const readingContentSchema = z.object({
  passage: z.string().min(50),
  vocabulary: z.array(z.object({ word: z.string().min(1), definition: z.string().min(1) })).min(3).max(10),
  questions: z.array(tutorQuestionSchema).min(3),
});
export type ReadingContent = z.infer<typeof readingContentSchema>;

async function generateReading(level: CefrLevel, nativeLang: string, topic?: string, extras?: TutorGenerationExtras): Promise<ReadingContent> {
  const topicLine = topic ? `Topic/focus: ${topic}.` : 'Choose an engaging, level-appropriate topic.';
  const prompt = `${IMIAKO_PERSONA_LINE} You are generating a reading-comprehension exercise for a CEFR ${level}-level learner. ${topicLine} ${learningGoalLine(extras?.learningGoal)}
${nativeLanguageLine(nativeLang)}

Write a passage in English (120-300 words, vocabulary/grammar complexity appropriate for ${level}). List 3-10 key vocabulary words from the passage with a short definition each (definition written per the native-language rule). ${questionsPromptBlock(4)}${promptOverrideBlock(extras)}

Respond with strict JSON matching this shape:
{"passage": string, "vocabulary": [{"word": string, "definition": string}], "questions": [{"question": string, "options": {"A": string, "B": string, "C": string, "D": string}, "correctAnswer": "A"|"B"|"C"|"D", "explanation": string}]}`;
  return callAndValidate(prompt, extras?.temperatureOverride ?? 0.7, readingContentSchema, 'Reading lesson');
}

// ---- LISTENING (script narrated client-side via /api/tts + VIPAudioNarrator) ----
const listeningContentSchema = z.object({
  script: z.string().min(50),
  questions: z.array(tutorQuestionSchema).min(3),
});
export type ListeningContent = z.infer<typeof listeningContentSchema>;

async function generateListening(level: CefrLevel, nativeLang: string, topic?: string, extras?: TutorGenerationExtras): Promise<ListeningContent> {
  const topicLine = topic ? `Topic/focus: ${topic}.` : 'Choose an engaging, level-appropriate everyday scenario (conversation, announcement, short story).';
  const prompt = `${IMIAKO_PERSONA_LINE} You are generating a listening-comprehension exercise for a CEFR ${level}-level learner. ${topicLine} ${learningGoalLine(extras?.learningGoal)}
${nativeLanguageLine(nativeLang)}

Write a "script" in English (80-200 words) meant to be read aloud by a text-to-speech voice — natural spoken English, short sentences, vocabulary/grammar complexity appropriate for ${level}. ${questionsPromptBlock(4)}${promptOverrideBlock(extras)}

Respond with strict JSON matching this shape:
{"script": string, "questions": [{"question": string, "options": {"A": string, "B": string, "C": string, "D": string}, "correctAnswer": "A"|"B"|"C"|"D", "explanation": string}]}`;
  return callAndValidate(prompt, extras?.temperatureOverride ?? 0.7, listeningContentSchema, 'Listening lesson');
}

// ---- VOCABULARY ----
const vocabularyContentSchema = z.object({
  words: z
    .array(
      z.object({
        word: z.string().min(1),
        partOfSpeech: z.string().min(1),
        definitionEnglish: z.string().min(1),
        translation: z.string().min(1),
        exampleSentence: z.string().min(1),
      })
    )
    .min(5)
    .max(12),
  questions: z.array(tutorQuestionSchema).min(3),
});
export type VocabularyContent = z.infer<typeof vocabularyContentSchema>;

async function generateVocabulary(level: CefrLevel, nativeLang: string, topic?: string, extras?: TutorGenerationExtras): Promise<VocabularyContent> {
  const topicLine = topic ? `Theme: ${topic}.` : 'Choose a useful everyday theme (e.g. work, travel, daily life).';
  const prompt = `${IMIAKO_PERSONA_LINE} You are generating a vocabulary lesson for a CEFR ${level}-level learner. ${topicLine} ${learningGoalLine(extras?.learningGoal)}
${nativeLanguageLine(nativeLang)}

List 5-12 English words/phrases appropriate for ${level} level around this theme. For each, give its part of speech, an English definition, a translation into the student's native language, and an example sentence in English. Then ${questionsPromptBlock(4).toLowerCase()} testing these words (e.g. "which word means...", fill-in-the-blank via the options).${promptOverrideBlock(extras)}

Respond with strict JSON matching this shape:
{"words": [{"word": string, "partOfSpeech": string, "definitionEnglish": string, "translation": string, "exampleSentence": string}], "questions": [{"question": string, "options": {"A": string, "B": string, "C": string, "D": string}, "correctAnswer": "A"|"B"|"C"|"D", "explanation": string}]}`;
  return callAndValidate(prompt, extras?.temperatureOverride ?? 0.7, vocabularyContentSchema, 'Vocabulary lesson');
}

// ---- GRAMMAR ----
const grammarContentSchema = z.object({
  explanation: z.string().min(20),
  examples: z.array(z.string().min(1)).min(2).max(6),
  questions: z.array(tutorQuestionSchema).min(3),
});
export type GrammarContent = z.infer<typeof grammarContentSchema>;

async function generateGrammar(level: CefrLevel, nativeLang: string, topic?: string, extras?: TutorGenerationExtras): Promise<GrammarContent> {
  const topicLine = topic ? `Grammar point: ${topic}.` : `Pick one specific grammar point genuinely useful at ${level} level (do not pick something too advanced or too basic for this level).`;
  const prompt = `${IMIAKO_PERSONA_LINE} You are generating a grammar lesson for a CEFR ${level}-level learner. ${topicLine} ${learningGoalLine(extras?.learningGoal)}
${nativeLanguageLine(nativeLang)}

Write a short, clear explanation of the grammar point (bridging into the native language where it helps clarity — e.g. contrasting with how the student's native language expresses the same idea). Give 2-6 example sentences in English illustrating correct usage. Then ${questionsPromptBlock(4).toLowerCase()} testing this grammar point.${promptOverrideBlock(extras)}

Respond with strict JSON matching this shape:
{"explanation": string, "examples": [string], "questions": [{"question": string, "options": {"A": string, "B": string, "C": string, "D": string}, "correctAnswer": "A"|"B"|"C"|"D", "explanation": string}]}`;
  return callAndValidate(prompt, extras?.temperatureOverride ?? 0.6, grammarContentSchema, 'Grammar lesson');
}

// ---- QUIZ (general mixed-topic review) ----
const quizContentSchema = z.object({ questions: z.array(tutorQuestionSchema).min(5) });
export type QuizContent = z.infer<typeof quizContentSchema>;

async function generateQuiz(level: CefrLevel, nativeLang: string, topic?: string, extras?: TutorGenerationExtras): Promise<QuizContent> {
  const topicLine = topic ? `Focus the quiz on: ${topic}.` : 'Mix vocabulary, grammar, and general comprehension questions.';
  const prompt = `${IMIAKO_PERSONA_LINE} You are generating a general review quiz for a CEFR ${level}-level learner. ${topicLine} ${learningGoalLine(extras?.learningGoal)}
${nativeLanguageLine(nativeLang)}

${questionsPromptBlock(8)} Vary the question types (vocabulary, grammar, short comprehension) and keep difficulty consistent with ${level} level.${promptOverrideBlock(extras)}

Respond with strict JSON matching this shape:
{"questions": [{"question": string, "options": {"A": string, "B": string, "C": string, "D": string}, "correctAnswer": "A"|"B"|"C"|"D", "explanation": string}]}`;
  return callAndValidate(prompt, extras?.temperatureOverride ?? 0.7, quizContentSchema, 'Quiz');
}

// ---- WRITING (free-text, graded separately via gradeWritingSubmission) ----
const writingContentSchema = z.object({
  prompt: z.string().min(20),
  guidance: z.string().min(10),
  targetWordCount: z.number().int().min(20).max(500),
});
export type WritingContent = z.infer<typeof writingContentSchema>;

async function generateWriting(level: CefrLevel, nativeLang: string, topic?: string, extras?: TutorGenerationExtras): Promise<WritingContent> {
  const topicLine = topic ? `Topic: ${topic}.` : 'Choose an engaging, level-appropriate topic (e.g. a short personal story, opinion, description).';
  const prompt = `${IMIAKO_PERSONA_LINE} You are generating a writing exercise for a CEFR ${level}-level learner. ${topicLine} ${learningGoalLine(extras?.learningGoal)}
${nativeLanguageLine(nativeLang)}

Write a clear writing "prompt" (what the student should write about) and short "guidance" (structure tips, key vocabulary/grammar to try using — written per the native-language rule). Pick a "targetWordCount" appropriate for ${level} level (roughly 40-80 for A1/A2, 80-150 for B1/B2, 150-300 for C1/C2).${promptOverrideBlock(extras)}

Respond with strict JSON matching this shape:
{"prompt": string, "guidance": string, "targetWordCount": number}`;
  return callAndValidate(prompt, extras?.temperatureOverride ?? 0.7, writingContentSchema, 'Writing lesson');
}

// ---- DIALOGUE / ROLEPLAY ----
const dialogueContentSchema = z.object({
  scenario: z.string().min(20),
  rolePlayInstructions: z.string().min(10),
  openingLine: z.string().min(1),
});
export type DialogueContent = z.infer<typeof dialogueContentSchema>;

// Deliberately no IMIAKO_PERSONA_LINE here — this designs a roleplay
// scenario (the AI plays a waiter/interviewer/etc. once the lesson
// starts), not IMIAKO speaking directly; see IMIAKO_PERSONA_LINE's own
// comment.
async function generateDialogue(level: CefrLevel, nativeLang: string, topic?: string, extras?: TutorGenerationExtras): Promise<DialogueContent> {
  const topicLine = topic ? `Scenario theme: ${topic}.` : 'Choose an everyday roleplay scenario (e.g. ordering food, a job interview, asking for directions).';
  const prompt = `You are an English tutor designing a roleplay/dialogue practice exercise for a CEFR ${level}-level learner. ${topicLine} ${learningGoalLine(extras?.learningGoal)}
${nativeLanguageLine(nativeLang)}

Describe the "scenario" (the situation and who the student is talking to), "rolePlayInstructions" (what role the AI tutor plays and what the student should do — written per the native-language rule), and an "openingLine" in English (what the AI says first, appropriate for ${level} level, to kick off the conversation).${promptOverrideBlock(extras)}

Respond with strict JSON matching this shape:
{"scenario": string, "rolePlayInstructions": string, "openingLine": string}`;
  return callAndValidate(prompt, extras?.temperatureOverride ?? 0.8, dialogueContentSchema, 'Dialogue lesson');
}

// ---- PLACEMENT TEST (onboarding step 3 — "Free Diagnostic Placement
// Test, CEFR A1-C1") — deliberately its own generator rather than reusing
// generateQuiz: a placement test needs questions spanning MULTIPLE
// difficulty bands in one set (so the result can say which band the
// student actually passed), while generateQuiz always targets one single
// level the caller already picked. ----
const placementQuestionSchema = tutorQuestionSchema.extend({ level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1']) });
const placementTestSchema = z.object({ questions: z.array(placementQuestionSchema).min(10) });
export type PlacementQuestion = z.infer<typeof placementQuestionSchema>;

export async function generatePlacementTest(nativeLang: string): Promise<PlacementQuestion[]> {
  if (!isEnglishTutorConfigured()) {
    throw new EnglishTutorError('AI English Tutor is not configured yet (GEMINI_API_KEY/AZURE_OPENAI_* missing).');
  }
  const prompt = `${IMIAKO_PERSONA_LINE} You are writing a short diagnostic placement test to determine a new student's CEFR English level, from A1 (beginner) up to C1 (advanced) — C2 is deliberately excluded, since this platform's free tier only needs to distinguish A1 through C1.
${nativeLanguageLine(nativeLang)}

Generate exactly 12 multiple-choice questions covering grammar, vocabulary, and short reading comprehension, tagged with their own individual difficulty "level" (one of A1, A2, B1, B2, C1) — write exactly 2-3 questions per level band, ordered from easiest (A1) to hardest (C1), increasing in difficulty steadily. Each question needs exactly 4 options (A, B, C, D), one correct answer, and a short explanation (written per the native-language rule).

Respond with strict JSON matching this shape:
{"questions": [{"level": "A1"|"A2"|"B1"|"B2"|"C1", "question": string, "options": {"A": string, "B": string, "C": string, "D": string}, "correctAnswer": "A"|"B"|"C"|"D", "explanation": string}]}`;

  const result = await callAndValidate(prompt, 0.6, placementTestSchema, 'Placement test');
  return result.questions;
}

// Deterministic, server-side scoring (same posture as gradeQuestionSet) —
// walks the CEFR ladder from A1 upward and returns the highest band the
// student scored at least PLACEMENT_PASS_THRESHOLD on, falling back to A1
// if even that band wasn't passed (never returns nothing — every student
// starts somewhere).
const PLACEMENT_LEVEL_ORDER: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
const PLACEMENT_PASS_THRESHOLD = 0.6;

export function estimatePlacementLevel(questions: PlacementQuestion[], answers: Record<string, string>): CefrLevel {
  let result: CefrLevel = 'A1';
  for (const level of PLACEMENT_LEVEL_ORDER) {
    const levelQuestions = questions
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => q.level === level);
    if (levelQuestions.length === 0) continue;
    const correctCount = levelQuestions.filter(({ q, i }) => answers[String(i)] === q.correctAnswer).length;
    if (correctCount / levelQuestions.length >= PLACEMENT_PASS_THRESHOLD) {
      result = level;
    } else {
      break;
    }
  }
  return result;
}

export interface GenerateTutorLessonParams {
  taskType: TutorTaskType;
  level: CefrLevel;
  nativeLang: string;
  topic?: string;
  extras?: TutorGenerationExtras;
}

// Single dispatch entry point routes/englishTutor.ts calls — returns the
// zod-validated content for whichever taskType was requested, ready to be
// persisted as TutorLesson.content.
export async function generateTutorLesson(params: GenerateTutorLessonParams): Promise<unknown> {
  if (!isEnglishTutorConfigured()) {
    throw new EnglishTutorError('AI English Tutor is not configured yet (GEMINI_API_KEY/AZURE_OPENAI_* missing).');
  }
  const { taskType, level, nativeLang, topic, extras } = params;
  switch (taskType) {
    case 'READING':
      return generateReading(level, nativeLang, topic, extras);
    case 'LISTENING':
      return generateListening(level, nativeLang, topic, extras);
    case 'VOCABULARY':
      return generateVocabulary(level, nativeLang, topic, extras);
    case 'GRAMMAR':
      return generateGrammar(level, nativeLang, topic, extras);
    case 'QUIZ':
      return generateQuiz(level, nativeLang, topic, extras);
    case 'WRITING':
      return generateWriting(level, nativeLang, topic, extras);
    case 'DIALOGUE':
      return generateDialogue(level, nativeLang, topic, extras);
  }
}

// Strips the auto-graded answer key (correctAnswer/explanation) out of any
// question-based lesson content before it's ever sent to the client on
// first load — same "never trust/expose the answer key to the grader's own
// client" posture as an exam route never shipping ExamAttempt's stored
// correct answers pre-submission. Only gradeTutorSubmission (below) sees
// the real content server-side. WRITING/DIALOGUE content has no answer key
// to strip, so it's returned as-is.
export function sanitizeLessonContentForClient(taskType: TutorTaskType, content: unknown): unknown {
  const stripQuestions = (questions: TutorQuestion[]) => questions.map(({ question, options }) => ({ question, options }));
  switch (taskType) {
    case 'READING': {
      const c = content as ReadingContent;
      return { ...c, questions: stripQuestions(c.questions) };
    }
    case 'LISTENING': {
      const c = content as ListeningContent;
      return { ...c, questions: stripQuestions(c.questions) };
    }
    case 'VOCABULARY': {
      const c = content as VocabularyContent;
      return { ...c, questions: stripQuestions(c.questions) };
    }
    case 'GRAMMAR': {
      const c = content as GrammarContent;
      return { ...c, questions: stripQuestions(c.questions) };
    }
    case 'QUIZ': {
      const c = content as QuizContent;
      return { ...c, questions: stripQuestions(c.questions) };
    }
    case 'WRITING':
    case 'DIALOGUE':
      return content;
  }
}

export interface TutorGradingResult {
  score: number | null;
  feedback: {
    summary: string;
    strengths?: string[];
    corrections?: string[];
    perQuestion?: { correct: boolean; explanation: string }[];
  };
}

// Deterministic, server-side, no AI call — mirrors how every other
// multiple-choice grading in this codebase works (compare the submitted
// choice against the stored correctAnswer). `answers` is keyed by question
// index as a string ("0", "1", ...), matching the order questions were
// generated/sanitized in.
function gradeQuestionSet(questions: TutorQuestion[], answers: Record<string, string>): TutorGradingResult {
  let correctCount = 0;
  const perQuestion = questions.map((q, i) => {
    const correct = answers[String(i)] === q.correctAnswer;
    if (correct) correctCount += 1;
    return { correct, explanation: q.explanation };
  });
  const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  return {
    score,
    feedback: {
      summary: `${correctCount}/${questions.length} correct.`,
      perQuestion,
    },
  };
}

const aiGradingSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string().min(5),
  strengths: z.array(z.string()).max(5).default([]),
  corrections: z.array(z.string()).max(8).default([]),
});

async function gradeFreeTextSubmission(taskDescription: string, submittedText: string, level: CefrLevel, nativeLang: string): Promise<TutorGradingResult> {
  if (!submittedText.trim()) {
    return { score: 0, feedback: { summary: 'No response submitted.' } };
  }
  const prompt = `${IMIAKO_PERSONA_LINE} You are grading an English learner's (CEFR ${level} level) response to this exercise: ${taskDescription}

Student's submission:
"""
${submittedText}
"""

${nativeLanguageLine(nativeLang)}
Grade fairly for a ${level}-level learner (do not expect native-level fluency). Give a 0-100 score, a short summary of overall quality, up to 5 specific strengths, and up to 8 specific corrections (grammar/vocabulary/word-choice fixes — quote the original phrase and the fix). Write "summary"/"strengths"/"corrections" per the native-language rule above.

Respond with strict JSON matching this shape:
{"score": number, "summary": string, "strengths": [string], "corrections": [string]}`;

  const result = await callAndValidate(prompt, 0.4, aiGradingSchema, 'Submission grading');
  return { score: result.score, feedback: { summary: result.summary, strengths: result.strengths, corrections: result.corrections } };
}

// Single grading entry point routes/englishTutor.ts calls on submit —
// dispatches to deterministic question-grading for the 5 auto-gradable
// task types, or an AI grading call for the 2 free-text ones. `content` is
// always the FULL (un-sanitized) TutorLesson.content read straight from
// the DB, never the sanitized version a client may have echoed back.
export async function gradeTutorSubmission(
  taskType: TutorTaskType,
  level: CefrLevel,
  nativeLang: string,
  content: unknown,
  responseData: unknown
): Promise<TutorGradingResult> {
  switch (taskType) {
    case 'READING':
    case 'LISTENING':
    case 'VOCABULARY':
    case 'GRAMMAR':
    case 'QUIZ': {
      const questions = (content as { questions: TutorQuestion[] }).questions;
      const answers = (responseData as { answers?: Record<string, string> } | null)?.answers ?? {};
      return gradeQuestionSet(questions, answers);
    }
    case 'WRITING': {
      const c = content as WritingContent;
      const text = (responseData as { text?: string } | null)?.text ?? '';
      return gradeFreeTextSubmission(`Writing prompt: "${c.prompt}" (target ~${c.targetWordCount} words)`, text, level, nativeLang);
    }
    case 'DIALOGUE': {
      const c = content as DialogueContent;
      const turns = (responseData as { turns?: { role: string; text: string }[] } | null)?.turns ?? [];
      const transcript = turns.map((t) => `${t.role === 'student' ? 'Student' : 'Tutor'}: ${t.text}`).join('\n');
      return gradeFreeTextSubmission(`Roleplay scenario: "${c.scenario}". Full conversation transcript:\n${transcript}`, turns.map((t) => t.text).join(' '), level, nativeLang);
    }
  }
}

// ---- Live roleplay turn generation (DIALOGUE only) — the interactive half
// of the Dialogue/Roleplay panel, called on every student message rather
// than only once at submission. Same one-shot request/response shape as
// aiTutorService/course-tutor's generateTutorReply, scoped to this
// product's own DialogueContent/CefrLevel instead. ----
export interface DialogueTurn {
  role: 'student' | 'tutor';
  text: string;
}

const dialogueReplySchema = z.object({ reply: z.string().min(1) });

export async function generateDialogueReply(
  content: DialogueContent,
  level: CefrLevel,
  nativeLang: string,
  history: DialogueTurn[],
  studentMessage: string
): Promise<string> {
  if (!isEnglishTutorConfigured()) {
    throw new EnglishTutorError('AI English Tutor is not configured yet (GEMINI_API_KEY/AZURE_OPENAI_* missing).');
  }
  const historyBlock = history.map((t) => `${t.role === 'student' ? 'Student' : 'You'}: ${t.text}`).join('\n');
  const prompt = `You are role-playing in an English conversation-practice exercise for a CEFR ${level}-level learner.
Scenario: ${content.scenario}
Your role: ${content.rolePlayInstructions}
Stay fully in character. Use vocabulary and sentence complexity appropriate for ${level} level. Keep each reply short and natural (1-3 sentences) — this is a spoken-style conversation, not an essay.
If the student's latest message has a clear grammar or word-choice error, append ONE short correction in square brackets at the end of your reply, written in the student's native language ("${nativeLang}") — e.g. "[Correction: ...]" translated appropriately. If there's no notable error, do not add a bracket note at all.

Conversation so far:
${historyBlock || '(nothing yet — this is the first student reply after your opening line)'}
Student: ${studentMessage}

Respond with strict JSON matching this shape:
{"reply": string}`;

  const result = await callAndValidate(prompt, 0.7, dialogueReplySchema, 'Dialogue reply');
  return result.reply;
}
