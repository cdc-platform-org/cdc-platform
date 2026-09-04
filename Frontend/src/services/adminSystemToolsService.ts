import apiClient from './apiClient';

export interface ClearCacheResult {
  cleared: { name: string; entriesCleared: number }[];
  note: string;
}

export async function clearApplicationCache(): Promise<ClearCacheResult> {
  const response = await apiClient.post<{ data: ClearCacheResult }>('/admin/system-tools/clear-cache');
  return response.data.data;
}

export interface ProviderHealth {
  configured: boolean;
  ok: boolean;
  message: string;
  latencyMs: number;
}

export interface HealthCheckResult {
  primaryAzure: ProviderHealth;
  secondaryAzure: ProviderHealth;
  gemini: ProviderHealth;
  checkedAt: string;
}

export async function runHealthCheck(): Promise<HealthCheckResult> {
  const response = await apiClient.get<{ data: HealthCheckResult }>('/admin/system-tools/health-check');
  return response.data.data;
}

export interface OrphanedKeyGroup {
  locale: string;
  namespace: string;
  orphanedKeys: string[];
}

export interface OrphanedKeysAuditResult {
  groups: OrphanedKeyGroup[];
  totalOrphanedKeys: number;
}

export async function auditOrphanedLocaleKeys(): Promise<OrphanedKeysAuditResult> {
  const response = await apiClient.get<{ data: OrphanedKeysAuditResult }>('/admin/i18n/audit-orphaned-keys');
  return response.data.data;
}
