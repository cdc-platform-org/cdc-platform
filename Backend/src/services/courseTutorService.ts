import { azureOpenai } from '../utils/azureOpenai';
import { GEMINI_API_KEY, AZURE_OPENAI_DEPLOYMENT_NAME } from '../utils/env';
import { isAzureOpenAiConfigured } from './azureOpenAiService';

// ============================================================
// In-course AI Tutor — powers POST /api/ai/course-tutor. Same provider/
// pattern as services/businessAiChatService.ts, but the "knowledge base"
// here is the specific course/section/lesson the student is currently
// viewing instead of an admin-configured KnowledgeDocument set.
// ============================================================

export function isCourseTutorConfigured(): boolean {
  return !!GEMINI_API_KEY || isAzureOpenAiConfigured();
}

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
  if (!isCourseTutorConfigured()) {
    throw new CourseTutorError('The AI tutor is not configured (GEMINI_API_KEY/AZURE_OPENAI_* missing).');
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

  // AUDIT NOTE (fixed): systemInstruction (course/lesson context) and
  // params.history (prior conversation turns) were both built/received but
  // never actually sent — only the student's bare current message was, so
  // the tutor answered with zero awareness of the course, lesson, or any
  // earlier turns in the conversation. Now sent as a proper system + history
  // + current-message chat array, with up to 3 retry attempts.
  const messages = [
    { role: 'system' as const, content: systemInstruction },
    ...params.history.slice(-HISTORY_TURN_LIMIT).map((turn) => ({
      role: (turn.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: turn.content,
    })),
    { role: 'user' as const, content: params.message },
  ];

  let reply = '';
  let lastErr: unknown;
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await azureOpenai.chat.completions.create({ model: AZURE_OPENAI_DEPLOYMENT_NAME, messages });
      reply = response.choices[0]?.message?.content || '';
      if (!reply) throw new CourseTutorError('AI provider returned an empty response.');
      break;
    } catch (err) {
      lastErr = err;
      reply = '';
      console.error(`[courseTutorService] attempt ${attempt}/${MAX_ATTEMPTS} failed:`, err instanceof Error ? err.message : err);
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  if (!reply) {
    throw lastErr instanceof CourseTutorError
      ? lastErr
      : new CourseTutorError(lastErr instanceof Error ? `AI request failed: ${lastErr.message}` : 'AI request failed.');
  }
  return reply;
}
