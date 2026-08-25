import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '../utils/env';
import { GEMINI_REQUEST_OPTIONS } from '../utils/geminiRequestOptions';

// ============================================================
// In-course AI Tutor — powers POST /api/ai/course-tutor. Same provider/
// pattern as services/businessAiChatService.ts (Gemini, model.startChat +
// sendMessage for multi-turn history), but the "knowledge base" here is
// the specific course/section/lesson the student is currently viewing
// instead of an admin-configured KnowledgeDocument set.
// ============================================================

export function isCourseTutorConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

const client = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export class CourseTutorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CourseTutorError';
  }
}

export interface TutorChatTurn {
  role: 'USER' | 'ASSISTANT';
  content: string;
}

export interface GenerateTutorReplyParams {
  courseTitle: string;
  courseDescription: string;
  sectionTitle: string;
  lessonTitle: string;
  assignmentPrompt: string | null;
  resources: string[];
  // Prior turns in this conversation, oldest first — the caller
  // (routes/ai.ts) caps this before it reaches here.
  history: TutorChatTurn[];
  message: string;
}

// Bounds the prompt size for a long tutoring session, same reasoning as
// businessAiChatService's HISTORY_TURN_LIMIT.
const HISTORY_TURN_LIMIT = 12;

export async function generateTutorReply(params: GenerateTutorReplyParams): Promise<string> {
  if (!client) {
    throw new CourseTutorError('Gemini is not configured (GEMINI_API_KEY missing).');
  }

  const contextLines = [
    `Course: ${params.courseTitle}`,
    `Course description: ${params.courseDescription}`,
    `Current section: ${params.sectionTitle}`,
    `Current lesson: ${params.lessonTitle}`,
  ];
  if (params.assignmentPrompt) contextLines.push(`Assignment for this lesson: ${params.assignmentPrompt}`);
  if (params.resources.length) contextLines.push(`Lesson resources: ${params.resources.join(', ')}`);

  const systemInstruction =
    `You are an expert AI Technical Tutor for the course "${params.courseTitle}". Your focus is to guide the ` +
    `student through the lesson "${params.lessonTitle}" and its assignments. Answer technical questions, ` +
    `explain complex concepts simply, provide code examples, and debug code. Be encouraging, clear, and ` +
    `concise. Guide the student step-by-step rather than giving away direct answers to assignments unless ` +
    `explicitly asked to explain the solution. Stay strictly within the scope of this course's topic — if ` +
    `asked something unrelated, gently redirect the student back to the lesson.\n\n` +
    `Lesson context:\n${contextLines.join('\n')}`;

  const model = client.getGenerativeModel({
    // gemini-flash-latest, not a pinned version — this Google Cloud project
    // has repeatedly deprecated pinned model names (see aiAgentService.ts's
    // comment on Imagen 3/4) while gemini-flash-latest keeps working across
    // every other AI feature in this codebase.
    model: 'gemini-flash-latest',
    systemInstruction,
    generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
  }, GEMINI_REQUEST_OPTIONS);

  const chat = model.startChat({
    history: params.history.slice(-HISTORY_TURN_LIMIT).map((turn) => ({
      role: turn.role === 'USER' ? 'user' : 'model',
      parts: [{ text: turn.content }],
    })),
  });

  let reply: string;
  try {
    const result = await chat.sendMessage(params.message);
    reply = result.response.text();
  } catch (err) {
    throw new CourseTutorError(err instanceof Error ? `Gemini request failed: ${err.message}` : 'Gemini request failed.');
  }
  if (!reply) throw new CourseTutorError('Gemini returned an empty response.');
  return reply;
}
