import apiClient from './apiClient';

export type PlatformFeeServiceType =
  | 'GIG_UNVERIFIED'
  | 'GIG_VERIFIED'
  | 'MENTORSHIP'
  | 'HR_SUPPORT'
  | 'DIGITAL_PRODUCT_UNVERIFIED'
  | 'DIGITAL_PRODUCT_VERIFIED'
  | 'COURSE';

export interface FeeScheduleRow {
  serviceType: PlatformFeeServiceType;
  commissionPercentage: number;
}

export interface CommissionsSettings {
  feeSchedule: FeeScheduleRow[];
  dailyPostLimit: number;
}

export async function getCommissionsSettings(): Promise<CommissionsSettings> {
  const response = await apiClient.get<{ data: CommissionsSettings }>('/admin/commissions');
  return response.data.data;
}

export async function updateCommissionPercentage(serviceType: PlatformFeeServiceType, commissionPercentage: number) {
  const response = await apiClient.put<{ data: FeeScheduleRow }>(`/admin/commissions/fee-schedule/${serviceType}`, {
    commissionPercentage,
  });
  return response.data.data;
}

export async function updateDailyPostLimit(dailyPostLimit: number) {
  const response = await apiClient.put<{ data: { dailyPostLimit: number } }>('/admin/commissions/daily-post-limit', {
    dailyPostLimit,
  });
  return response.data.data;
}
