import apiClient from './apiClient';
import { LaunchKit } from '../types/marketing';

// Creator-facing counterpart to services/marketingService.ts (admin) — same
// shapes, hits /instructor/marketing instead of /admin/marketing. The
// backend enforces ownership (Backend/src/routes/creatorMarketing.ts); this
// client trusts nothing extra on top of that.
export async function generateMyLaunchKit(target: { productId: string } | { courseId: string }, lang: 'ka' | 'en' = 'ka'): Promise<LaunchKit> {
  const response = await apiClient.post<{ data: LaunchKit }>('/instructor/marketing/launch-kits', { ...target, lang });
  return response.data.data;
}

export async function getMyLaunchKits(target: { productId: string } | { courseId: string }): Promise<LaunchKit[]> {
  const response = await apiClient.get<{ data: LaunchKit[] }>('/instructor/marketing/launch-kits', { params: target });
  return response.data.data;
}

export async function deleteMyLaunchKit(id: string): Promise<void> {
  await apiClient.delete(`/instructor/marketing/launch-kits/${id}`);
}
