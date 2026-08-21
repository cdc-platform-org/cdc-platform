import apiClient from './apiClient';
import { PlatformFeeServiceType, FeeScheduleRow } from './adminCommissionsService';

// Read-only counterpart to adminCommissionsService.ts, callable by any
// authenticated user (not just SuperAdmin) — see Backend/src/routes/
// commissions.ts. Powers live commission-rate display outside the admin
// panel (ProposalModal.tsx, the Digital Store submission form's
// commission banner) so those never drift from the admin-edited rate.
export async function getFeeSchedule(): Promise<FeeScheduleRow[]> {
  const response = await apiClient.get<{ data: { feeSchedule: FeeScheduleRow[] } }>('/commissions');
  return response.data.data.feeSchedule;
}

export function findRate(schedule: FeeScheduleRow[], serviceType: PlatformFeeServiceType): number | undefined {
  return schedule.find((row) => row.serviceType === serviceType)?.commissionPercentage;
}
