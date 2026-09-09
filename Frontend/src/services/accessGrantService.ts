import apiClient from './apiClient';

export type AccessGrantResourceType = 'IAKO_PROFILE' | 'DIGITAL_TOOL' | 'LIVE_TRAINING';
export interface AccessGrant {
  id: string;
  resourceType: AccessGrantResourceType;
  resourceId: string;
  userId: string | null;
  email: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  note: string | null;
  revokedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
  createdBy: { id: string; name: string };
}

export async function listAccessGrants(filter?: { resourceType?: AccessGrantResourceType; resourceId?: string }): Promise<AccessGrant[]> {
  return (await apiClient.get<{ data: AccessGrant[] }>('/admin/access-grants', { params: filter })).data.data;
}
export async function createAccessGrant(input: {
  resourceType: AccessGrantResourceType; resourceId: string; userId?: string | null; email?: string | null;
  startsAt?: string | null; expiresAt?: string | null; note?: string | null;
}): Promise<AccessGrant> {
  return (await apiClient.post<{ data: AccessGrant }>('/admin/access-grants', input)).data.data;
}
export async function revokeAccessGrant(id: string): Promise<void> {
  await apiClient.post(`/admin/access-grants/${encodeURIComponent(id)}/revoke`);
}
