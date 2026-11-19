/**
 * Marketing planner — admin settings (singleton row) and Tbilisi-time helpers.
 * Exports: MarketingPlannerSettingsView, settingsUpdateSchema, getPlannerSettings,
 * updatePlannerSettings, TBILISI_OFFSET_HOURS, weekStartTbilisi, nextWeekStart, slotTime.
 *
 * Agent logic: ./agent.ts · product picking: ./candidates.ts · runner: ./index.ts.
 */
import { z } from 'zod';
import { prisma } from '../../lib/prisma';

// Mirrors the Prisma column defaults. The weekly auto-plan starts OFF, so
// nothing is generated (and nothing is spent) until an admin turns it on or
// presses "plan next week".
const DEFAULTS = {
  enabled: false,
  facebookPerWeek: 3,
  instagramPerWeek: 3,
  postHourTbilisi: 19,
  brandNotes: '',
};

export interface MarketingPlannerSettingsView {
  enabled: boolean;
  facebookPerWeek: number;
  instagramPerWeek: number;
  postHourTbilisi: number;
  brandNotes: string;
}

export const settingsUpdateSchema = z.object({
  enabled: z.boolean(),
  facebookPerWeek: z.number().int().min(0).max(14),
  instagramPerWeek: z.number().int().min(0).max(14),
  postHourTbilisi: z.number().int().min(8).max(23),
  brandNotes: z.string().max(2000),
});

export async function getPlannerSettings(): Promise<MarketingPlannerSettingsView> {
  const row = await prisma.marketingPlannerSettings.findFirst();
  if (!row) return { ...DEFAULTS };
  return {
    enabled: row.enabled,
    facebookPerWeek: row.facebookPerWeek,
    instagramPerWeek: row.instagramPerWeek,
    postHourTbilisi: row.postHourTbilisi,
    brandNotes: row.brandNotes,
  };
}

export async function updatePlannerSettings(input: MarketingPlannerSettingsView): Promise<MarketingPlannerSettingsView> {
  const row = await prisma.marketingPlannerSettings.findFirst({ select: { id: true } });
  if (row) await prisma.marketingPlannerSettings.update({ where: { id: row.id }, data: input });
  else await prisma.marketingPlannerSettings.create({ data: input });
  return getPlannerSettings();
}

// Georgia is UTC+4 all year (no DST since 2005), so a fixed offset is exact.
export const TBILISI_OFFSET_HOURS = 4;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// Monday 00:00 Tbilisi time of the week containing `d`, as a UTC instant.
export function weekStartTbilisi(d: Date): Date {
  const local = new Date(d.getTime() + TBILISI_OFFSET_HOURS * HOUR);
  const dow = (local.getUTCDay() + 6) % 7; // Monday = 0
  const mondayLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - dow * DAY;
  return new Date(mondayLocal - TBILISI_OFFSET_HOURS * HOUR);
}

export function nextWeekStart(now = new Date()): Date {
  return new Date(weekStartTbilisi(now).getTime() + 7 * DAY);
}

// dayIndex 0 = Monday of `weekStart`; hour is Tbilisi local time.
export function slotTime(weekStart: Date, dayIndex: number, hourTbilisi: number): Date {
  return new Date(weekStart.getTime() + dayIndex * DAY + hourTbilisi * HOUR);
}
