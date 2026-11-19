// API client for the AI marketing planner (/admin/marketing-planner).
// Backend: Backend/src/routes/admin/adminMarketingPlanner.ts.
import apiClient from './apiClient';

export type PlannerPlatform = 'FACEBOOK' | 'INSTAGRAM';
export type PlannerPostStatus = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';

export interface PlannerSettings {
  enabled: boolean;
  facebookPerWeek: number;
  instagramPerWeek: number;
  postHourTbilisi: number;
  brandNotes: string;
}

export interface PlannerPost {
  id: string;
  platform: PlannerPlatform;
  status: PlannerPostStatus;
  productId: string | null;
  product: { id: string; title: string } | null;
  weekStart: string;
  scheduledAt: string;
  angle: string;
  caption: string;
  originalCaption: string | null;
  hashtags: string[];
  productUrl: string;
  imageUrl: string | null;
  rejectionReason: string | null;
  publishedAt: string | null;
  costUsd: number;
  // caption + link (FB) / "link in bio" (IG) + hashtags — what gets pasted into Meta.
  fullText: string;
}

export interface PlannerOverview {
  week: string;
  settings: PlannerSettings;
  status: { busy: boolean; lastError: string | null; lastFinishedAt: string | null; lastCostUsd: number; configured: boolean };
  posts: PlannerPost[];
}

const BASE = '/admin/marketing-planner';

export async function getPlannerOverview(week?: string): Promise<PlannerOverview> {
  const { data } = await apiClient.get(`${BASE}/overview`, { params: week ? { week } : {} });
  return data.data;
}

export async function savePlannerSettings(s: PlannerSettings): Promise<PlannerSettings> {
  const { data } = await apiClient.put(`${BASE}/settings`, s);
  return data.data;
}

export async function startPlanning(week: string, replaceDrafts: boolean): Promise<void> {
  await apiClient.post(`${BASE}/plan`, { week, replaceDrafts });
}

export async function editPlannerPost(id: string, patch: { caption?: string; hashtags?: string[]; scheduledAt?: string }): Promise<PlannerPost> {
  const { data } = await apiClient.patch(`${BASE}/posts/${id}`, patch);
  return data.data;
}

export async function rewritePlannerPost(id: string, feedback?: string): Promise<PlannerPost> {
  const { data } = await apiClient.post(`${BASE}/posts/${id}/rewrite`, { feedback });
  return data.data;
}

export async function movePlannerPost(id: string, action: 'approve' | 'reject' | 'published' | 'unapprove', reason?: string): Promise<PlannerPost> {
  const { data } = await apiClient.post(`${BASE}/posts/${id}/${action}`, reason ? { reason } : {});
  return data.data;
}

export async function deletePlannerPost(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/posts/${id}`);
}
