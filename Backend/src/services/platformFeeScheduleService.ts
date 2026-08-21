import { prisma } from '../lib/prisma';
import { PlatformFeeServiceType } from '@prisma/client';

// Same values every escrow/sale service used to hardcode independently —
// now only the fallback for when the admin hasn't touched
// PlatformFeeSchedule yet (or a row was somehow deleted), so a fresh
// deployment behaves exactly like the old hardcoded constants until an
// admin changes something via /admin/commissions.
const FALLBACK_PERCENTAGE: Record<PlatformFeeServiceType, number> = {
  GIG_UNVERIFIED: 25,
  GIG_VERIFIED: 20,
  MENTORSHIP: 20,
  HR_SUPPORT: 40,
  DIGITAL_PRODUCT: 20,
};

// Called at capture time by all 4 escrow/sale services — returns a 0-1
// fraction (commissionAmount = grossAmount * rate), not the raw percentage
// stored in the table.
export async function getCommissionRate(serviceType: PlatformFeeServiceType): Promise<number> {
  const row = await prisma.platformFeeSchedule.findUnique({ where: { serviceType } });
  const percentage = row?.commissionPercentage ?? FALLBACK_PERCENTAGE[serviceType];
  return percentage / 100;
}

// Admin GET /admin/commissions — one row per PlatformFeeServiceType, filled
// in with the fallback for any service type the admin hasn't saved yet, so
// the UI always shows all 5 with their effective (not just stored) rate.
export async function getEffectiveFeeSchedule(): Promise<{ serviceType: PlatformFeeServiceType; commissionPercentage: number }[]> {
  const rows = await prisma.platformFeeSchedule.findMany();
  const byType = new Map(rows.map((r) => [r.serviceType, r.commissionPercentage]));
  return (Object.keys(FALLBACK_PERCENTAGE) as PlatformFeeServiceType[]).map((serviceType) => ({
    serviceType,
    commissionPercentage: byType.get(serviceType) ?? FALLBACK_PERCENTAGE[serviceType],
  }));
}

export async function upsertCommissionPercentage(
  serviceType: PlatformFeeServiceType,
  commissionPercentage: number,
  updatedByEmail: string
) {
  return prisma.platformFeeSchedule.upsert({
    where: { serviceType },
    update: { commissionPercentage, updatedByEmail },
    create: { serviceType, commissionPercentage, updatedByEmail },
  });
}
