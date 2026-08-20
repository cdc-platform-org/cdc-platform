import apiClient from './apiClient';
import { ChatRequest } from '../types/chatRequest';

export async function sendChatRequest(recipientId: string, introMessage?: string): Promise<ChatRequest> {
  const response = await apiClient.post<{ data: ChatRequest }>('/chat-requests', { recipientId, introMessage });
  return response.data.data;
}

export async function getChatRequestStatus(otherUserId: string): Promise<ChatRequest | null> {
  const response = await apiClient.get<{ data: ChatRequest | null }>(`/chat-requests/status/${otherUserId}`);
  return response.data.data;
}

export async function getIncomingChatRequests(): Promise<ChatRequest[]> {
  const response = await apiClient.get<{ data: ChatRequest[] }>('/chat-requests/incoming');
  return response.data.data;
}

export async function acceptChatRequest(id: string): Promise<ChatRequest> {
  const response = await apiClient.post<{ data: ChatRequest }>(`/chat-requests/${id}/accept`);
  return response.data.data;
}

export async function rejectChatRequest(id: string): Promise<ChatRequest> {
  const response = await apiClient.post<{ data: ChatRequest }>(`/chat-requests/${id}/reject`);
  return response.data.data;
}
