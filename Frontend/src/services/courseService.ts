import apiClient from './apiClient';
import {
  Course,
  CoursePayload,
  LmsSection,
  CourseProgressSummary,
  AdminSection,
  AdminLesson,
  SectionPayload,
  LessonPayload,
  CertificateVerification,
  Exam,
  ExamSettingsPayload,
  ExamStatus,
  ExamStartResult,
  ExamSubmitResult,
  ExamAnswerLetter,
  SyllabusSection,
  MyCourseWithProgress,
  AssignmentSubmission,
  AdminAssignmentSubmission,
  AssignmentStatus,
} from '../types/lms';

// --- Course CRUD (admin) / listing (public) ---

export async function getCourses(): Promise<Course[]> {
  const response = await apiClient.get<{ data: Course[] }>('/courses');
  return response.data.data;
}

export async function getCourse(courseId: string): Promise<Course> {
  const response = await apiClient.get<{ data: Course }>(`/courses/${courseId}`);
  return response.data.data;
}

export async function createCourse(payload: CoursePayload): Promise<Course> {
  const response = await apiClient.post<{ data: Course }>('/courses', payload);
  return response.data.data;
}

export async function updateCourse(courseId: string, payload: Partial<CoursePayload>): Promise<Course> {
  const response = await apiClient.put<{ data: Course }>(`/courses/${courseId}`, payload);
  return response.data.data;
}

export async function deleteCourse(courseId: string): Promise<void> {
  await apiClient.delete(`/courses/${courseId}`);
}

export async function uploadCourseThumbnail(courseId: string, file: File): Promise<Course> {
  const formData = new FormData();
  formData.append('thumbnail', file);
  const response = await apiClient.post<{ data: Course }>(`/courses/${courseId}/thumbnail`, formData);
  return response.data.data;
}

export async function uploadCourseCoverImage(courseId: string, file: File): Promise<Course> {
  const formData = new FormData();
  formData.append('coverImage', file);
  const response = await apiClient.post<{ data: Course }>(`/courses/${courseId}/cover-image`, formData);
  return response.data.data;
}

export async function uploadCourseMentorAvatar(courseId: string, file: File): Promise<Course> {
  const formData = new FormData();
  formData.append('mentorAvatar', file);
  const response = await apiClient.post<{ data: Course }>(`/courses/${courseId}/mentor-avatar`, formData);
  return response.data.data;
}

export async function getSyllabus(courseId: string): Promise<SyllabusSection[]> {
  const response = await apiClient.get<{ data: SyllabusSection[] }>(`/courses/${courseId}/syllabus`);
  return response.data.data;
}

// --- Student dashboard: enrolled courses with progress + certificate flag ---

export async function getMyCourses(): Promise<MyCourseWithProgress[]> {
  const response = await apiClient.get<{ data: MyCourseWithProgress[] }>('/courses/mine');
  return response.data.data;
}

// --- Student curriculum / progress / certificate (learn page) ---

export async function getCurriculum(courseId: string): Promise<LmsSection[]> {
  const response = await apiClient.get<{ data: LmsSection[] }>(`/courses/${courseId}/curriculum`);
  return response.data.data;
}

export async function getProgressSummary(courseId: string): Promise<CourseProgressSummary> {
  const response = await apiClient.get<{ data: CourseProgressSummary }>(`/courses/${courseId}/progress`);
  return response.data.data;
}

export async function setLessonProgress(lessonId: string, completed: boolean): Promise<void> {
  await apiClient.post(`/courses/lessons/${lessonId}/progress`, { completed });
}

export async function downloadCertificate(courseId: string): Promise<Blob> {
  const response = await apiClient.get(`/courses/${courseId}/certificate`, { responseType: 'blob' });
  return response.data;
}

// --- Admin curriculum editor ---

export async function getAdminCurriculum(courseId: string): Promise<AdminSection[]> {
  const response = await apiClient.get<{ data: AdminSection[] }>(`/courses/${courseId}/curriculum/admin`);
  return response.data.data;
}

export async function createSection(courseId: string, payload: SectionPayload): Promise<AdminSection> {
  const response = await apiClient.post<{ data: AdminSection }>(`/courses/${courseId}/sections`, payload);
  return response.data.data;
}

export async function updateSection(sectionId: string, payload: Partial<SectionPayload>): Promise<AdminSection> {
  const response = await apiClient.put<{ data: AdminSection }>(`/courses/sections/${sectionId}`, payload);
  return response.data.data;
}

export async function deleteSection(sectionId: string): Promise<void> {
  await apiClient.delete(`/courses/sections/${sectionId}`);
}

