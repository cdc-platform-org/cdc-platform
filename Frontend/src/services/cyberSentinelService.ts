import apiClient from './apiClient';

export type PreferredOs = 'WINDOWS' | 'MAC' | 'LINUX';

export interface CyberSentinelWaitlistPayload {
  name: string;
  email: string;
  os: PreferredOs;
}

// Public, unauthenticated — anyone visiting /tools can join the waitlist,
// no account needed. See Backend's routes/cyberSentinel.ts.
export async function joinCyberSentinelWaitlist(payload: CyberSentinelWaitlistPayload): Promise<{ id: string }> {
  const response = await apiClient.post<{ data: { id: string } }>('/cyber-sentinel/waitlist', payload);
  return response.data.data;
}

export interface CyberSentinelWaitlistEntry {
  id: string;
  name: string;
  email: string;
  os: PreferredOs;
  createdAt: string;
}

export async function getCyberSentinelWaitlist(): Promise<CyberSentinelWaitlistEntry[]> {
  const response = await apiClient.get<{ data: CyberSentinelWaitlistEntry[] }>('/admin/cyber-sentinel/waitlist');
  return response.data.data;
}
