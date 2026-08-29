import apiClient from './apiClient';

export type TutorTaskType = 'READING' | 'WRITING' | 'GRAMMAR' | 'VOCABULARY' | 'QUIZ' | 'LISTENING' | 'DIALOGUE';
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type PlacementCefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export type TutorLearningGoal = 'TRAVEL' | 'TECHNICAL_IT' | 'BUSINESS' | 'ACADEMIC' | 'GENERAL_DAILY' | 'INTERVIEW_PREP';

export interface TutorQuestionClient {
  question: string;
  options: { A: string; B: string; C: string; D: string };
}

export interface ReadingContent {
  passage: string;
  vocabulary: { word: string; definition: string }[];
  questions: TutorQuestionClient[];
}
export interface ListeningContent {
  script: string;
  questions: TutorQuestionClient[];
}
export interface VocabularyContent {
  words: { word: string; partOfSpeech: string; definitionEnglish: string; translation: string; exampleSentence: string }[];
  questions: TutorQuestionClient[];
}
export interface GrammarContent {
  explanation: string;
  examples: string[];
  questions: TutorQuestionClient[];
}
export interface QuizContent {
  questions: TutorQuestionClient[];
}
export interface WritingContent {
  prompt: string;
  guidance: string;
  targetWordCount: number;
}
export interface DialogueContent {
  scenario: string;
  rolePlayInstructions: string;
  openingLine: string;
}

export type TutorLessonContent = ReadingContent | ListeningContent | VocabularyContent | GrammarContent | QuizContent | WritingContent | DialogueContent;

export interface TutorLesson {
  id: string;
  taskType: TutorTaskType;
  level: CefrLevel;
  nativeLang: string;
  topic: string | null;
  learningGoal: TutorLearningGoal | null;
  isPro: boolean;
  createdAt: string;
  content: TutorLessonContent;
}

export interface TutorLessonListItem {
  id: string;
  taskType: TutorTaskType;
  level: CefrLevel;
  nativeLang: string;
  topic: string | null;
  learningGoal: TutorLearningGoal | null;
  isPro: boolean;
  createdAt: string;
  progress: { id: string; status: 'IN_PROGRESS' | 'COMPLETED'; score: number | null; completedAt: string | null }[];
}

export interface TutorState {
  isPro: boolean;
  tutorNativeLang: string | null;
  tutorLearningGoal: TutorLearningGoal | null;
  dailyGenerationUsed: number;
  dailyGenerationLimit: number | null;
  trialAvailable: boolean;
  trialActive: boolean;
  tutorTrialEndDate: string | null;
  subscriptionTier: 'FREE' | 'PRO';
  subscriptionAutoRenew: boolean;
  subscriptionPeriodEnd: string | null;
}

export interface TutorResumeState {
  userId: string;
  lastLessonId: string | null;
  stepIndex: number;
  audioTimestampSec: number | null;
  updatedAt: string;
}

export interface PlacementQuestionClient {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  level: PlacementCefrLevel;
}
// The full (answer-key-included) question set — echoed back on submit
// since placement questions aren't persisted server-side (see the
// backend route's own comment). Never displayed to the user before submit.
export interface PlacementQuestionFull extends PlacementQuestionClient {
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
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

export async function getTutorState(): Promise<TutorState> {
  const response = await apiClient.get<{ data: TutorState }>('/english-tutor/state');
  return response.data.data;
}

export async function startTutorTrial(): Promise<{ tutorTrialEndDate: string; trialDays: number }> {
  const response = await apiClient.post<{ data: { tutorTrialEndDate: string; trialDays: number } }>('/english-tutor/trial/start');
  return response.data.data;
}

export async function cancelTutorSubscription(): Promise<void> {
  await apiClient.post('/english-tutor/subscription/cancel');
}

export async function setTutorLearningGoal(learningGoal: TutorLearningGoal): Promise<void> {
  await apiClient.put('/english-tutor/goal', { learningGoal });
}

export async function getTutorResumeState(): Promise<TutorResumeState | null> {
  const response = await apiClient.get<{ data: TutorResumeState | null }>('/english-tutor/resume-state');
  return response.data.data;
}

export async function saveTutorResumeState(params: { lastLessonId: string | null; stepIndex: number; audioTimestampSec?: number | null }): Promise<void> {
  await apiClient.put('/english-tutor/resume-state', params);
}

export async function getPlacementTest(nativeLang: string): Promise<{ questions: PlacementQuestionClient[]; raw: PlacementQuestionFull[] }> {
  const response = await apiClient.get<{ data: { questions: PlacementQuestionClient[]; raw: PlacementQuestionFull[] } }>('/english-tutor/placement-test', {
    params: { nativeLang },
  });
  return response.data.data;
}

export async function submitPlacementTest(questions: PlacementQuestionFull[], answers: Record<string, string>): Promise<CefrLevel> {
  const response = await apiClient.post<{ data: { level: CefrLevel } }>('/english-tutor/placement-test/submit', { questions, answers });
  return response.data.data.level;
}

export async function flagTutorContent(params: { lessonId?: string; progressId?: string; reason: string }): Promise<void> {
  await apiClient.post('/english-tutor/flags', params);
}

export async function generateTutorLesson(params: { taskType: TutorTaskType; level: CefrLevel; nativeLang: string; topic?: string }): Promise<TutorLesson> {
  const response = await apiClient.post<{ data: TutorLesson }>('/english-tutor/lessons/generate', params);
  return response.data.data;
}

export async function getTutorLessons(): Promise<TutorLessonListItem[]> {
  const response = await apiClient.get<{ data: TutorLessonListItem[] }>('/english-tutor/lessons');
  return response.data.data;
}

export async function getTutorLesson(id: string): Promise<TutorLesson> {
  const response = await apiClient.get<{ data: TutorLesson }>(`/english-tutor/lessons/${id}`);
  return response.data.data;
}

export async function submitTutorLesson(id: string, responseData: unknown): Promise<{ id: string; score: number | null; feedback: TutorGradingResult['feedback'] }> {
  const response = await apiClient.post<{ data: { id: string; score: number | null; feedback: TutorGradingResult['feedback'] } }>(`/english-tutor/lessons/${id}/submit`, { responseData });
  return response.data.data;
}

export async function sendDialogueMessage(
  id: string,
  history: { role: 'student' | 'tutor'; text: string }[],
  message: string
): Promise<string> {
  const response = await apiClient.post<{ data: { reply: string } }>(`/english-tutor/lessons/${id}/dialogue-message`, { history, message });
  return response.data.data.reply;
}
