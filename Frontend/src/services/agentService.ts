import apiClient from './apiClient';
import { Agent, KnowledgeDocument, AgentConversation, AgentStatus } from '../types/agent';

export interface AgentFormPayload {
  name: string;
  primaryColor?: string;
  systemPrompt: string;
  allowedOrigins: string[];
  fallbackPhone?: string | null;
}

export type UpdateAgentPayload = Partial<AgentFormPayload> & { status?: Extract<AgentStatus, 'ACTIVE' | 'PAUSED'> };

export async function getMyAgents(): Promise<Agent[]> {
  const response = await apiClient.get<{ data: Agent[] }>('/agents');
  return response.data.data;
}

export async function createAgent(payload: AgentFormPayload): Promise<Agent> {
  const response = await apiClient.post<{ data: Agent }>('/agents', payload);
  return response.data.data;
}

export async function getAgent(id: string): Promise<Agent> {
  const response = await apiClient.get<{ data: Agent }>(`/agents/${id}`);
  return response.data.data;
}

export async function updateAgent(id: string, payload: UpdateAgentPayload): Promise<Agent> {
  const response = await apiClient.put<{ data: Agent }>(`/agents/${id}`, payload);
  return response.data.data;
}

export async function deleteAgent(id: string): Promise<void> {
  await apiClient.delete(`/agents/${id}`);
}

export interface KnowledgeDocumentPayload {
  question?: string | null;
  content: string;
}

export async function getKnowledgeDocuments(agentId: string): Promise<KnowledgeDocument[]> {
  const response = await apiClient.get<{ data: KnowledgeDocument[] }>(`/agents/${agentId}/knowledge`);
  return response.data.data;
}

export async function createKnowledgeDocument(agentId: string, payload: KnowledgeDocumentPayload): Promise<KnowledgeDocument> {
  const response = await apiClient.post<{ data: KnowledgeDocument }>(`/agents/${agentId}/knowledge`, payload);
  return response.data.data;
}

export async function updateKnowledgeDocument(
  agentId: string,
  docId: string,
  payload: KnowledgeDocumentPayload
): Promise<KnowledgeDocument> {
  const response = await apiClient.put<{ data: KnowledgeDocument }>(`/agents/${agentId}/knowledge/${docId}`, payload);
  return response.data.data;
}

export async function deleteKnowledgeDocument(agentId: string, docId: string): Promise<void> {
  await apiClient.delete(`/agents/${agentId}/knowledge/${docId}`);
}

// Parses PDF/DOCX/MD into Markdown server-side and creates one (or more,
// for a large source) KnowledgeDocument rows — an alternative to manually
// typing Q&A pairs via createKnowledgeDocument above.
export async function uploadKnowledgeFile(agentId: string, file: File): Promise<KnowledgeDocument[]> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<{ data: KnowledgeDocument[] }>(`/agents/${agentId}/knowledge/upload`, formData);
  return response.data.data;
}

export async function getAgentConversations(agentId: string): Promise<AgentConversation[]> {
  const response = await apiClient.get<{ data: AgentConversation[] }>(`/agents/${agentId}/conversations`);
  return response.data.data;
}
