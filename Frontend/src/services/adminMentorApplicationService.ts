import apiClient from './apiClient';
import { MentorApplication, MentorApplicationStatus } from '../types/instructor';

export async function getMentorApplications(status?: MentorApplicationStatus | ''): Promise<MentorApplication[]> {
  const response = await apiClient.get<{ data: MentorApplication[] }>('/admin/mentor-applications', { params: { status: status || undefined } });
  return response.data.data;
}

export async function approveMentorApplication(id: string): Promise<MentorApplication> {
  const response = await apiClient.post<{ data: MentorApplication }>(`/admin/mentor-applications/${id}/approve`);
  return response.data.data;
}

export async function rejectMentorApplication(id: string, rejectionReason: string): Promise<MentorApplication> {
  const response = await apiClient.post<{ data: MentorApplication }>(`/admin/mentor-applications/${id}/reject`, { rejectionReason });
  return response.data.data;
}
