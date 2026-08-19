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

export interface NotificationBatchRow {
  id: string;
  title: string;
  message: string;
  type: string;
  targetLabel: string;
  recipientCount: number;
  readCount: number;
  sentByName: string;
  sentByEmail: string;
  createdAt: string;
  // Only meaningful when recipientCount === 1 — see Backend's GET
  // /admin/notifications.
  singleRecipientRead: boolean | null;
  singleRecipientReadAt: string | null;
}

export async function getNotificationBatches(): Promise<NotificationBatchRow[]> {
  const response = await apiClient.get<{ data: NotificationBatchRow[] }>('/admin/notifications');
  return response.data.data;
}

export async function deleteNotificationBatch(id: string): Promise<void> {
  await apiClient.delete(`/admin/notifications/${id}`);
}

export async function resendNotificationBatch(id: string): Promise<{ sentCount: number }> {
  const response = await apiClient.post<{ data: { sentCount: number } }>(`/admin/notifications/${id}/resend`);
  return response.data.data;
}
