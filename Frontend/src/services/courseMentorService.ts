/**
 * API client for the AI Course Mentor Agent — Backend routes/courseMentor.ts
 * (/api/course-mentor). Teacher side: courses, source documents, the
 * generated plan and its approval. UI lives in src/components/tools/courseMentor/.
 */
import apiClient from './apiClient';

export type MentorCourseStatus = 'DRAFT' | 'PLANNING' | 'PLAN_READY' | 'ACTIVE' | 'PLAN_FAILED' | 'ARCHIVED';
export type MentorDocumentStatus = 'PROCESSING' | 'READY' | 'FAILED';
export type MentorLessonKind = 'LEARN' | 'PRACTICE' | 'REVIEW' | 'PROJECT' | 'ASSESSMENT';

export interface CourseInput {
  title: string;
  audience: string;
  goals: string;
  instructions?: string | null;
  teachingLocale: string;
  startDate: string;
  endDate: string;
  weekdays: number[];
  minutesPerLesson: number;
  excludedDates: string[];
  // Empty = the agent picks task types that suit the subject.
  taskTypes: string[];
}

// Must match Backend services/courseMentorAgent/taskTypes.ts.
export const TASK_TYPE_KEYS = ['QUIZ', 'SHORT_ANSWER', 'ESSAY', 'CALCULATION', 'CASE_STUDY', 'MATCHING', 'PRACTICAL', 'DESIGN', 'PROJECT', 'CODING', 'DEBUGGING'] as const;
export type TaskTypeKey = typeof TASK_TYPE_KEYS[number];

export interface MentorCourseListItem {
  id: string;
  title: string;
  status: MentorCourseStatus;
  startDate: string;
  endDate: string;
  joinCode: string;
  createdAt: string;
  _count: { documents: number; lessons: number };
}

export interface MentorDocument {
  id: string;
  filename: string;
  sizeBytes: number;
  sourceUrl: string | null;
  note: string | null;
  status: MentorDocumentStatus;
  error: string | null;
  charCount: number;
  chunkCount: number;
  createdAt: string;
}

export interface MentorModule {
  id: string;
  position: number;
  title: string;
  summary: string;
  weight: number;
}

export interface LessonPlanBody {
  summary: string;
  flow: { step: string; minutes: number }[];
  realWorldExample: string;
  practiceIdeas: { type: string; description: string; difficulty: 'easy' | 'medium' | 'hard' }[];
  homework: { description: string; deliverable: string };
  sourceHeadings: string[];
}

export interface MentorLesson {
  id: string;
  moduleId: string;
  position: number;
  date: string;
  kind: MentorLessonKind;
  title: string;
  objectives: string[];
  topics: string[];
  plan: LessonPlanBody;
  teacherEdited: boolean;
}

export interface MentorCourseDetail extends CourseInput {
  id: string;
  status: MentorCourseStatus;
  planError: string | null;
  planSummary: { courseSummary: string; notesForTeacher: string[] } | null;
  planProgress: { step: string; done: number; total: number } | null;
  planGeneratedAt: string | null;
  joinCode: string;
  classDays: number;
  documents: MentorDocument[];
  modules: MentorModule[];
  lessons: MentorLesson[];
}

export interface LessonEdit {
  title?: string;
  objectives?: string[];
  topics?: string[];
  summary?: string;
  homework?: { description: string; deliverable: string };
}

const BASE = '/course-mentor/courses';

export async function listCourses(): Promise<MentorCourseListItem[]> {
  return (await apiClient.get<{ courses: MentorCourseListItem[] }>(BASE)).data.courses;
}

export async function createCourse(input: CourseInput): Promise<string> {
  return (await apiClient.post<{ course: { id: string } }>(BASE, input)).data.course.id;
}

export async function getCourse(id: string): Promise<MentorCourseDetail> {
  return (await apiClient.get<{ course: MentorCourseDetail }>(`${BASE}/${id}`)).data.course;
}

export async function updateCourse(id: string, input: CourseInput): Promise<void> {
  await apiClient.put(`${BASE}/${id}`, input);
}

export async function archiveCourse(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

export async function uploadDocument(id: string, file: File, onProgress?: (pct: number) => void): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  await apiClient.post(`${BASE}/${id}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 10 * 60_000,
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
}

export async function addLink(id: string, url: string, locale?: string): Promise<void> {
  await apiClient.post(`${BASE}/${id}/links`, { url, locale });
}

export async function addPastedText(id: string, title: string, text: string): Promise<void> {
  await apiClient.post(`${BASE}/${id}/texts`, { title, text });
}

export async function deleteDocument(id: string, documentId: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}/documents/${documentId}`);
}

