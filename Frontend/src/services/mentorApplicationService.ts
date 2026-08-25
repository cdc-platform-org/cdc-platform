import apiClient from './apiClient';
import { MentorApplication, MentorApplicationPayload } from '../types/instructor';

export async function submitMentorApplication(payload: MentorApplicationPayload): Promise<MentorApplication> {
  const response = await apiClient.post<{ data: MentorApplication }>('/mentor-applications', payload);
  return response.data.data;
}

export async function getMyMentorApplications(): Promise<MentorApplication[]> {
  const response = await apiClient.get<{ data: MentorApplication[] }>('/mentor-applications/me');
  return response.data.data;
}
