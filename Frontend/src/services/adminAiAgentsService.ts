import apiClient from './apiClient';

export interface PlatformAgent {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  systemPrompt: string;
  isActive: boolean;
  isDefault: boolean;
  knowledgeSourceFilenames: string[];
  createdAt: string;
  updatedAt: string;
}

export async function getPlatformAgents(): Promise<PlatformAgent[]> {
  const response = await apiClient.get<{ data: PlatformAgent[] }>('/admin/ai-agents');
  return response.data.data;
}

export async function createPlatformAgent(payload: {
  name: string;
  nameEn?: string;
  slug: string;
  systemPrompt: string;
}): Promise<PlatformAgent> {
  const response = await apiClient.post<{ data: PlatformAgent }>('/admin/ai-agents', payload);
  return response.data.data;
}

export async function updatePlatformAgent(
  id: string,
  payload: { name?: string; nameEn?: string; systemPrompt?: string; isActive?: boolean }
): Promise<PlatformAgent> {
  const response = await apiClient.patch<{ data: PlatformAgent }>(`/admin/ai-agents/${id}`, payload);
  return response.data.data;
}

export async function setDefaultPlatformAgent(id: string): Promise<PlatformAgent> {
  const response = await apiClient.post<{ data: PlatformAgent }>(`/admin/ai-agents/${id}/set-default`);
  return response.data.data;
}

export async function unsetDefaultPlatformAgent(id: string): Promise<PlatformAgent> {
  const response = await apiClient.post<{ data: PlatformAgent }>(`/admin/ai-agents/${id}/unset-default`);
  return response.data.data;
}

export async function setPlatformAgentKnowledgeSources(id: string, sourceFilenames: string[]): Promise<PlatformAgent> {
  const response = await apiClient.put<{ data: PlatformAgent }>(`/admin/ai-agents/${id}/knowledge-sources`, { sourceFilenames });
  return response.data.data;
}

export async function deletePlatformAgent(id: string): Promise<void> {
  await apiClient.delete(`/admin/ai-agents/${id}`);
}
