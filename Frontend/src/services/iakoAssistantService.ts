import apiClient from './apiClient';

export interface IakoProfile {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  inScope: string;
  outOfScope: string | null;
  outOfScopeKeywords: string[];
  visionEnabled: boolean;
  temperature: number;
  active: boolean;
  createdAt: string;
  assignments?: Array<{ liveTrainingId: string | null; digitalToolKey: string | null }>;
}
export interface IakoKnowledgeSource { sourceFilename: string; totalChunks: number; totalChars: number; updatedAt: string }
export interface IakoMessage { id: string; role: 'USER' | 'ASSISTANT'; content: string; imageUrl: string | null; createdAt: string }
export interface DigitalToolDefinition { key: string; label: string; linkedProductId: string | null }

export type IakoProfileInput = Omit<IakoProfile, 'id' | 'createdAt' | 'assignments'>;

export async function listIakoProfiles(): Promise<IakoProfile[]> {
  return (await apiClient.get<{ data: IakoProfile[] }>('/admin/iako/profiles')).data.data;
}
export async function getIakoProfile(id: string): Promise<IakoProfile & { sources: IakoKnowledgeSource[] }> {
  return (await apiClient.get<{ data: IakoProfile & { sources: IakoKnowledgeSource[] } }>(`/admin/iako/profiles/${encodeURIComponent(id)}`)).data.data;
}
export async function saveIakoProfile(input: IakoProfileInput, id?: string): Promise<IakoProfile> {
  const response = id
    ? await apiClient.put<{ data: IakoProfile }>(`/admin/iako/profiles/${encodeURIComponent(id)}`, input)
    : await apiClient.post<{ data: IakoProfile }>('/admin/iako/profiles', input);
  return response.data.data;
}
export async function uploadIakoKnowledge(profileId: string, file: File): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  await apiClient.post(`/admin/iako/profiles/${encodeURIComponent(profileId)}/knowledge`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
}
export async function deleteIakoKnowledge(profileId: string, sourceFilename: string): Promise<void> {
  await apiClient.delete(`/admin/iako/profiles/${encodeURIComponent(profileId)}/knowledge/${encodeURIComponent(sourceFilename)}`);
}
export async function listDigitalTools(): Promise<DigitalToolDefinition[]> {
  return (await apiClient.get<{ data: DigitalToolDefinition[] }>('/admin/iako/tools')).data.data;
}
export async function hasDigitalToolAccess(toolKey: string): Promise<boolean> {
  return (await apiClient.get<{ data: { allowed: boolean } }>(`/digital-tools/${encodeURIComponent(toolKey)}/access`)).data.data.allowed;
}
export async function assignIakoProfile(target: { liveTrainingId: string } | { digitalToolKey: string }, profileId: string | null): Promise<void> {
  const path = 'liveTrainingId' in target
    ? `/admin/iako/assignments/live-training/${encodeURIComponent(target.liveTrainingId)}`
    : `/admin/iako/assignments/digital-tool/${encodeURIComponent(target.digitalToolKey)}`;
  await apiClient.put(path, { profileId });
}

const resourcePath = (resource: { liveTrainingId: string } | { digitalToolKey: string }) =>
  'liveTrainingId' in resource ? `/iako/live-training/${encodeURIComponent(resource.liveTrainingId)}` : `/iako/digital-tool/${encodeURIComponent(resource.digitalToolKey)}`;

export async function getIakoConversation(resource: { liveTrainingId: string } | { digitalToolKey: string }): Promise<{ profile: { id: string; name: string; visionEnabled: boolean }; messages: IakoMessage[] }> {
  return (await apiClient.get<{ data: { profile: { id: string; name: string; visionEnabled: boolean }; messages: IakoMessage[] } }>(`${resourcePath(resource)}/conversation`)).data.data;
}
export async function askIako(resource: { liveTrainingId: string } | { digitalToolKey: string }, message: string, image?: File): Promise<{ reply: string; conversationId: string; outOfScope: boolean }> {
  const form = new FormData();
  form.append('message', message);
  if (image) form.append('image', image);
  return (await apiClient.post<{ data: { reply: string; conversationId: string; outOfScope: boolean } }>(`${resourcePath(resource)}/chat`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 90000 })).data.data;
}
