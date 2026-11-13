/**
 * Constants and helpers shared by the admin course editor components.
 */
import { CourseLanguage } from '../../../types/lms';

export const DISCOUNT_PRESETS = [10, 20, 30, 40, 50, 60];

export const emptyForm = {
  title: '',
  titleEn: '',
  description: '',
  descriptionEn: '',
  category: '',
  originalPrice: 0,
  // '' = unlimited seats (the common case) — only a capacity-capped cohort
  // (e.g. a live masterclass) sets this to a real number.
  maxCapacity: '',
  published: false,
  mentorName: '',
  mentorTitle: '',
  thumbnailUrl: '',
  coverImageUrl: '',
  introVideoUrl: '',
  mentorAvatarUrl: '',
  language: 'GEORGIAN' as CourseLanguage,
  skillsTaught: [] as string[],
  isOnSale: false,
  discountPercent: 20,
  discountPercentCustom: '',
  useCustomDiscount: false,
  // <input type="datetime-local"> value, e.g. "2026-08-01T14:30" — converted
  // to a full ISO string on submit.
  discountEndDate: '',
  // Custom badge text shown instead of "-20%" (e.g. "SPECIAL OFFER") — empty
  // string falls back to the plain percent label.
  discountBadgeText: '',
};

export function formatGel(minorUnits: number): string {
  return `${(minorUnits / 100).toFixed(2)} ₾`;
}

export const inputClass =
  'w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:placeholder-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent';
