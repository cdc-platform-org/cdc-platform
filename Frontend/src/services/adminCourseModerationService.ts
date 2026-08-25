import apiClient from './apiClient';
import { ModerationCourseRow, InstructorCourseDetail, CourseStatus } from '../types/instructor';

export async function getModerationQueue(status: CourseStatus | '' = 'PENDING_REVIEW'): Promise<ModerationCourseRow[]> {
  const response = await apiClient.get<{ data: ModerationCourseRow[] }>('/admin/course-moderation', { params: { status: status || undefined } });
  return response.data.data;
}

export async function getModerationCourseDetail(id: string): Promise<InstructorCourseDetail & { instructor: ModerationCourseRow['instructor'] }> {
  const response = await apiClient.get<{ data: InstructorCourseDetail & { instructor: ModerationCourseRow['instructor'] } }>(
    `/admin/course-moderation/${id}`
  );
  return response.data.data;
}

export async function approveAndPublishCourse(id: string): Promise<ModerationCourseRow> {
  const response = await apiClient.post<{ data: ModerationCourseRow }>(`/admin/course-moderation/${id}/approve`);
  return response.data.data;
}

export async function requestCourseRevision(id: string, feedback: string): Promise<ModerationCourseRow> {
  const response = await apiClient.post<{ data: ModerationCourseRow }>(`/admin/course-moderation/${id}/request-revision`, { feedback });
  return response.data.data;
}

export async function rejectCourseSubmission(id: string, reason: string): Promise<ModerationCourseRow> {
  const response = await apiClient.post<{ data: ModerationCourseRow }>(`/admin/course-moderation/${id}/reject`, { reason });
  return response.data.data;
}
