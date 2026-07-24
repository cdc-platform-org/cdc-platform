import apiClient from './apiClient';

interface ThreadUser {
  id: string;
  name: string;
  email: string;
}

export interface AdminMessageThread {
  key: string;
  participantA: ThreadUser;
  participantB: ThreadUser;
  lastMessageAt: string;
  messageCount: number;
  flaggedCount: number;
}

export interface AdminMessageRow {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  wasFiltered: boolean;
  createdAt: string;
  sender: ThreadUser;
  recipient: ThreadUser;
}

export async function getMessageThreads(onlyFlagged?: boolean): Promise<AdminMessageThread[]> {
  const response = await apiClient.get<{ data: AdminMessageThread[] }>('/admin/messages/threads', {
    params: onlyFlagged ? { flagged: 'true' } : undefined,
  });
  return response.data.data;
}

export async function getMessageThread(userIdA: string, userIdB: string): Promise<AdminMessageRow[]> {
  const response = await apiClient.get<{ data: AdminMessageRow[] }>(`/admin/messages/threads/${userIdA}/${userIdB}`);
  return response.data.data;
}
