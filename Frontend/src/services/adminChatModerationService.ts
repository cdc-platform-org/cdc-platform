import apiClient from './apiClient';

interface FlagParticipant {
  id: string;
  name: string;
  email: string;
  isBanned: boolean;
}

export interface ChatFlagIncident {
  id: string;
  sender: FlagParticipant;
  recipient: FlagParticipant;
  attemptedContent: string;
  detectedReason: string;
  reviewedAt: string | null;
  reviewedByAdmin: { id: string; name: string } | null;
  createdAt: string;
}

export async function getChatFlagIncidents(onlyUnreviewed?: boolean): Promise<ChatFlagIncident[]> {
  const response = await apiClient.get<{ data: ChatFlagIncident[] }>('/admin/chat-moderation', {
    params: onlyUnreviewed ? { unreviewed: 'true' } : undefined,
  });
  return response.data.data;
}

export async function reviewChatFlagIncident(id: string): Promise<ChatFlagIncident> {
  const response = await apiClient.post<{ data: ChatFlagIncident }>(`/admin/chat-moderation/${id}/review`);
  return response.data.data;
}