export async function createLesson(sectionId: string, payload: LessonPayload): Promise<AdminLesson> {
  const response = await apiClient.post<{ data: AdminLesson }>(`/courses/sections/${sectionId}/lessons`, payload);
  return response.data.data;
}

export async function updateLesson(lessonId: string, payload: Partial<LessonPayload>): Promise<AdminLesson> {
  const response = await apiClient.put<{ data: AdminLesson }>(`/courses/lessons/${lessonId}`, payload);
  return response.data.data;
}

export async function deleteLesson(lessonId: string): Promise<void> {
  await apiClient.delete(`/courses/lessons/${lessonId}`);
}

export async function uploadLessonVideo(
  lessonId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<AdminLesson> {
  const formData = new FormData();
  formData.append('video', file);
  const response = await apiClient.post<{ data: AdminLesson }>(`/courses/lessons/${lessonId}/video`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });
  return response.data.data;
}

export async function regenerateLessonSubtitles(lessonId: string): Promise<AdminLesson> {
  const response = await apiClient.post<{ data: AdminLesson }>(`/courses/lessons/${lessonId}/subtitles/regenerate`);
  return response.data.data;
}

// --- AI Exam & Certification Gate ---

export async function getExamStatus(courseId: string): Promise<ExamStatus> {
  const response = await apiClient.get<{ data: ExamStatus }>(`/courses/${courseId}/exam/status`);
  return response.data.data;
}

export async function startExam(courseId: string, lang?: 'ka' | 'en'): Promise<ExamStartResult> {
  const response = await apiClient.post<{ data: ExamStartResult }>(`/courses/${courseId}/exam/start`, { lang });
  return response.data.data;
}

export async function submitExam(
  courseId: string,
  sessionToken: string,
  answers: Record<string, ExamAnswerLetter>
): Promise<ExamSubmitResult> {
  const response = await apiClient.post<{ data: ExamSubmitResult }>(`/courses/${courseId}/exam/submit`, {
    sessionToken,
    answers,
  });
  return response.data.data;
}

// --- Admin: exam settings ---

export async function getExamSettings(courseId: string): Promise<Exam | null> {
  const response = await apiClient.get<{ data: Exam | null }>(`/courses/${courseId}/exam`);
  return response.data.data;
}

export async function updateExamSettings(courseId: string, payload: ExamSettingsPayload): Promise<Exam> {
  const response = await apiClient.put<{ data: Exam }>(`/courses/${courseId}/exam`, payload);
  return response.data.data;
}

// --- Public certificate verification (no auth — the QR code target) ---

export async function verifyCertificate(code: string): Promise<CertificateVerification> {
  const response = await apiClient.get<{ data: CertificateVerification }>(`/courses/verify/${code}`);
  return response.data.data;
}

// --- Homework assignments ---

export interface SubmitAssignmentPayload {
  fileUrl?: string;
  linkUrl?: string;
  comment?: string;
}

export async function uploadSubmissionFile(lessonId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<{ data: { url: string } }>(`/courses/lessons/${lessonId}/submissions/upload`, formData);
  return response.data.data.url;
}

export async function submitAssignment(lessonId: string, payload: SubmitAssignmentPayload): Promise<AssignmentSubmission> {
  const response = await apiClient.post<{ data: AssignmentSubmission }>(`/courses/lessons/${lessonId}/submissions`, payload);
  return response.data.data;
}

export async function getMySubmission(lessonId: string): Promise<AssignmentSubmission | null> {
  const response = await apiClient.get<{ data: AssignmentSubmission | null }>(`/courses/lessons/${lessonId}/submissions/mine`);
  return response.data.data;
}

export async function getAdminSubmissions(status?: AssignmentStatus): Promise<AdminAssignmentSubmission[]> {
  const response = await apiClient.get<{ data: AdminAssignmentSubmission[] }>('/courses/admin/submissions', {
    params: status ? { status } : undefined,
  });
  return response.data.data;
}

export async function gradeSubmission(id: string, status: 'APPROVED' | 'NEEDS_REVISION', feedback?: string): Promise<AssignmentSubmission> {
  const response = await apiClient.post<{ data: AssignmentSubmission }>(`/courses/admin/submissions/${id}/grade`, { status, feedback });
  return response.data.data;
}

// --- AI Course Tutor ---

export interface TutorChatTurn {
  role: 'USER' | 'ASSISTANT';
  content: string;
}

export async function askCourseTutor(params: {
  courseId: string;
  lessonId: string;
  userMessage: string;
  chatHistory: TutorChatTurn[];
}): Promise<string> {
  const response = await apiClient.post<{ reply: string }>('/ai/course-tutor', params);
  return response.data.reply;
}
