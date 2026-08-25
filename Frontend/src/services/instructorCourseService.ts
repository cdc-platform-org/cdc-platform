import apiClient from './apiClient';
import { InstructorCourse, InstructorCourseDetail, QualityCheck } from '../types/instructor';
import { AdminSection, AdminLesson, SectionPayload, LessonPayload } from '../types/lms';

export interface InstructorCourseCreatePayload {
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  category: string;
  originalPrice: number;
  language?: 'GEORGIAN' | 'ENGLISH' | 'BOTH';
  skillsTaught?: string[];
}

export type InstructorCourseUpdatePayload = Partial<InstructorCourseCreatePayload> & {
  thumbnailUrl?: string;
  coverImageUrl?: string;
  introVideoUrl?: string;
};

export async function getMyInstructorCourses(): Promise<InstructorCourse[]> {
  const response = await apiClient.get<{ data: InstructorCourse[] }>('/instructor/courses');
  return response.data.data;
}

export async function createInstructorCourse(payload: InstructorCourseCreatePayload): Promise<InstructorCourse> {
  const response = await apiClient.post<{ data: InstructorCourse }>('/instructor/courses', payload);
  return response.data.data;
}

export async function getInstructorCourse(id: string): Promise<InstructorCourseDetail> {
  const response = await apiClient.get<{ data: InstructorCourseDetail }>(`/instructor/courses/${id}`);
  return response.data.data;
}

export async function updateInstructorCourse(id: string, payload: InstructorCourseUpdatePayload): Promise<InstructorCourse> {
  const response = await apiClient.put<{ data: InstructorCourse }>(`/instructor/courses/${id}`, payload);
  return response.data.data;
}

export async function deleteInstructorCourse(id: string): Promise<void> {
  await apiClient.delete(`/instructor/courses/${id}`);
}

export async function getQualityCheck(id: string): Promise<{ checks: QualityCheck[]; ready: boolean }> {
  const response = await apiClient.get<{ data: { checks: QualityCheck[]; ready: boolean } }>(`/instructor/courses/${id}/quality-check`);
  return response.data.data;
}

export async function submitCourseForReview(id: string): Promise<InstructorCourse> {
  const response = await apiClient.post<{ data: InstructorCourse }>(`/instructor/courses/${id}/submit-for-review`);
  return response.data.data;
}

export async function uploadInstructorCourseThumbnail(courseId: string, file: File): Promise<InstructorCourse> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiClient.post<{ data: InstructorCourse }>(`/instructor/courses/${courseId}/thumbnail`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
}

export async function uploadInstructorCourseCoverImage(courseId: string, file: File): Promise<InstructorCourse> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiClient.post<{ data: InstructorCourse }>(`/instructor/courses/${courseId}/cover-image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
}

export async function createInstructorSection(courseId: string, payload: SectionPayload): Promise<AdminSection> {
  const response = await apiClient.post<{ data: AdminSection }>(`/instructor/courses/${courseId}/sections`, payload);
  return response.data.data;
}

export async function updateInstructorSection(sectionId: string, payload: Partial<SectionPayload>): Promise<AdminSection> {
  const response = await apiClient.put<{ data: AdminSection }>(`/instructor/courses/sections/${sectionId}`, payload);
  return response.data.data;
}

export async function deleteInstructorSection(sectionId: string): Promise<void> {
  await apiClient.delete(`/instructor/courses/sections/${sectionId}`);
}

export async function createInstructorLesson(sectionId: string, payload: LessonPayload): Promise<AdminLesson> {
  const response = await apiClient.post<{ data: AdminLesson }>(`/instructor/courses/sections/${sectionId}/lessons`, payload);
  return response.data.data;
}

export async function updateInstructorLesson(lessonId: string, payload: Partial<LessonPayload> & { bunnyVideoId?: string | null }): Promise<AdminLesson> {
  const response = await apiClient.put<{ data: AdminLesson }>(`/instructor/courses/lessons/${lessonId}`, payload);
  return response.data.data;
}

export async function deleteInstructorLesson(lessonId: string): Promise<void> {
  await apiClient.delete(`/instructor/courses/lessons/${lessonId}`);
}

export async function uploadInstructorLessonVideo(
  lessonId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<AdminLesson> {
  const formData = new FormData();
  formData.append('video', file);
  const response = await apiClient.post<{ data: AdminLesson }>(`/instructor/courses/lessons/${lessonId}/video`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });
  return response.data.data;
}
