import apiClient from './apiClient';
import { ChatMessage } from '../types/message';

export async function sendMessage(recipientId: string, content: string): Promise<ChatMessage> {
  const response = await apiClient.post<{ data: ChatMessage }>('/messages', { recipientId, content });
  return response.data.data;
}

export async function getMessages(otherUserId: string): Promise<ChatMessage[]> {
  const response = await apiClient.get<{ data: ChatMessage[] }>(`/messages/${otherUserId}`);
  return response.data.data;
}
