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
