import { JobCategory } from '../types/community';

export const JOB_CATEGORIES: JobCategory[] = ['ui_ux_design', 'web_development', 'graphic_design', 'digital_marketing', 'other'];

export const JOB_CATEGORY_LABEL: Record<JobCategory, { ka: string; en: string }> = {
  ui_ux_design: { ka: 'UI/UX დიზაინი', en: 'UI/UX Design' },
  web_development: { ka: 'Web დეველოპმენტი', en: 'Web Development' },
  graphic_design: { ka: 'გრაფიკული დიზაინი', en: 'Graphic Design' },
  digital_marketing: { ka: 'ციფრული მარკეტინგი', en: 'Digital Marketing' },
  other: { ka: 'სხვა', en: 'Other' },
};

export function jobCategoryLabel(category: JobCategory | null | undefined, lang: 'ka' | 'en'): string | null {
  if (!category) return null;
  return JOB_CATEGORY_LABEL[category][lang];
}