export async function startPlanning(id: string): Promise<void> {
  await apiClient.post(`${BASE}/${id}/plan`);
}

export async function approvePlan(id: string): Promise<void> {
  await apiClient.post(`${BASE}/${id}/approve`);
}

export async function updateLesson(id: string, lessonId: string, edit: LessonEdit): Promise<MentorLesson> {
  return (await apiClient.patch<{ lesson: MentorLesson }>(`${BASE}/${id}/lessons/${lessonId}`, edit)).data.lesson;
}

// Backend errors carry a safe { message }; fall back to a generic text.
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
  return data?.message || fallback;
}

// ============================================================
// Student side — Backend routes/courseMentorLearn.ts (/api/course-mentor/learn).
// ============================================================

const LEARN = '/course-mentor/learn';

export interface MyMentorCourse {
  courseId: string;
  title: string;
  startDate: string;
  endDate: string;
  lessonCount: number;
  completedLessons: number;
}

export interface StudentLesson {
  id: string;
  moduleId: string;
  position: number;
  date: string;
  kind: MentorLessonKind;
  title: string;
  objectives: string[];
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  score: number | null;
}

export interface StudentCourse {
  id: string;
  title: string;
  minutesPerLesson: number;
  modules: { id: string; position: number; title: string }[];
  lessons: StudentLesson[];
  currentLessonId: string | null;
  progress: { completed: number; total: number; dueByToday: number; averageScore: number | null };
}

export interface MentorTask {
  id: string;
  type: TaskTypeKey;
  isHomework: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  content: { title: string; instructions: string; options?: string[]; starterCode?: string; language?: string };
  answer: string | null;
  attachment: string | boolean | null;
  score: number | null;
  feedback: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
}

export interface LessonEvaluation {
  summary: string;
  objectivesReached: string[];
  strengths: string[];
  struggles: string[];
  nextSteps: string[];
}

export interface LessonSession {
  id: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  score: number | null;
  evaluation: LessonEvaluation | null;
  lesson: { id: string; position: number; title: string; kind: MentorLessonKind; objectives: string[]; date: string };
  messages: { id: string; role: 'student' | 'mentor'; content: string; createdAt: string }[];
  tasks: MentorTask[];
}

export async function joinMentorCourse(code: string): Promise<{ courseId: string; title: string }> {
  return (await apiClient.post<{ courseId: string; title: string }>(`${LEARN}/join`, { code })).data;
}

export async function listMyMentorCourses(): Promise<MyMentorCourse[]> {
  return (await apiClient.get<{ courses: MyMentorCourse[] }>(`${LEARN}/courses`)).data.courses;
}

export async function getStudentCourse(courseId: string): Promise<StudentCourse> {
  return (await apiClient.get<{ course: StudentCourse }>(`${LEARN}/courses/${courseId}`)).data.course;
}

export async function startLesson(courseId: string, lessonId: string, locale: string): Promise<LessonSession> {
  return (await apiClient.post<{ session: LessonSession }>(`${LEARN}/courses/${courseId}/lessons/${lessonId}/start`, { locale }, { timeout: 120_000 })).data.session;
}

export async function getSession(sessionId: string): Promise<LessonSession> {
  return (await apiClient.get<{ session: LessonSession }>(`${LEARN}/sessions/${sessionId}`)).data.session;
}

export async function sendMentorMessage(sessionId: string, text: string): Promise<{ reply: string; escalated: boolean }> {
  return (await apiClient.post<{ reply: string; escalated: boolean }>(`${LEARN}/sessions/${sessionId}/messages`, { text }, { timeout: 120_000 })).data;
}

export async function requestTasks(sessionId: string, homework: boolean): Promise<MentorTask[]> {
  return (await apiClient.post<{ tasks: MentorTask[] }>(`${LEARN}/sessions/${sessionId}/tasks`, { homework }, { timeout: 180_000 })).data.tasks;
}

export async function submitMentorTask(taskId: string, answer: string, file?: File): Promise<MentorTask> {
  const form = new FormData();
  if (answer) form.append('answer', answer);
  if (file) form.append('file', file);
  return (await apiClient.post<{ task: MentorTask }>(`${LEARN}/tasks/${taskId}/submit`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180_000 })).data.task;
}

export async function finishLesson(sessionId: string): Promise<LessonSession> {
  return (await apiClient.post<{ session: LessonSession }>(`${LEARN}/sessions/${sessionId}/finish`, {}, { timeout: 180_000 })).data.session;
}
