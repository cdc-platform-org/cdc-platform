import apiClient from './apiClient';

export type ExamSessionStatus = 'ACTIVE' | 'CLOSED';
export type ExamQuestionType = 'MCQ' | 'PRACTICAL' | 'CODE';
export type ExamSubmissionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FLAGGED';

export interface ExamSessionSummary {
  id: string;
  title: string;
  description: string | null;
  topic: string;
  mcqCount: number;
  durationMinutes: number;
  status: ExamSessionStatus;
  candidateToken: string;
  createdAt: string;
  updatedAt: string;
  _count: { submissions: number };
}

export interface ExamQuestionRow {
  id: string;
  order: number;
  type: ExamQuestionType;
  question: string;
  options: { A: string; B: string; C: string; D: string } | null;
}

export interface AnswerGradeEntry {
  questionId: string;
  questionType: ExamQuestionType;
  question: string;
  candidateAnswer: string;
  aiScore: number | null;
  aiFeedback: string | null;
  aiTextScore: number | null;
  correct?: boolean;
}

export interface AdaptiveStudyGuide {
  id: string;
  candidateEmail: string;
  weakTopics: string[];
  generatedGuideText: string;
  retestExamSessionId: string | null;
  createdAt: string;
}

export interface ExamSubmissionRow {
  id: string;
  candidateName: string;
  candidateEmail: string;
  mcqScore: number | null;
  practicalScore: number | null;
  totalScore: number | null;
  aiEvaluation: string | null;
  answerGrades: AnswerGradeEntry[] | null;
  proctoringViolations: number;
  tabSwitches: number;
  copyPasteCount: number;
  cameraAudioViolations: number;
  integrityScore: number | null;
  aiTextScore: number | null;
  status: ExamSubmissionStatus;
  startedAt: string;
  completedAt: string | null;
  studyGuide: AdaptiveStudyGuide | null;
}

export interface ExamSessionDetail extends Omit<ExamSessionSummary, '_count'> {
  rawContent: string | null;
  questions: ExamQuestionRow[];
  submissions: ExamSubmissionRow[];
}

export interface CreateExamSessionPayload {
  title: string;
  description?: string;
  topic: string;
  rawContent?: string;
  mcqCount: number;
  includeCodeQuestion?: boolean;
  durationMinutes: number;
}

// ============================================================
// BUSINESS — session management + candidate reports
// ============================================================

export async function getMyExamSessions(): Promise<ExamSessionSummary[]> {
  const response = await apiClient.get<{ data: ExamSessionSummary[] }>('/exam-proctoring/sessions');
  return response.data.data;
}

// Two-step upload-then-submit, same pattern as knowledge-base file uploads —
// returns the parsed text to attach as `rawContent` on the create call.
export async function parseExamSourceFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<{ data: { rawContent: string } }>('/exam-proctoring/sessions/parse-source', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data.rawContent;
}

// Same two-step shape as parseExamSourceFile above — a video upload can
// genuinely take a couple of minutes (ffmpeg extraction + Gemini File API
// processing), same reasoning as mediaStudioService.ts's own timeout.
export async function parseExamSourceVideoFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('video', file);
  const response = await apiClient.post<{ data: { rawContent: string } }>('/exam-proctoring/sessions/parse-source-video', formData, {
    timeout: 6 * 60 * 1000,
  });
  return response.data.data.rawContent;
}

export async function parseExamSourceYoutube(youtubeUrl: string): Promise<string> {
  const response = await apiClient.post<{ data: { rawContent: string } }>(
    '/exam-proctoring/sessions/parse-source-video',
    { youtubeUrl },
    { timeout: 6 * 60 * 1000 }
  );
  return response.data.data.rawContent;
}

export async function parseExamSourceImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiClient.post<{ data: { rawContent: string } }>('/exam-proctoring/sessions/parse-source-image', formData, {
    timeout: 60 * 1000,
  });
  return response.data.data.rawContent;
}

export async function createExamSession(payload: CreateExamSessionPayload): Promise<ExamSessionDetail> {
  const response = await apiClient.post<{ data: ExamSessionDetail }>('/exam-proctoring/sessions', payload);
  return response.data.data;
}

export async function getExamSession(id: string): Promise<ExamSessionDetail> {
  const response = await apiClient.get<{ data: ExamSessionDetail }>(`/exam-proctoring/sessions/${id}`);
  return response.data.data;
}

export async function updateExamSessionStatus(id: string, status: ExamSessionStatus): Promise<ExamSessionSummary> {
  const response = await apiClient.patch<{ data: ExamSessionSummary }>(`/exam-proctoring/sessions/${id}`, { status });
  return response.data.data;
}

export async function deleteExamSession(id: string): Promise<void> {
  await apiClient.delete(`/exam-proctoring/sessions/${id}`);
}

export async function downloadExamReport(submissionId: string): Promise<Blob> {
  const response = await apiClient.get(`/exam-proctoring/submissions/${submissionId}/report.pdf`, { responseType: 'blob' });
  return response.data;
}

export async function generateAdaptiveRetest(submissionId: string): Promise<{ studyGuide: AdaptiveStudyGuide; retestSession: ExamSessionSummary }> {
  const response = await apiClient.post<{ data: { studyGuide: AdaptiveStudyGuide; retestSession: ExamSessionSummary } }>(
    `/exam-proctoring/submissions/${submissionId}/generate-retest`
  );
  return response.data.data;
}

// ============================================================
// PUBLIC — candidate-facing (no CDC account, addressed by opaque tokens)
// ============================================================

export interface CandidateExamInfo {
  title: string;
  description: string | null;
  durationMinutes: number;
}

export async function getCandidateExamInfo(candidateToken: string): Promise<CandidateExamInfo> {
  const response = await apiClient.get<{ data: CandidateExamInfo }>(`/exam-proctoring/candidate/${candidateToken}`);
  return response.data.data;
}

export interface StartCandidateExamResult {
  submissionToken: string;
  durationMinutes: number;
  questions: ExamQuestionRow[];
}

export async function startCandidateExam(
  candidateToken: string,
  payload: { candidateName: string; candidateEmail: string }
): Promise<StartCandidateExamResult> {
  const response = await apiClient.post<{ data: StartCandidateExamResult }>(`/exam-proctoring/candidate/${candidateToken}/start`, payload);
  return response.data.data;
}

export async function submitCandidateExam(submissionToken: string, payload: { answers: Record<string, string> }): Promise<void> {
  await apiClient.post(`/exam-proctoring/submissions/${submissionToken}/submit`, payload);
}

// Fire-and-forget: called the instant a real violation happens (tab switch,
// paste, ...) so the count is recorded server-side, timestamped by server
// receipt, rather than only totalled up client-side and reported once at
// submit — see the backend route's own comment for why that mattered.
export type ProctoringEventType =
  | 'TAB_SWITCH'
  | 'COPY_PASTE'
  | 'FULLSCREEN_EXIT'
  | 'FACE_MISSING'
  | 'MULTIPLE_FACES'
  | 'LOOKING_AWAY'
  | 'BACKGROUND_VOICE';

export async function logProctoringEvent(submissionToken: string, type: ProctoringEventType): Promise<void> {
  await apiClient.post(`/exam-proctoring/submissions/${submissionToken}/events`, { type });
}
