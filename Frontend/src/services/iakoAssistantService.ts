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
  mentorTagline: string | null;
  welcomeMessageKa: string | null;
  welcomeMessageEn: string | null;
  defaultRequestLimit: number | null;
  defaultDailyRequestLimit: number | null;
  defaultHourlyRequestLimit: number | null;
  defaultScreenshotLimit: number | null;
  defaultMaxScreenshotsPerMessage: number;
  defaultAccessDays: number | null;
  createdAt: string;
  assignments?: Array<{ liveTrainingId: string | null; digitalToolKey: string | null }>;
}
export interface IakoKnowledgeSource { sourceFilename: string; totalChunks: number; totalChars: number; updatedAt: string }
export interface IakoMessage { id: string; role: 'USER' | 'ASSISTANT'; content: string; imageUrls: string[]; createdAt: string }
export interface DigitalToolDefinition { key: string; label: string; linkedProductId: string | null }
export interface IakoUsage {
  requestsUsed: number; requestLimit: number | null;
  dailyUsed: number; dailyLimit: number | null;
  hourlyUsed: number; hourlyLimit: number | null;
  screenshotsUsed: number; screenshotLimit: number | null;
  maxScreenshotsPerMessage: number;
  startsAt: string | null; expiresAt: string | null; revokedAt: string | null;
}
export interface MyIakoAssistant {
  resourceType: 'LIVE_TRAINING' | 'DIGITAL_TOOL';
  resourceId: string;
  resourceTitle: string;
  profileName: string;
  mentorTagline: string | null;
  usage: IakoUsage;
}

export function iakoAssistantHref(assistant: Pick<MyIakoAssistant, 'resourceType' | 'resourceId'>): string {
  return assistant.resourceType === 'LIVE_TRAINING'
    ? `/dashboard/live-trainings/${assistant.resourceId}/iako`
    : `/dashboard/iako/tool/${assistant.resourceId}`;
}

export type IakoProfileInput = Omit<IakoProfile, 'id' | 'createdAt' | 'assignments'>;
export type IakoResource = { liveTrainingId: string } | { digitalToolKey: string };
export interface IakoGuideContext { dayId: string; sectionId?: string; itemId?: string }

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
export async function assignIakoProfile(target: IakoResource, profileId: string | null): Promise<void> {
  const path = 'liveTrainingId' in target
    ? `/admin/iako/assignments/live-training/${encodeURIComponent(target.liveTrainingId)}`
    : `/admin/iako/assignments/digital-tool/${encodeURIComponent(target.digitalToolKey)}`;
  await apiClient.put(path, { profileId });
}
export async function listMyIakoAssistants(): Promise<MyIakoAssistant[]> {
  return (await apiClient.get<{ data: MyIakoAssistant[] }>('/iako/my-assistants')).data.data;
}

const resourcePath = (resource: IakoResource) =>
  'liveTrainingId' in resource ? `/iako/live-training/${encodeURIComponent(resource.liveTrainingId)}` : `/iako/digital-tool/${encodeURIComponent(resource.digitalToolKey)}`;

export async function getIakoConversation(resource: IakoResource): Promise<{
  profile: { id: string; name: string; mentorTagline: string | null; visionEnabled: boolean; welcomeMessageKa: string | null; welcomeMessageEn: string | null };
  resourceTitle?: string;
  messages: IakoMessage[];
  usage: IakoUsage | null;
}> {
  return (await apiClient.get(`${resourcePath(resource)}/conversation`)).data.data;
}
export async function askIako(resource: IakoResource, message: string, idempotencyKey: string, images?: File[], guideContext?: IakoGuideContext): Promise<{ reply: string; conversationId: string; outOfScope: boolean; usage: IakoUsage }> {
  const form = new FormData();
  form.append('message', message);
  form.append('idempotencyKey', idempotencyKey);
  if (guideContext) form.append('guideContext', JSON.stringify(guideContext));
  (images ?? []).forEach((image) => form.append('images', image));
  return (await apiClient.post(`${resourcePath(resource)}/chat`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 90000 })).data.data;
}

export interface IakoUsageGrant {
  id: string;
  user: { id: string; name: string; email: string };
  profile: { id: string; name: string };
  resourceType: 'LIVE_TRAINING' | 'DIGITAL_TOOL';
  resourceId: string;
  resourceTitle: string;
  usage: IakoUsage;
}
export async function listUsageGrants(filter?: { resourceType?: string; resourceId?: string }): Promise<IakoUsageGrant[]> {
  return (await apiClient.get<{ data: IakoUsageGrant[] }>('/admin/iako/usage-grants', { params: filter })).data.data;
}
export async function updateUsageGrant(id: string, patch: {
  requestLimit?: number | null; dailyRequestLimit?: number | null; hourlyRequestLimit?: number | null;
  screenshotLimit?: number | null; maxScreenshotsPerMessage?: number; startsAt?: string | null; expiresAt?: string | null;
}): Promise<void> {
  await apiClient.patch(`/admin/iako/usage-grants/${encodeURIComponent(id)}`, patch);
}
export async function addUsageGrantRequests(id: string, amount: number): Promise<void> {
  await apiClient.post(`/admin/iako/usage-grants/${encodeURIComponent(id)}/add-requests`, { amount });
}
export async function revokeUsageGrant(id: string): Promise<void> {
  await apiClient.post(`/admin/iako/usage-grants/${encodeURIComponent(id)}/revoke`);
}
export async function reactivateUsageGrant(id: string): Promise<void> {
  await apiClient.post(`/admin/iako/usage-grants/${encodeURIComponent(id)}/reactivate`);
}
export async function resetUsageGrant(id: string): Promise<void> {
  await apiClient.post(`/admin/iako/usage-grants/${encodeURIComponent(id)}/reset-usage`);
}
