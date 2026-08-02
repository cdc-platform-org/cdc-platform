import apiClient from './apiClient';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export async function getMyNotifications(): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
  const response = await apiClient.get<{ data: { notifications: AppNotification[]; unreadCount: number } }>('/notifications');
  return response.data.data;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const response = await apiClient.post<{ data: AppNotification }>(`/notifications/${id}/read`);
  return response.data.data;
}

export interface SendNotificationPayload {
  title: string;
  message: string;
  type?: string;
  targetUserId?: string;
  targetRole?: 'ALL' | 'Student' | 'Client';
}

export async function sendNotification(payload: SendNotificationPayload): Promise<{ sentCount: number }> {
  const response = await apiClient.post<{ data: { sentCount: number } }>('/admin/notifications', payload);
  return response.data.data;
}
