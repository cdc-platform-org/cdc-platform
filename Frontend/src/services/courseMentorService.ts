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
}

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
